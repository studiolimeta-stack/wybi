import { currentUser } from '../../../../../lib/session.js';
import { getPaymentForUser } from '../../../../../lib/payments.js';
import { config } from '../../../../../lib/config.js';

export const runtime = 'nodejs';

/**
 * Hands a signed-in creator to Paddle's own hosted PDF receipt for one of
 * their payments — Paddle is the merchant of record and already emails this
 * same document automatically on `transaction.completed` (see Development
 * Guidelines → Before public launch), this just makes it reachable from
 * /account without digging through inbox history.
 *
 * The URL Paddle returns expires after ~1 hour, so it is never stored —
 * every click is a fresh API call, then a redirect straight to Paddle.
 * `dev_mock` payments have no real Paddle transaction to fetch and 404.
 */
export async function GET(request, { params }) {
  const { paymentId } = await params;
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  const payment = await getPaymentForUser(paymentId, user.id);
  if (!payment || payment.provider !== 'paddle' || !payment.provider_payment_id) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  if (!config.paddle.enabled) {
    return Response.json({ error: 'Paddle is not configured.' }, { status: 503 });
  }

  const paddleRes = await fetch(
    `${config.paddle.apiBaseUrl}/transactions/${payment.provider_payment_id}/invoice`,
    { headers: { Authorization: `Bearer ${config.paddle.apiKey}` } },
  );
  if (!paddleRes.ok) {
    return Response.json({ error: 'Could not retrieve receipt from Paddle.' }, { status: 502 });
  }

  const { data } = await paddleRes.json();
  if (!data?.url) {
    return Response.json({ error: 'Could not retrieve receipt from Paddle.' }, { status: 502 });
  }

  return Response.redirect(data.url, 302);
}
