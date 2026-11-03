// SERVER-ONLY. Better Auth for this app's users, stored in the app's own database.
// Email + password is enabled; the users can be managed from MonstarX's Backend tab.
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { admin, emailOTP, genericOAuth, oauthPopup } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import * as authSchema from '../db/auth-schema'
import { framedSignIn } from './auth-popup'
import { getDb } from './db'
import { sendEmail, otpEmail, type OtpPurpose } from './email'

async function create() {
  const db = await getDb()
  // Continue with Google, when the owner turns it on in MonstarX (Backend → Cloud → Auth). MonstarX sets either the
  // owner's own Google app (MONSTARX_GOOGLE_*) or MonstarX Google, which signs in through MonstarX (MONSTARX_SIGN_IN_*).
  // Both are the provider `google`: `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`.
  const googleClientId = process.env.MONSTARX_GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.MONSTARX_GOOGLE_CLIENT_SECRET
  const signInUrl = process.env.MONSTARX_SIGN_IN_URL
  const signInClientId = process.env.MONSTARX_SIGN_IN_CLIENT_ID
  const signInSecret = process.env.MONSTARX_SIGN_IN_SECRET
  const monstarxGoogle =
    !(googleClientId && googleClientSecret) && signInUrl && signInClientId && signInSecret
      ? [
          genericOAuth({
            config: [
              {
                providerId: 'google',
                clientId: signInClientId,
                clientSecret: signInSecret,
                authorizationUrl: `${signInUrl}/authorize`,
                tokenUrl: `${signInUrl}/token`,
                userInfoUrl: `${signInUrl}/userinfo`,
                scopes: ['openid', 'email', 'profile'],
                pkce: true,
              },
            ],
          }),
        ]
      : []
  // Inside a frame (the MonstarX preview) Google sign-in runs in a pop-up: ./auth-popup.ts.
  const google = Boolean(googleClientId && googleClientSecret) || monstarxGoogle.length > 0
  const popup = google ? [framedSignIn(), oauthPopup()] : []
  return betterAuth({
    appName: 'FitRoom',
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // An account must prove it owns its email (OTP) before it gets a session.
      requireEmailVerification: true,
      // Password reset works out of the box: the link is emailed through MonstarX's email service.
      sendResetPassword: async ({ user, url }) => {
        try {
          await sendEmail({
            to: user.email,
            subject: 'Reset your password',
            text: `Hi ${user.name || 'there'},\n\nReset your password with this link (valid for one hour):\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
          })
        } catch (error) {
          console.error('[fitroom] password reset email not sent', error)
          console.info('[fitroom] password reset URL for', user.email, url)
        }
      },
    },
    ...(googleClientId && googleClientSecret ? { socialProviders: { google: { clientId: googleClientId, clientSecret: googleClientSecret, prompt: 'select_account' as const } } } : {}),
    // Someone who signed up with email and later continues with Google (same verified address) stays one user.
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    // Verifying the email at sign-up: the code replaces the default link. A user who signs up and enters the code is signed in.
    emailVerification: { autoSignInAfterVerification: true },
    plugins: [
      admin(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300, // seconds
        allowedAttempts: 3, // wrong guesses before the code is burned
        storeOTP: 'hashed',
        disableSignUp: true, // a code alone can never create an account
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp, type }) {
          try {
            await sendEmail({ to: email, ...otpEmail(otp, type as OtpPurpose) })
          } catch (error) {
            console.error('[fitroom] otp email not sent', type, error instanceof Error ? error.message : error)
            throw new APIError('INTERNAL_SERVER_ERROR', { message: 'We could not send the code. Please try again in a moment.' })
          }
        },
      }),
      ...monstarxGoogle,
      ...popup,
      tanstackStartCookies(),
    ],
    // Password + code: a password alone must never open a session, and a code must only ever be sent after the password
    // was checked. Both are enforced here, on the server, for every HTTP caller; the sign-in form uses
    // src/server/auth-flow.ts (server-side calls carry no HTTP request and are let through).
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.request) return
        if (ctx.path === '/sign-in/email') {
          throw new APIError('FORBIDDEN', { message: 'Sign in with your password and the code we email you.' })
        }
        if (ctx.path === '/email-otp/send-verification-otp' && (ctx.body as { type?: string } | undefined)?.type === 'sign-in') {
          throw new APIError('FORBIDDEN', { message: 'Enter your password first.' })
        }
      }),
    },
    // Counters live in the database (serverless instances share nothing in memory).
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/email-otp/verify-email': { window: 60, max: 10 },
        '/sign-in/email-otp': { window: 60, max: 10 },
        '/email-otp/reset-password': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    // A MonstarX preview runs in a frame of the MonstarX workspace, on another site, where browsers drop SameSite=Lax
    // cookies: sign-in would create a session the app never sees again. Previews use cross-site cookies partitioned to
    // the workspace; published apps keep Better Auth's first-party defaults.
    advanced: {
      // The real client address behind Netlify / Cloudflare, for rate limits.
      ipAddress: { ipAddressHeaders: ['x-nf-client-connection-ip', 'cf-connecting-ip', 'x-forwarded-for'] },
      ...(process.env.MONSTARX_PREVIEW === '1' ? { defaultCookieAttributes: { sameSite: 'none' as const, secure: true, partitioned: true } } : {}),
    },
  })
}

export type AppAuth = Awaited<ReturnType<typeof create>>

let instance: Promise<AppAuth> | null = null

export function getAuth(): Promise<AppAuth> {
  instance ??= create().catch((error: unknown) => {
    instance = null
    throw error
  })
  return instance
}
