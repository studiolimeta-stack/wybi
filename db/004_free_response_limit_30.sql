-- Free tier moves from 25 to 30 responses per test.
--
-- 25 never matched `config.minResponsesForRecommendation` (30), so a creator saw
-- "free up to 25 responses" and "5 more responses to go" on the same results
-- screen — the report locked before we were willing to name a best price.
-- The two numbers are now the same everywhere.
--
-- Existing rows are backfilled rather than left on their original limit: the
-- change is strictly more generous, and leaving old tests on 25 would keep the
-- exact inconsistency this migration exists to remove.

ALTER TABLE tests ALTER COLUMN free_response_limit SET DEFAULT 30;

UPDATE tests SET free_response_limit = 30 WHERE free_response_limit = 25;
