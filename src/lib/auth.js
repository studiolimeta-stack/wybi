/**
 * The account data layer: users, identities, sessions, magic-link tokens.
 *
 * Deliberately free of `next/headers` — nothing here touches a cookie or a
 * request. That keeps it unit-testable outside the Next runtime (see
 * scripts/test-auth.js) and puts the request-scoped surface in one place,
 * src/lib/session.js, which is the only module allowed to read or set the
 * session cookie.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { query, transaction } from './db.js';
import { config } from './config.js';

export const SESSION_TTL_DAYS = 30;

/** Only slide the expiry on read if the row is meaningfully stale. */
const TOUCH_AFTER_MS = 1000 * 60 * 60 * 24;

const MAGIC_LINK_TTL_MINUTES = 15;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/* ------------------------------------------------------------------ sessions */

/**
 * Creates the session row and returns the raw token for the caller to put in a
 * cookie. Only the SHA-256 hash is stored: a database leak must not hand over
 * live sessions.
 */
export async function issueSessionToken(userId, { userAgent = null, ipHash = null } = {}) {
  const token = randomBytes(32).toString('base64url');

  await query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
    [userId, hashToken(token), userAgent?.slice(0, 400) ?? null, ipHash, String(SESSION_TTL_DAYS)],
  );
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);

  pruneDeadAuthRowsSometimes();

  return token;
}

/**
 * Data-retention prune for sessions/login_tokens (see Development Guidelines →
 * Data retention). Both tables carry an ip_hash + user_agent that serve no
 * purpose once the row is dead, so — same lazy pattern as
 * lib/tests.js#checkRateLimit's rate_limit_hits prune — a small fraction of
 * logins/link-sends deletes anything long past its useful life instead of
 * needing a cron job. Login is the only write path shared by both tables.
 * Windows are generous on purpose: this is cleanup of already-inert rows, not
 * a security control (revocation/expiry checks already gate access above).
 * Exported un-gated as pruneDeadAuthRows so scripts/test-auth.js can assert
 * the DELETE's WHERE clause directly, without depending on the 1% roll.
 */
export async function pruneDeadAuthRows() {
  await query(
    `DELETE FROM sessions WHERE (revoked_at IS NOT NULL OR expires_at < now()) AND expires_at < now() - interval '30 days'`,
  ).catch((err) => console.error(`session_prune_failed: ${err.message}`));
  await query("DELETE FROM login_tokens WHERE created_at < now() - interval '30 days'").catch((err) =>
    console.error(`login_token_prune_failed: ${err.message}`),
  );
}

function pruneDeadAuthRowsSometimes() {
  if (Math.random() < 0.01) pruneDeadAuthRows();
}

export async function lookupSession(token) {
  if (!token) return null;

  const { rows } = await query(
    `SELECT s.id AS session_id, s.last_seen_at,
            u.id, u.email, u.name, u.avatar_url, u.email_verified_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;

  // Slide the expiry forward, but not on every single page view.
  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_AFTER_MS) {
    query(
      `UPDATE sessions SET last_seen_at = now(), expires_at = now() + ($2 || ' days')::interval WHERE id = $1`,
      [row.session_id, String(SESSION_TTL_DAYS)],
    ).catch((err) => console.error(`session_touch_failed: ${err.message}`));
  }

  return {
    sessionId: row.session_id,
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    emailVerifiedAt: row.email_verified_at,
  };
}

export async function revokeSessionByToken(token) {
  if (!token) return;
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    hashToken(token),
  ]);
}

/** "Log out everywhere" — used by the account page. */
export async function revokeAllSessions(userId) {
  await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

/* ---------------------------------------------------------------- identities */

/**
 * Resolves a verified login to a user, creating one if needed.
 *
 * Linking on email is only safe because BOTH login methods prove ownership of
 * the address before calling this — Google via a verified id token, magic link
 * via the click itself. Signing in with Google and later using a magic link on
 * the same address must land in the same account, not a duplicate; that is what
 * step 2 is for.
 *
 * Step 2 also defends against any future path that inserts an unverified
 * `users` row by email without an identity attached (`/create` used to do
 * exactly that before the "Revised Preview + Account Flow" spec removed it —
 * every `users` row is created with an identity in the same transaction now,
 * via step 3, so step 2 is not currently reachable in practice). Left in
 * place deliberately rather than deleted: it costs nothing and keeps this
 * function correct if an email-first path is ever reintroduced.
 */
export async function findOrCreateUserByIdentity({ provider, providerUserId, email, name = null, avatarUrl = null }) {
  const normalised = normaliseEmail(email);
  if (!normalised) throw new Error('findOrCreateUserByIdentity requires an email');

  return transaction(async (client) => {
    // 1. Known identity — the returning-user path.
    const existing = await client.query(
      `SELECT u.* FROM identities i JOIN users u ON u.id = i.user_id
       WHERE i.provider = $1 AND i.provider_user_id = $2`,
      [provider, providerUserId],
    );
    if (existing.rows.length) {
      const { rows } = await client.query(
        `UPDATE users
         SET name = COALESCE($2, name),
             avatar_url = COALESCE($3, avatar_url),
             email_verified_at = COALESCE(email_verified_at, now())
         WHERE id = $1 RETURNING *`,
        [existing.rows[0].id, name, avatarUrl],
      );
      return { user: rows[0], created: false };
    }

    // 2. Same address, different method — link, don't duplicate.
    const byEmail = await client.query('SELECT * FROM users WHERE email = $1', [normalised]);
    if (byEmail.rows.length) {
      const found = byEmail.rows[0];
      await client.query(
        `INSERT INTO identities (user_id, provider, provider_user_id)
         VALUES ($1, $2, $3) ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [found.id, provider, providerUserId],
      );
      const { rows } = await client.query(
        `UPDATE users
         SET name = COALESCE(name, $2),
             avatar_url = COALESCE(avatar_url, $3),
             email_verified_at = COALESCE(email_verified_at, now())
         WHERE id = $1 RETURNING *`,
        [found.id, name, avatarUrl],
      );
      return { user: rows[0], created: false };
    }

    // 3. Genuinely new.
    const { rows } = await client.query(
      `INSERT INTO users (email, name, avatar_url, email_verified_at)
       VALUES ($1, $2, $3, now()) RETURNING *`,
      [normalised, name, avatarUrl],
    );
    await client.query('INSERT INTO identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)', [
      rows[0].id,
      provider,
      providerUserId,
    ]);
    return { user: rows[0], created: true };
  });
}

export async function getUserById(userId) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return rows[0] ?? null;
}

export async function listIdentities(userId) {
  const { rows } = await query(
    'SELECT provider, created_at FROM identities WHERE user_id = $1 ORDER BY created_at',
    [userId],
  );
  return rows;
}

/**
 * Deletes the account but deliberately NOT its tests. `tests.user_id` is
 * ON DELETE SET NULL, so a deleted account's tests fall back to being purely
 * token-owned — exactly what they were before this person ever signed up, and
 * still reachable at the same creator_token link. Losing an account should
 * never mean losing data the creator can still prove ownership of.
 */
export async function deleteUser(userId) {
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

/* -------------------------------------------------------------- magic links */

export async function createLoginToken(email, { redirectTo = null, ipHash = null } = {}) {
  const token = randomBytes(32).toString('base64url');

  await query(
    `INSERT INTO login_tokens (email, token_hash, redirect_to, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [normaliseEmail(email), hashToken(token), redirectTo, ipHash, String(MAGIC_LINK_TTL_MINUTES)],
  );

  // Requested-but-never-clicked magic links only ever hit this path, never
  // issueSessionToken — prune here too or they'd sit unpruned forever.
  pruneDeadAuthRowsSometimes();

  return token;
}

/**
 * Single-use by construction: the UPDATE only matches an unconsumed, unexpired
 * row, so two clicks race and exactly one wins. Corporate mail scanners that
 * pre-fetch every link in a message are the reason this matters.
 */
export async function consumeLoginToken(token) {
  if (!token) return null;

  const { rows } = await query(
    `UPDATE login_tokens SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
     RETURNING email, redirect_to`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

/* ---------------------------------------------------------------- claiming */

/**
 * Adopts the tests this browser created anonymously.
 *
 * Only ever touches rows where user_id IS NULL — a test that already belongs to
 * someone is never reassigned, however its token got into this cookie.
 */
export async function claimTests(userId, creatorTokens) {
  if (!creatorTokens?.length) return 0;

  const { rowCount } = await query(
    `UPDATE tests SET user_id = $1, updated_at = now()
     WHERE creator_token = ANY($2) AND user_id IS NULL`,
    [userId, creatorTokens],
  );
  return rowCount;
}

/* --------------------------------------------------------------- redirects */

/**
 * Login routes accept a `?next=`. Anything but a same-site relative path is
 * discarded — including protocol-relative `//evil.com`, which a naive
 * startsWith('/') check happily lets through.
 */
export function safeRedirect(target, fallback = '/dashboard') {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return fallback;
  if (target.startsWith('/api/')) return fallback;
  return target;
}

/* -------------------------------------------------------- OAuth state token */

/**
 * Signs a short-lived payload for the Google `state` parameter so the
 * callback can trust `next` was set by us and not tampered with in transit —
 * OAuth state is attacker-visible (it round-trips through Google), so it must
 * be signed, not just opaque.
 */
export function signState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(token, { maxAgeMs = 10 * 60 * 1000 } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', config.sessionSecret).update(body).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() - payload.t > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}
