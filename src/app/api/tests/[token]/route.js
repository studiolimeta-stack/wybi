import { getTestByCreatorToken, setTestStatus, deleteTest } from '../../../../lib/tests.js';

export const runtime = 'nodejs';

// The creator token in the URL is the authorisation: 32 random bytes, so
// possession of it is taken as proof of ownership. There is no second factor
// and no session check — which means the token is only as private as the
// places it is rendered. It leaked once already, serialised into the RSC
// payload of the public respondent page by passing a raw `SELECT *` row to a
// client component, which handed every respondent full read/export/pause/delete
// on the test. Anything crossing a client boundary on a public page must go
// through `publicTestView` (lib/tests.js), never the raw row.
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
