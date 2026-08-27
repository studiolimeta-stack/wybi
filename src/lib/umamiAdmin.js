import { config } from './config.js';

/**
 * Server-side Umami API client for the /admin traffic card. Distinct from
 * `config.analytics` (the client-side tracking script) — this authenticates
 * as a real Umami login and reads back the numbers Umami's own dashboard
 * shows, so `/admin` doesn't require leaving the app to see them.
 *
 * Same "optional at boot" shape as mailer.js: without
 * UMAMI_ADMIN_USERNAME/PASSWORD configured, every export here resolves to
 * null and the caller is expected to just omit the section.
 */

// Module-level cache: one token shared across requests until it's rejected.
// A fresh login per admin-page load would work too, but this is one fetch
// instead of two on the common case.
let cachedToken = null;

async function login() {
  const res = await fetch(`${config.analyticsAdmin.apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.analyticsAdmin.username,
      password: config.analyticsAdmin.password,
    }),
  });
  if (!res.ok) throw new Error(`umami_login_failed status=${res.status}`);
  const { token } = await res.json();
  cachedToken = token;
  return token;
}

/** Retries once on a 401 — the cached token can go stale with no signal until a request fails. */
async function umamiFetch(path) {
  const call = (token) =>
    fetch(`${config.analyticsAdmin.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  let res = await call(cachedToken || (await login()));
  if (res.status === 401) res = await call(await login());
  if (!res.ok) throw new Error(`umami_request_failed path=${path} status=${res.status}`);
  return res.json();
}

/** Historical totals for the trailing window, or null if Umami admin access isn't configured/reachable. */
export async function getTrafficSummary({ days = 30 } = {}) {
  if (!config.analyticsAdmin.enabled) return null;
  const endAt = Date.now();
  const startAt = endAt - days * 24 * 60 * 60 * 1000;
  try {
    return await umamiFetch(`/api/websites/${config.analyticsAdmin.websiteId}/stats?startAt=${startAt}&endAt=${endAt}`);
  } catch (err) {
    console.error(`[umamiAdmin] getTrafficSummary failed: ${err.message}`);
    return null;
  }
}

/** Visitors active in roughly the last 5 minutes, or null if unavailable. */
export async function getActiveVisitors() {
  if (!config.analyticsAdmin.enabled) return null;
  try {
    const { visitors } = await umamiFetch(`/api/websites/${config.analyticsAdmin.websiteId}/active`);
    return visitors;
  } catch (err) {
    console.error(`[umamiAdmin] getActiveVisitors failed: ${err.message}`);
    return null;
  }
}
