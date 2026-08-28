import { getTestByCreatorToken } from '../../../../../lib/tests.js';
import { claimTests } from '../../../../../lib/auth.js';
import { currentUser } from '../../../../../lib/session.js';

export const runtime = 'nodejs';

/**
 * Explicit cross-device claim (spec §15) — a logged-in creator confirming
 * "yes, attach this anonymous test to my account" from `/r/[token]`.
 * Different authorisation model from the other `/api/tests/[token]/*`
 * routes: those treat possession of the creator_token as sufficient, but
 * *mutating ownership* requires a real authenticated session, not just the
 * token in the URL.
 *
 * Reuses `claimTests` unchanged — the same `WHERE ... AND user_id IS NULL`
 * guard that backs cookie-based claiming, so a test that already belongs to
 * someone (this account or another one) is never reassigned.
 */
export async function POST(request, { params }) {
  const { token } = await params;

  const user = await currentUser();
  if (!user) return Response.json({ error: 'You need to be logged in to do that.' }, { status: 401 });

  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });

  if (test.user_id === user.id) return Response.json({ ok: true, alreadyOwned: true });
  if (test.user_id !== null) {
    return Response.json({ error: 'This test already belongs to another account.' }, { status: 409 });
  }

  const claimed = await claimTests(user.id, [token]);
  if (!claimed) {
    return Response.json({ error: 'This test already belongs to another account.' }, { status: 409 });
  }

  return Response.json({ ok: true });
}
