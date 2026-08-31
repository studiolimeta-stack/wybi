import { config } from '../../../../../lib/config.js';
import { findOrCreateUserByIdentity, safeRedirect } from '../../../../../lib/auth.js';
import { startSession, claimTestsFromCookie } from '../../../../../lib/session.js';
import { clientIp, hashIp } from '../../../../../lib/ids.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

/**
 * The dev stand-in for Google's callback. Locked to 404 the instant real
 * credentials are configured — this must never be a second, spoofable way to
 * become any user once the real provider is live.
 */
export async function POST(request) {
  if (config.google.enabled) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  const name = String(form.get('name') || '').trim().slice(0, 100) || 'Test User';
  const email = String(form.get('email') || '').trim().toLowerCase();
  const next = safeRedirect(form.get('next'));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.redirect(new URL('/login?error=invalid_email', config.appUrl).toString(), 302);
  }

  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'google',
    // Prefixed so a mock identity can never collide with a real Google `sub`.
    providerUserId: `mock:${email}`,
    email,
    name,
  });

  // Same ban check as the real Google/email callbacks — the dev picker must
  // not be a way around a ban either.
  if (user.banned_at) {
    return Response.redirect(new URL('/login?error=banned', config.appUrl).toString(), 302);
  }

  const ipHash = hashIp(clientIp(request.headers));
  await startSession(user.id, { userAgent: request.headers.get('user-agent'), ipHash });
  const claimed = await claimTestsFromCookie(user.id);

  await track(created ? 'account_created' : 'login_completed', { props: { provider: 'google_mock' } });
  if (claimed > 0) await track('test_claimed', { props: { count: claimed } });

  return Response.redirect(new URL(next, config.appUrl).toString(), 302);
}
