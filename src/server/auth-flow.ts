// First step of sign-in: check the password, and only then email a one-time code.
// The second step (entering the code) is Better Auth's `signIn.emailOtp`, which creates the session.
// Direct HTTP sign-in with a password alone, or asking for a sign-in code without the password, is refused in
// src/lib/auth.ts, so this function is the only way to get a sign-in code.
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getAuth } from '@/lib/auth'
import { throttle } from '@/lib/throttle.server'

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
})

export type BeginSignInResult =
  | { status: 'code_sent'; purpose: 'sign-in' | 'email-verification' }
  | { status: 'invalid' }
  | { status: 'too_many' }
  | { status: 'error' }

function clientIp(): string {
  const headers = getRequestHeaders() as unknown as Headers | Record<string, string | undefined>
  const get = (name: string) => (typeof (headers as Headers).get === 'function' ? (headers as Headers).get(name) : (headers as Record<string, string | undefined>)[name])
  return get('x-nf-client-connection-ip') || get('cf-connecting-ip') || get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export const beginSignIn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as z.infer<typeof inputSchema>)
  .handler(async ({ data }): Promise<BeginSignInResult> => {
    const parsed = inputSchema.safeParse(data)
    if (!parsed.success) return { status: 'invalid' }
    const { email, password } = parsed.data
    try {
      const allowed = (await throttle(`signin:email:${email}`, 5, 15 * 60)) && (await throttle(`signin:ip:${clientIp()}`, 30, 15 * 60))
      if (!allowed) return { status: 'too_many' }

      const auth = await getAuth()
      const ctx = await auth.$context
      const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true })
      const credential = found?.accounts.find((account) => account.providerId === 'credential')
      // Always do one password hash/verify, so a missing account is not detectable by timing.
      const passwordOk = credential?.password
        ? await ctx.password.verify({ hash: credential.password, password })
        : (await ctx.password.hash(password), false)
      if (!found || !passwordOk || found.user.banned) return { status: 'invalid' }

      const purpose = found.user.emailVerified ? 'sign-in' : 'email-verification'
      // A server-side call has no HTTP request, so it passes the guard in src/lib/auth.ts.
      await auth.api.sendVerificationOTP({ body: { email, type: purpose } })
      return { status: 'code_sent', purpose }
    } catch (error) {
      console.error('[fitroom] sign-in step 1 failed', error instanceof Error ? error.message : error)
      return { status: 'error' }
    }
  })
