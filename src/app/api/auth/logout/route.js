import { endSession } from '../../../../lib/session.js';

export const runtime = 'nodejs';

// Only ever called via fetch() from AccountSubNav's client-side logout(),
// never a plain form submit/browser navigation — a redirect response here was
// dead weight: fetch() follows redirects by default, so the caller was
// blocking on a full server-rendered homepage it immediately discarded,
// *before* doing its own router.push('/') + router.refresh(). That turned one
// click into three sequential page loads. Just confirm the session is gone;
// the client already owns navigation.
export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
