-- Idempotency backstop for the Paddle webhook.
--
-- recordPaddlePayment() is only called after the webhook checks `!test.is_paid`,
-- which stops the ordinary sequential retry. It does NOT stop two concurrent
-- deliveries of the same `transaction.completed` both passing that check and
-- writing two `payments` rows for one charge — which then double-counts in the
-- /admin revenue and earnings totals.
--
-- A partial unique index makes the second INSERT a no-op (paired with
-- `ON CONFLICT DO NOTHING` in recordPaddlePayment). Partial, and keyed on
-- (provider, provider_payment_id), so it only constrains rows that actually
-- carry a provider transaction id: legacy rows with a NULL provider_payment_id
-- are untouched, and dev_mock references (random hex) never collide.

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_txn_key
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
