import { config } from '../../../../../lib/config.js';
import { signState, safeRedirect } from '../../../../../lib/auth.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

const SCOPE = 'openid email profile';

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeRedirect(url.searchParams.get('next'));
  const mode = url.searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  await track('login_started', { props: { provider: 'google', mode } });

  // Not configured yet: send the same request through the real code path's
  // dev fallback rather than a different one — same session, same claiming,
  // same redirect, just no Google in the middle.
  if (!config.google.enabled) {
    const mockUrl = new URL('/auth/mock/google', config.appUrl);
    mockUrl.searchParams.set('next', next);
    mockUrl.searchParams.set('mode', mode);
    return Response.redirect(mockUrl.toString(), 302);
  }

  const state = signState({ next, mode });
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.google.clientId);
  authUrl.searchParams.set('redirect_uri', `${config.appUrl}/api/auth/google/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  return Response.redirect(authUrl.toString(), 302);
}
