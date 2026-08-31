import { config } from '../../../../../lib/config.js';
import { verifyState, findOrCreateUserByIdentity, safeRedirect } from '../../../../../lib/auth.js';
import { startSession, claimTestsFromCookie } from '../../../../../lib/session.js';
import { clientIp, hashIp } from '../../../../../lib/ids.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

/**
 * Real Google OAuth only. Returns 404 while `config.google.enabled` is false
 * so this can never be reached instead of the dev picker — the mock identity
 * flow lives at /api/auth/mock/google and is itself locked out once real
 * credentials land (see that route). Two paths that create sessions must
 * never both be live at once.
 */
export async function GET(request) {
  if (!config.google.enabled) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = verifyState(url.searchParams.get('state'));

  if (!code || !state) {
    return Response.redirect(new URL('/login?error=oauth_failed', config.appUrl).toString(), 302);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: `${config.appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const { access_token: accessToken } = await tokenRes.json();

    // Userinfo over a token we just exchanged ourselves, rather than decoding
    // the id_token JWT locally — that would need a JOSE/JWKS dependency this
    // project deliberately doesn't carry (see Development Guidelines, rule 7).
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error(`userinfo failed: ${profileRes.status}`);
    const profile = await profileRes.json();

    if (!profile.email_verified) {
      return Response.redirect(new URL('/login?error=email_unverified', config.appUrl).toString(), 302);
    }

    const { user, created } = await findOrCreateUserByIdentity({
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email,
      name: profile.name || null,
      avatarUrl: profile.picture || null,
    });

    // A banned account must never get a new session — lookupSession already
    // refuses any session this account holds, but that only matters once one
    // exists. Checked here, not inside findOrCreateUserByIdentity, because
    // that function is a pure identity resolver with no auth-policy opinion.
    if (user.banned_at) {
      return Response.redirect(new URL('/login?error=banned', config.appUrl).toString(), 302);
    }

    const ipHash = hashIp(clientIp(request.headers));
    await startSession(user.id, { userAgent: request.headers.get('user-agent'), ipHash });
    const claimed = await claimTestsFromCookie(user.id);

    await track(created ? 'account_created' : 'login_completed', { props: { provider: 'google' } });
    if (claimed > 0) await track('test_claimed', { props: { count: claimed } });

    return Response.redirect(new URL(safeRedirect(state.next), config.appUrl).toString(), 302);
  } catch (err) {
    console.error(`google_oauth_failed: ${err.message}`);
    return Response.redirect(new URL('/login?error=oauth_failed', config.appUrl).toString(), 302);
  }
}
