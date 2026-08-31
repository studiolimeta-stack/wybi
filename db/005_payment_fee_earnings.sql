-- Paddle's own fee/net-earnings breakdown, per payment. Paddle's webhook
-- payload already carries these on `details.totals` (fee, earnings) — this
-- was previously received and discarded. Nullable and provider-specific on
-- purpose: `dev_mock` rows have no real Paddle transaction behind them, so
-- there is no honest fee/earnings to backfill for those, ever.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS earnings NUMERIC(12,2);
