import { currentUser, endSession } from '../../../../lib/session.js';
import { revokeAllSessions } from '../../../../lib/auth.js';

export const runtime = 'nodejs';

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  await revokeAllSessions(user.id);
  // Including this browser's own session, so clear its cookie too rather than
  // leaving it pointing at a session that's now dead.
  await endSession();
  return Response.json({ ok: true });
}
