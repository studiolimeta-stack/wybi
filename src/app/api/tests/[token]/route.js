import { getTestByCreatorToken, setTestStatus, deleteTest } from '../../../../lib/tests.js';

export const runtime = 'nodejs';

// The creator token in the URL is the authorisation. It is 32 random bytes and
// never leaves the creator's browser, so possession of it proves ownership.
const ALLOWED_STATUSES = new Set(['active', 'paused', 'completed']);

export async function PATCH(request, { params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(body.status)) {
    return Response.json({ error: 'Unsupported status.' }, { status: 422 });
  }

  await setTestStatus(test.id, body.status);
  return Response.json({ ok: true, status: body.status });
}

export async function DELETE(request, { params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });

  await deleteTest(test.id);
  return Response.json({ ok: true });
}
