-- Rate-limit counters for email-OTP sign-in (Better Auth limiter + src/lib/throttle.server.ts).
CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  last_request INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_key_idx ON rate_limit(key);
