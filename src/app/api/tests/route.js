import { validateTestInput } from '../../../lib/validation.js';
import { createTest, checkRateLimit } from '../../../lib/tests.js';
import { clientIp, hashIp } from '../../../lib/ids.js';
import { rememberMyTest, ensureVisitorId } from '../../../lib/visitor.js';
import { currentUser } from '../../../lib/session.js';
import { track } from '../../../lib/events.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const ipHash = hashIp(clientIp(request.headers));
  if (!(await checkRateLimit('createTest', ipHash))) {
    return Response.json({ error: 'You have created a lot of tests recently. Try again later.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const validated = validateTestInput(body);
  if (!validated.ok) return Response.json({ errors: validated.errors }, { status: 422 });

  try {
    const user = await currentUser();
    const test = await createTest(validated.value, { sessionUserId: user?.id ?? null });
    const visitorId = await ensureVisitorId();
    await rememberMyTest(test.creator_token);
    await track('create_test_completed', {
      testId: test.id,
      visitorId,
      props: { priceCount: validated.value.prices.length, ref: body.ref || null },
    });

    return Response.json({ slug: test.slug, creatorToken: test.creator_token }, { status: 201 });
  } catch (err) {
    console.error(`create_test_failed title="${validated.value.title}": ${err.message}`);
    return Response.json({ error: 'Could not create the test. Please try again.' }, { status: 500 });
  }
}
