import { currentUser } from '../../../../../lib/session.js';
import { isAdminEmail, isValidAdminToken } from '../../../../../lib/admin.js';
import { setUserBanned } from '../../../../../lib/auth.js';

export const runtime = 'nodejs';

/**
 * The one mutating admin route in the app — everything else under /admin is
 * deliberately read-only (test moderation reuses the creator's own
 * `/api/tests/[token]` routes via the creator_token an admin can already see,
 * so it never needed a separate admin-only mutation path). Banning has no
 * such existing surface to reuse, so this exists instead. Same two doors as
 * every other admin page/route: a session on the admin allowlist, or `?key=`.
 */
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const user = await currentUser();
  const authorised = isValidAdminToken(searchParams.get('key')) || isAdminEmail(user?.email);
  if (!authorised) return Response.json({ error: 'Not authorised.' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (typeof body.banned !== 'boolean') {
    return Response.json({ error: 'Expected { banned: boolean }.' }, { status: 422 });
  }

  const target = await setUserBanned(id, body.banned);
  if (!target) return Response.json({ error: 'Not found.' }, { status: 404 });

  return Response.json({ ok: true, bannedAt: target.banned_at });
}
