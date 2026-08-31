import { config } from '../../../../../lib/config.js';
import { consumeLoginToken, findOrCreateUserByIdentity, safeRedirect } from '../../../../../lib/auth.js';
import { startSession, claimTestsFromCookie } from '../../../../../lib/session.js';
import { clientIp, hashIp } from '../../../../../lib/ids.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  const claimResult = await consumeLoginToken(token);
  if (!claimResult) {
    return Response.redirect(new URL('/login?error=expired_link', config.appUrl).toString(), 302);
  }

  const { user, created } = await findOrCreateUserByIdentity({
    provider: 'email',
    providerUserId: claimResult.email,
    email: claimResult.email,
  });

  // Same ban check as the Google callback — a clicked magic link must not
  // hand a banned account a fresh session either.
  if (user.banned_at) {
    return Response.redirect(new URL('/login?error=banned', config.appUrl).toString(), 302);
  }

  const ipHash = hashIp(clientIp(request.headers));
  await startSession(user.id, { userAgent: request.headers.get('user-agent'), ipHash });
  const claimed = await claimTestsFromCookie(user.id);

  await track(created ? 'account_created' : 'login_completed', { props: { provider: 'email' } });
  if (claimed > 0) await track('test_claimed', { props: { count: claimed } });

  const next = safeRedirect(claimResult.redirect_to);
  return Response.redirect(new URL(next, config.appUrl).toString(), 302);
}
