import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { query, transaction } from './db.js';

/**
 * The dev-mode stand-in for a Stripe Checkout completion. Writes the exact
 * same `payments` row shape a real webhook would (provider is 'dev_mock'
 * instead of 'stripe', so these are trivially filterable in the admin view
 * and never confusable with real revenue), and flips `is_paid` the same way.
 *
 * This exists so the unlock flow — button, request, row in `payments`,
 * `is_paid` flip, unlocked report — is exercised end to end today. When Stripe
 * is wired, this function is what the webhook handler calls into; only the
 * button's onClick target changes, from this route to a Checkout redirect.
 */
export async function recordMockPayment({ testId, userId }) {
  const reference = `mock_${randomBytes(8).toString('hex')}`;

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO payments (user_id, test_id, provider, provider_payment_id, amount, currency, status)
       VALUES ($1, $2, 'dev_mock', $3, $4, $5, 'succeeded')`,
      [userId, testId, reference, config.unlockPrice, config.unlockCurrency],
    );
    await client.query('UPDATE tests SET is_paid = true, updated_at = now() WHERE id = $1', [testId]);
  });

  return reference;
}

/**
 * Writes the real payment row once Paddle's `transaction.completed` webhook
 * confirms a charge — same row shape and same `is_paid` flip as
 * `recordMockPayment`, just `provider = 'paddle'` with Paddle's own
 * transaction id for reconciliation. Caller (the webhook route) is
 * responsible for verifying the webhook signature and checking
 * `!test.is_paid` before calling this, so a retried webhook delivery is a
 * harmless no-op rather than a duplicate charge record.
 *
 * `fee`/`earnings` are Paddle's own breakdown — what Paddle keeps and what
 * you actually keep, in the same currency/units as `amount`. Both optional:
 * the webhook payload carries them today, but this must not become a hard
 * requirement a future payload shape could silently break.
 */
export async function recordPaddlePayment({ testId, userId, transactionId, amount, currency, fee = null, earnings = null }) {
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO payments (user_id, test_id, provider, provider_payment_id, amount, currency, status, fee, earnings)
       VALUES ($1, $2, 'paddle', $3, $4, $5, 'succeeded', $6, $7)`,
      [userId, testId, transactionId, amount, currency, fee, earnings],
    );
    await client.query('UPDATE tests SET is_paid = true, updated_at = now() WHERE id = $1', [testId]);
  });
}

/**
 * Full payment history for the account page. Unlocks are per TEST, not a
 * subscription — there is no account-wide "paid" plan — so this is what "show
 * he's a paid user, with all the information" actually means here: every
 * successful purchase, which test it unlocked, and whether it was real or the
 * dev-mode stand-in.
 */
export async function listPaymentsForUser(userId) {
  const { rows } = await query(
    `SELECT p.id, p.provider, p.amount, p.currency, p.status, p.created_at,
            t.title AS test_title, t.creator_token
     FROM payments p
     JOIN tests t ON t.id = p.test_id
     WHERE p.user_id = $1 AND p.status = 'succeeded'
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows;
}
