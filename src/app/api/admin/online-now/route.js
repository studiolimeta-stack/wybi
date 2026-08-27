import { currentUser } from '../../../../lib/session.js';
import { isAdminEmail, isValidAdminToken } from '../../../../lib/admin.js';
import { getActiveVisitors } from '../../../../lib/umamiAdmin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Polled client-side by components/OnlineNow.js so the /admin traffic card
 * ticks without a full page reload. Same two doors as /admin itself
 * (session or ?key=) — this exposes nothing the admin page doesn't already
 * show, just more often.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const user = await currentUser();
  const authorised = isValidAdminToken(searchParams.get('key')) || isAdminEmail(user?.email);
  if (!authorised) return Response.json({ error: 'Not authorised.' }, { status: 403 });

  const visitors = await getActiveVisitors();
  return Response.json({ visitors });
}
