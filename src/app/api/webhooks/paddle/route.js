import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../../../lib/config.js';
import { getTestByCreatorToken } from '../../../../lib/tests.js';
import { recordPaddlePayment } from '../../../../lib/payments.js';
import { track } from '../../../../lib/events.js';

export const runtime = 'nodejs';

/**
 * Verifies Paddle's `Paddle-Signature` header: `ts=<unix>;h1=<hex hmac>`,
 * where h1 is HMAC-SHA256 of `${ts}:${rawBody}` keyed by the notification
 * destination's signing secret. Must run against the exact raw request body —
 * parsing to JSON and re-serializing produces a different byte string and
 * would fail verification even for a genuine event.
 * https://developer.paddle.com/webhooks/signature-verification
 */
function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(';').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );
  if (!parts.ts || !parts.h1) return false;

  const expected = createHmac('sha256', secret).update(`${parts.ts}:${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parts.h1, 'hex');
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * The only thing allowed to flip `is_paid` for a real (non-mock) payment.
 * `UnlockButton`'s client-side `checkout.completed` event just tells the
 * browser to start polling GET /api/tests/[token]/unlock — the actual unlock
 * happens here, once Paddle itself confirms the charge.
 */
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('paddle-signature');

  if (!config.paddle.enabled || !verifySignature(rawBody, signature, config.paddle.webhookSecret)) {
    return Response.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  if (event.event_type === 'transaction.completed') {
    const data = event.data || {};
    const creatorToken = data.custom_data?.creatorToken;
    const test = creatorToken ? await getTestByCreatorToken(creatorToken) : null;

    // Missing test (stale/garbage custom_data) or already paid (retried
    // delivery, or the same transaction firing more than once) — both are
    // silent no-ops, not errors: Paddle should not retry-storm us for either.
    if (test && !test.is_paid) {
      const totals = data.details?.totals || {};
      // Same object, same minor-units-to-decimal conversion as `total` below —
      // Paddle already sends these on every transaction.completed payload,
      // this just stops discarding them. Both null if Paddle ever omits them
      // (payload shape isn't a stable contract to build a hard requirement on).
      const toDecimal = (minorUnits) => (minorUnits != null ? Number(minorUnits) / 100 : null);
      await recordPaddlePayment({
        testId: test.id,
        userId: test.user_id,
        transactionId: data.id,
        amount: toDecimal(totals.total) ?? config.unlockPrice,
        currency: data.currency_code || config.unlockCurrency,
        fee: toDecimal(totals.fee),
        earnings: toDecimal(totals.earnings),
      });
      await track('report_unlocked', { testId: test.id, props: { mock: false } });

      // A report unlock is a single boolean flip — there is no product
      // meaning to buying more than one. The Paddle Price should have
      // quantity capped at 1 (dashboard setting), but that's config, not
      // code, so it can drift. If a transaction ever slips through with
      // quantity > 1, the customer was charged for units that bought them
      // nothing extra — surface it instead of silently pocketing it, so it
      // can be manually refunded.
      const totalQuantity = (data.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      if (totalQuantity > 1) {
        await track('paddle_unexpected_quantity', {
          testId: test.id,
          props: { transactionId: data.id, quantity: totalQuantity, amount: toDecimal(totals.total) },
        });
      }
    }
  }

  // 200 for every verified event, including types we don't act on yet
  // (transaction.created, etc.) — an unhandled-but-verified event is not a
  // failure, and returning non-2xx here just makes Paddle retry it forever.
  return Response.json({ ok: true });
}
