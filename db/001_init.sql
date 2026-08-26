-- Would You Buy It? — initial schema
-- Design notes:
--  * Creator access in V1 is a secret token in the URL (no email provider wired yet).
--    `users` exists so magic-link auth can be layered on without a data migration.
--  * `price_assignments` pins a visitor to one price on FIRST VIEW so a refresh can
--    never show a different price (that would leak the price ladder and bias answers).

CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,

  slug                TEXT NOT NULL UNIQUE,
  creator_token       TEXT NOT NULL UNIQUE,

  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  included_items      TEXT,
  image_url           TEXT,
  product_url         TEXT,

  currency            TEXT NOT NULL DEFAULT 'EUR',
  billing_type        TEXT NOT NULL DEFAULT 'one_time'
                      CHECK (billing_type IN ('one_time','per_month','per_year')),

  ask_suggested_price BOOLEAN NOT NULL DEFAULT TRUE,
  ask_confidence      BOOLEAN NOT NULL DEFAULT TRUE,

  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('draft','active','paused','completed','archived')),

  -- Responses keep accruing past the free limit; only the ANALYSIS locks.
  -- That is what makes the paywall land after the creator already has data.
  free_response_limit INTEGER NOT NULL DEFAULT 25,
  is_paid             BOOLEAN NOT NULL DEFAULT FALSE,

  reported_count      INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_variants (
  id         BIGSERIAL PRIMARY KEY,
  test_id    BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  position   INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, amount)
);
CREATE INDEX IF NOT EXISTS price_variants_test_idx ON price_variants(test_id);

-- One row per visitor per test, written on first view.
CREATE TABLE IF NOT EXISTS price_assignments (
  test_id          BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  visitor_id       TEXT NOT NULL,
  price_variant_id BIGINT NOT NULL REFERENCES price_variants(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (test_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS responses (
  id               BIGSERIAL PRIMARY KEY,
  test_id          BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  price_variant_id BIGINT NOT NULL REFERENCES price_variants(id) ON DELETE CASCADE,

  answer           TEXT NOT NULL CHECK (answer IN ('yes','no')),
  confidence       TEXT CHECK (confidence IN ('maybe','probably','would_pay')),

  suggested_price  NUMERIC(12,2) CHECK (suggested_price IS NULL OR suggested_price >= 0),

  visitor_id       TEXT NOT NULL,
  ip_hash          TEXT,

  referrer         TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  device_type      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The core anti-refresh guard. Not fraud-proof by design (§18).
  UNIQUE (test_id, visitor_id)
);
CREATE INDEX IF NOT EXISTS responses_test_idx    ON responses(test_id);
CREATE INDEX IF NOT EXISTS responses_variant_idx ON responses(price_variant_id);

CREATE TABLE IF NOT EXISTS payments (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
  test_id             BIGINT REFERENCES tests(id) ON DELETE SET NULL,
  provider            TEXT NOT NULL,
  provider_payment_id TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  test_id    BIGINT REFERENCES tests(id) ON DELETE CASCADE,
  visitor_id TEXT,
  props      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_name_idx    ON events(name, created_at);
CREATE INDEX IF NOT EXISTS events_test_idx    ON events(test_id);

CREATE TABLE IF NOT EXISTS test_reports (
  id         BIGSERIAL PRIMARY KEY,
  test_id    BIGINT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  reason     TEXT,
  visitor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cheap per-IP throttle for test creation and responses.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  bucket     TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_idx ON rate_limit_hits(bucket, ip_hash, created_at);
