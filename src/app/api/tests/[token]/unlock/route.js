import { config } from '../../../../../lib/config.js';
import { getTestByCreatorToken } from '../../../../../lib/tests.js';
import { recordMockPayment } from '../../../../../lib/payments.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

// Same authorisation model as the other /api/tests/[token] routes: the
// creator_token in the URL IS the credential.
export async function POST(request, { params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (test.is_paid) return Response.json({ ok: true, alreadyPaid: true });

  if (config.paddle.enabled) {
    // Real purchases run through the Paddle Checkout overlay client-side
    // (see UnlockButton) and are confirmed by the `transaction.completed`
    // webhook at /api/webhooks/paddle, which is the only thing allowed to
    // flip `is_paid`. POSTing here while Paddle is live would let anyone with
    // a creator_token unlock a report for free, so it's refused outright.
    return Response.json({ error: 'Use Paddle Checkout to unlock this report.' }, { status: 400 });
  }

  await recordMockPayment({ testId: test.id, userId: test.user_id });
  await track('report_unlocked', { testId: test.id, props: { mock: true } });

  return Response.json({ ok: true, mock: true });
}

// Polled by the client after the Paddle Checkout overlay reports
// `checkout.completed` — that client-side event is not proof of payment, so
// this just reports whatever the webhook has (or hasn't) already confirmed.
export async function GET(request, { params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ paid: test.is_paid });
}
