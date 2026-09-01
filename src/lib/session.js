/**
 * The request-scoped session surface — the only module that reads or writes the
 * session cookie. Everything it delegates to lives in src/lib/auth.js.
 *
 * Split for the same reason src/lib/visitor.js is separate: `next/headers` is
 * only resolvable inside the Next runtime, so keeping it out of the data layer
 * is what lets the account logic be unit-tested at all.
 */
import { cache } from 'react';
import { cookies } from 'next/headers';
import { issueSessionToken, lookupSession, revokeSessionByToken, claimTests } from './auth.js';
import { readMyTestTokens } from './visitor.js';

export const SESSION_COOKIE = 'wyby_session';

/**
 * The cookie deliberately outlives the database row. `sessions.expires_at` is
 * the real authority and slides forward on use; the cookie is written once,
 * long enough that an active user is never logged out by the browser's clock.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 120;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: true,
  path: '/',
  maxAge: COOKIE_MAX_AGE,
};

/**
 * Route handlers and server actions only — Next forbids writing cookies during
 * a server-component render, the same constraint that put the visitor cookie in
 * src/proxy.js.
 */
export async function startSession(userId, { userAgent = null, ipHash = null } = {}) {
  const token = await issueSessionToken(userId, { userAgent, ipHash });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions);
  return token;
}

/**
 * The current user, or null. Memoised per request, so a page that asks in the
 * header and again in the body costs one query.
 *
 * Never writes a cookie: this runs inside server components. An expired session
 * therefore just reads as logged out, and the stale cookie is cleared on the
 * next route handler that touches it.
 */
export const currentUser = cache(async () => {
  const store = await cookies();
  return lookupSession(store.get(SESSION_COOKIE)?.value);
});

export async function endSession() {
  const store = await cookies();
  await revokeSessionByToken(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}

/**
 * Called on every successful login: whatever this browser created before
 * signing up is already in the dashboard afterwards. That is the whole reason
 * logging in feels worth doing.
 */
export async function claimTestsFromCookie(userId) {
  return claimTests(userId, await readMyTestTokens());
}
