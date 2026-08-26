import { currentUser, endSession } from '../../../../lib/session.js';
import { deleteUser } from '../../../../lib/auth.js';
import { track } from '../../../../lib/events.js';

export const runtime = 'nodejs';

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  await deleteUser(user.id);
  await endSession();
  await track('account_deleted');

  return Response.json({ ok: true });
}
