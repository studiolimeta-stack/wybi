/**
 * Regression tests for the account layer.
 *
 * These cover the parts that are easy to get subtly wrong and expensive to
 * discover in production: identity linking (two login methods must resolve to
 * ONE account), single-use magic links, and the claiming rule that must never
 * steal a test that already has an owner.
 *
 * Cookie-dependent helpers (createSession/readSession) are not covered here —
 * they need a request scope. They are exercised by scripts/smoke-test.js.
 *
 * Run: npm test   (loads .env, hits the real dev database, cleans up after itself)
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  findOrCreateUserByIdentity,
  createLoginToken,
  consumeLoginToken,
  claimTests,
  safeRedirect,
  normaliseEmail,
  issueSessionToken,
  pruneDeadAuthRows,
} from '../src/lib/auth.js';
import { createTest, listTestsByUserId } from '../src/lib/tests.js';
import { query, pool } from '../src/lib/db.js';

const EMAIL = 'authtest+wybi@example.invalid';
const OTHER = 'authtest-other+wybi@example.invalid';

async function cleanup() {
  await query('DELETE FROM tests WHERE title LIKE $1', ['__authtest%']);
  await query('DELETE FROM login_tokens WHERE email = ANY($1)', [[EMAIL, OTHER]]);
  await query('DELETE FROM users WHERE email = ANY($1)', [[EMAIL, OTHER]]);
}

before(cleanup);
after(async () => {
  await cleanup();
  await pool.end();
});

test('a first Google login creates the account', async () => {
  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'google',
    providerUserId: 'google-uid-1',
    email: EMAIL,
    name: 'Test Person',
  });

  assert.equal(created, true);
  assert.equal(user.email, EMAIL);
  assert.ok(user.email_verified_at, 'a verified provider must mark the email verified');
});

test('logging in again with Google reuses the same account', async () => {
  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'google',
    providerUserId: 'google-uid-1',
    email: EMAIL,
  });

  assert.equal(created, false);
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [EMAIL]);
  assert.equal(rows[0].n, 1);
});

/*
 * The one that matters. Someone signs up with Google, comes back a month later,
 * forgets, and types their address into the magic-link box. If that produces a
 * second account they lose every test they ever made — and the UI gives them no
 * way to tell why.
 */
test('a magic link on a Google account signs into that same account', async () => {
  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'email',
    providerUserId: EMAIL,
    email: EMAIL,
  });

  assert.equal(created, false, 'must link, not duplicate');

  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [EMAIL]);
  assert.equal(rows[0].n, 1);

  const ids = await query('SELECT provider FROM identities WHERE user_id = $1 ORDER BY provider', [user.id]);
  assert.deepEqual(ids.rows.map((r) => r.provider), ['email', 'google']);
});

/*
 * /create writes an unverified users row when someone types the optional email.
 * First real login must adopt that row rather than collide with its UNIQUE email.
 */
test('an unverified row left by /create is adopted and verified', async () => {
  const { rows: seeded } = await query('INSERT INTO users (email) VALUES ($1) RETURNING id', [OTHER]);

  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'google',
    providerUserId: 'google-uid-2',
    email: OTHER,
  });

  assert.equal(created, false);
  assert.equal(user.id, seeded[0].id, 'must reuse the existing row, not orphan it');

  const { rows } = await query('SELECT email_verified_at FROM users WHERE id = $1', [user.id]);
  assert.ok(rows[0].email_verified_at);
});

test('email is normalised, so case never splits an account', async () => {
  assert.equal(normaliseEmail('  Test@Example.COM '), 'test@example.com');

  const { created } = await findOrCreateUserByIdentity({
    provider: 'email',
    providerUserId: EMAIL,
    email: EMAIL.toUpperCase(),
  });
  assert.equal(created, false);
});

test('a magic link works exactly once', async () => {
  const token = await createLoginToken(EMAIL, { redirectTo: '/dashboard' });

  const first = await consumeLoginToken(token);
  assert.equal(first.email, EMAIL);
  assert.equal(first.redirect_to, '/dashboard');

  const second = await consumeLoginToken(token);
  assert.equal(second, null, 'a mail scanner pre-fetching the link must not burn a live session');
});

test('an expired magic link is refused', async () => {
  const token = await createLoginToken(EMAIL);
  await query(
    "UPDATE login_tokens SET expires_at = now() - interval '1 minute' WHERE token_hash IS NOT NULL AND consumed_at IS NULL AND email = $1",
    [EMAIL],
  );
  assert.equal(await consumeLoginToken(token), null);
});

/*
 * Data-retention prune (see Development Guidelines → Data retention): dead
 * sessions/login_tokens carry an ip_hash + user_agent with no remaining
 * purpose and must eventually go, but a *recently* dead row (still within the
 * 30-day grace window) must survive — it's the one place a real support
 * question ("did I actually get logged out on Tuesday?") could still need it.
 */
test('the auth-row prune deletes only rows dead more than 30 days, never live ones', async () => {
  const { rows: users } = await query('SELECT id FROM users WHERE email = $1', [EMAIL]);
  const userId = users[0].id;

  const liveToken = await issueSessionToken(userId);
  const recentlyRevokedToken = await issueSessionToken(userId);
  const longRevokedToken = await issueSessionToken(userId);
  const longExpiredToken = await issueSessionToken(userId);

  const hash = (t) => createHash('sha256').update(t).digest('hex');
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hash(recentlyRevokedToken)]);
  await query(
    "UPDATE sessions SET revoked_at = now() - interval '40 days', expires_at = now() - interval '40 days' WHERE token_hash = $1",
    [hash(longRevokedToken)],
  );
  await query("UPDATE sessions SET expires_at = now() - interval '40 days' WHERE token_hash = $1", [
    hash(longExpiredToken),
  ]);

  const oldLoginToken = await createLoginToken(EMAIL);
  await query("UPDATE login_tokens SET created_at = now() - interval '31 days' WHERE token_hash = $1", [
    hash(oldLoginToken),
  ]);
  const freshLoginToken = await createLoginToken(EMAIL);

  await pruneDeadAuthRows();

  const remaining = await query('SELECT token_hash FROM sessions WHERE user_id = $1', [userId]);
  const remainingHashes = remaining.rows.map((r) => r.token_hash);
  assert.ok(remainingHashes.includes(hash(liveToken)), 'a live session must survive');
  assert.ok(remainingHashes.includes(hash(recentlyRevokedToken)), 'a revoked-but-recent session must survive');
  assert.ok(!remainingHashes.includes(hash(longRevokedToken)), 'a session dead >30 days must be pruned');
  assert.ok(!remainingHashes.includes(hash(longExpiredToken)), 'an expired->30-days session must be pruned');

  const remainingLoginTokens = await query('SELECT token_hash FROM login_tokens WHERE email = $1', [EMAIL]);
  const remainingLoginHashes = remainingLoginTokens.rows.map((r) => r.token_hash);
  assert.ok(remainingLoginHashes.includes(hash(freshLoginToken)), 'a fresh login token must survive');
  assert.ok(!remainingLoginHashes.includes(hash(oldLoginToken)), 'a login token older than 30 days must be pruned');

  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
});

test('claiming never steals a test that already has an owner', async () => {
  const { rows: users } = await query('SELECT id FROM users WHERE email = ANY($1) ORDER BY id', [[EMAIL, OTHER]]);
  const [mine, theirs] = users;

  await query(
    `INSERT INTO tests (slug, creator_token, title, description, user_id)
     VALUES ('__AT0001', '__authtest-unowned', '__authtest unowned', 'x', NULL),
            ('__AT0002', '__authtest-owned',   '__authtest owned',   'x', $1)`,
    [theirs.id],
  );

  const claimed = await claimTests(mine.id, ['__authtest-unowned', '__authtest-owned']);
  assert.equal(claimed, 1, 'only the ownerless test may be adopted');

  const { rows } = await query('SELECT creator_token, user_id FROM tests WHERE title LIKE $1 ORDER BY slug', [
    '__authtest%',
  ]);
  assert.equal(rows[0].user_id, mine.id);
  assert.equal(rows[1].user_id, theirs.id, 'the owned test must be untouched');
});

/*
 * Without sessionUserId, a test made by an already-logged-in creator would
 * only reach their account on their NEXT login — claiming runs there, not at
 * creation — and would sit invisible to /account's billing view until then.
 */
test('a test created while logged in is owned immediately, no next-login required', async () => {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [EMAIL]);
  const userId = rows[0].id;

  const test = await createTest(
    {
      title: '__authtest owned at creation',
      description: 'x',
      currency: 'USD',
      billingType: 'one_time',
      askSuggestedPrice: true,
      askConfidence: true,
      prices: [9],
    },
    { sessionUserId: userId },
  );

  assert.equal(test.user_id, userId);

  const owned = await listTestsByUserId(userId);
  assert.ok(owned.some((t) => t.id === test.id), 'must show up in the account billing query immediately');
});

test('claiming nothing is a no-op', async () => {
  assert.equal(await claimTests(1, []), 0);
  assert.equal(await claimTests(1, null), 0);
});

/*
 * `startsWith('/')` alone lets through //evil.com, which browsers read as
 * protocol-relative and follow off-site. On a login route that is a phishing gift.
 */
test('the post-login redirect refuses anything off-site', async () => {
  assert.equal(safeRedirect('/dashboard'), '/dashboard');
  assert.equal(safeRedirect('/r/abc?x=1'), '/r/abc?x=1');
  assert.equal(safeRedirect('//evil.com'), '/dashboard');
  assert.equal(safeRedirect('/\\evil.com'), '/dashboard');
  assert.equal(safeRedirect('/\t/evil.com'), '/dashboard');
  assert.equal(safeRedirect('/\\/evil.com'), '/dashboard');
  assert.equal(safeRedirect('https://evil.com'), '/dashboard');
  assert.equal(safeRedirect('https:evil.com'), '/dashboard');
  assert.equal(safeRedirect('/api/auth/logout'), '/dashboard');
  assert.equal(safeRedirect(undefined), '/dashboard');
  assert.equal(safeRedirect('javascript:alert(1)'), '/dashboard');
});
