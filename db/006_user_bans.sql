-- Admin ability to ban an abusive account.
--
-- `banned_at` follows the same nullable-timestamp pattern already used for
-- sessions.revoked_at / login_tokens.consumed_at, rather than a boolean — it
-- records *when* someone was banned for free and reads the same way ("is this
-- set?") everywhere it's checked.

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
