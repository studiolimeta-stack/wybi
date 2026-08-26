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

  if (config.stripe.enabled) {
    // Real checkout is a separate build once pricing/webhook handling is
    // decided — deliberately not stubbed further than this, so it fails
    // loudly instead of quietly pretending to charge a card.
    return Response.json({ error: 'Card checkout is not implemented yet.' }, { status: 501 });
  }

  await recordMockPayment({ testId: test.id, userId: test.user_id });
  await track('report_unlocked', { testId: test.id, props: { mock: true } });

  return Response.json({ ok: true, mock: true });
}
