-- Accounts: sessions, identities, magic-link tokens.
--
-- Design notes:
--  * Accounts are ADDITIVE. `creator_token` in the URL stays the real access key,
--    so every link already shared keeps working with no session. Logging in only
--    makes the creator's list of tests durable across browsers and devices.
--  * `identities` is a table rather than columns on `users` so a third login
--    method never needs another migration. Magic link is modelled as
--    provider='email', provider_user_id=<the address> — that way Google and
--    email run through exactly one code path.
--  * Session tokens are stored as SHA-256 hashes. A database leak must not hand
--    over live sessions.

ALTER TABLE users ADD COLUMN IF NOT EXISTS name          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS identities (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('google', 'email')),
  provider_user_id TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS identities_user_idx ON identities(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 of the cookie value, never the value itself.
  token_hash   TEXT NOT NULL UNIQUE,

  user_agent   TEXT,
  ip_hash      TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Magic-link tokens are keyed on EMAIL, not user_id: the account is created when
-- the link is clicked, never when it is requested. Otherwise anyone could
-- conjure user rows for addresses they do not control just by typing them in.
CREATE TABLE IF NOT EXISTS login_tokens (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,

  -- Relative path to land on after verifying. Validated against an allowlist
  -- before use — an open redirect on a login route is a phishing gift.
  redirect_to TEXT,

  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS login_tokens_email_idx ON login_tokens(email, created_at);

-- The dashboard's owned-tests query.
CREATE INDEX IF NOT EXISTS tests_user_idx ON tests(user_id, created_at DESC);
