import { isAdminEmail, isValidAdminToken } from './admin.js';

/**
 * The one auth rule shared by every /admin/* page. Each page still calls this
 * itself — Next.js layouts don't receive `searchParams`, only leaf pages do,
 * so there's no single choke point to put this behind — but the RULE lives in
 * exactly one place instead of four copies that could drift.
 */
export function checkAdminAccess({ key, user }) {
  const viaToken = isValidAdminToken(key);
  const authorized = viaToken || isAdminEmail(user?.email);
  return { authorized, viaToken };
}

/**
 * Carries the `?key=` token through to another admin page when that's how the
 * visitor got in — a session doesn't need one, and re-appending a stale/absent
 * key would break the next click for a session-authed visit. Shared so every
 * admin page (and the nav dropdown) builds cross-links the same way.
 */
export function adminHref(path, { viaToken, key } = {}, extra = {}) {
  const params = new URLSearchParams();
  if (viaToken) params.set('key', key);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}
