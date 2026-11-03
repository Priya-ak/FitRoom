# Accounts: email + password + one-time code

## How it works

| Action | Steps |
|---|---|
| Create account | name, email, password -> 6-digit code emailed -> enter code -> email verified and signed in |
| Sign in | email, password (checked on the server) -> 6-digit code emailed -> enter code -> signed in |
| Forgot password | email -> code emailed -> enter code + new password |

Codes are 6 digits, expire after 5 minutes, are stored hashed, and are burned after 3 wrong guesses.

Security rules enforced in `src/lib/auth.ts`:

- `POST /api/auth/sign-in/email` (password only) is refused over HTTP.
- Asking for a `sign-in` code over HTTP is refused. The only way to get one is `beginSignIn` (`src/server/auth-flow.ts`), which sends a code only after the password is verified.
- A code alone can never create an account (`disableSignUp`).
- Rate limits are stored in the database (`rate_limit` table): 5 password attempts per email and 30 per IP per 15 minutes; 3 code emails per minute; 10 code checks per minute.
- Unknown email and wrong password look identical, and both do one password hash (no timing leak).

## Services

- **Resend** sends the emails. Without a verified domain Resend only delivers to the email address of your own Resend account (fine for testing). To email real users: Resend -> Domains -> add and verify a domain, then set `RESEND_FROM="FitRoom <no-reply@yourdomain.com>"`.
- **Turso** stores users, sessions, codes and rate limits (the Cloudflare D1 binding is not available on Netlify).

## Setup

1. `npm install` (adds `@libsql/client`), then commit the updated `package-lock.json`.
2. Turso: create a database, copy its URL (`libsql://...`) and create a token.
3. Create tables: set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your terminal and run `npm run db:migrate:turso`.
4. Resend: create an API key.
5. Netlify -> Environment variables (mark as secret, scopes Builds/Functions/Runtime): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM`; keep `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL=https://fitroom-ai.netlify.app`. Remove `MONSTARX_DATA_URL` / `MONSTARX_DATA_TOKEN` (Turso takes priority, but leaving them is confusing).
6. Redeploy.

## Known limits

- Existing users created before this change are unverified: their first sign-in sends an email-verification code, after which they are verified.
- Google sign-in (if configured) bypasses the code step by design (Google proves the identity).
- The password is kept in browser memory between the two steps (so "Resend code" works) and is cleared on success.
