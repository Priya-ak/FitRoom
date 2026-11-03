<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Loader2, LogIn, LogOut, MailCheck, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { getSessionUser, getSignInOptions } from '@/lib/session'
import { beginSignIn } from '@/server/auth-flow'
=======
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, LogIn, LogOut, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { getSessionUser, getSignInOptions } from '@/lib/session'
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
import { listUserFits } from '@/server/fits'

export const Route = createFileRoute('/account')({
  loader: async () => {
    const [user, options, remoteFits] = await Promise.all([getSessionUser(), getSignInOptions(), listUserFits()])
    return { user, options, remoteFits }
  },
  component: AccountPage,
})

<<<<<<< HEAD
type Mode = 'signin' | 'signup' | 'reset'
type Purpose = 'sign-in' | 'email-verification' | 'forget-password'

const RESEND_SECONDS = 30
const inputClass = 'mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-[#111111]'

function AccountPage() {
  const { user: loaderUser, options, remoteFits } = Route.useLoaderData()
  const session = authClient.useSession()
  const router = useRouter()
  const user = session.data?.user ?? loaderUser
  const [mode, setMode] = useState<Mode>('signin')
  // 'form' = email/password, 'code' = the 6-digit code we emailed.
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [purpose, setPurpose] = useState<Purpose>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
=======
function AccountPage() {
  const { user: loaderUser, options, remoteFits } = Route.useLoaderData()
  const session = authClient.useSession()
  const user = session.data?.user ?? loaderUser
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

<<<<<<< HEAD
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function switchMode(next: Mode) {
    setMode(next)
    setStep('form')
    setCode('')
    setPassword('')
    setError('')
    setNotice('')
  }

  function goToCode(nextPurpose: Purpose) {
    setPurpose(nextPurpose)
    setStep('code')
    setCode('')
    setCooldown(RESEND_SECONDS)
    setNotice(`We emailed a 6-digit code to ${email}. It expires in 5 minutes.`)
  }

  const signInMessage = (status: string) =>
    status === 'invalid' ? 'Incorrect email or password.' : status === 'too_many' ? 'Too many attempts. Please wait a few minutes and try again.' : 'Something went wrong. Please try again.'

  /** Step 1 of every flow: the form is valid -> a code is emailed. */
  async function submitForm(e: React.FormEvent) {
=======
  async function submit(e: React.FormEvent) {
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
    e.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({ name: name.trim() || email.split('@')[0] || 'Guest', email, password })
        if (result.error) throw new Error(result.error.message || 'Could not create the account.')
<<<<<<< HEAD
        goToCode('email-verification')
      } else if (mode === 'signin') {
        const result = await beginSignIn({ data: { email, password } })
        if (result.status !== 'code_sent') throw new Error(signInMessage(result.status))
        goToCode(result.purpose)
      } else {
        const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' })
        if (result.error) throw new Error(result.error.message || 'Could not send the code.')
        goToCode('forget-password')
=======
        setNotice('Account created. You are signed in.')
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) throw new Error(result.error.message || 'Could not sign in.')
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

<<<<<<< HEAD
  /** Step 2: the code. */
  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code.')
      return
    }
    setPending(true)
    try {
      if (purpose === 'forget-password') {
        const result = await authClient.emailOtp.resetPassword({ email, otp: code, password })
        if (result.error) throw new Error(result.error.message || 'That code is not valid.')
        switchMode('signin')
        setPassword('')
        setNotice('Password updated. Sign in with your new password.')
        return
      }
      const result =
        purpose === 'email-verification'
          ? await authClient.emailOtp.verifyEmail({ email, otp: code })
          : await authClient.signIn.emailOtp({ email, otp: code })
      if (result.error) throw new Error(result.error.message || 'That code is not valid.')
      setPassword('')
      setCode('')
      await session.refetch()
      await router.invalidate()
      // Verified but not signed in automatically: ask for the normal sign-in.
      const current = await authClient.getSession()
      if (!current.data?.user) {
        switchMode('signin')
        setNotice('Email verified. Sign in to continue.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    if (cooldown > 0 || pending) return
    setError('')
    setNotice('')
    setPending(true)
    try {
      if (purpose === 'sign-in') {
        // The password is still in memory: repeat step 1, which checks it again before sending.
        const result = await beginSignIn({ data: { email, password } })
        if (result.status !== 'code_sent') throw new Error(signInMessage(result.status))
      } else {
        const result = await authClient.emailOtp.sendVerificationOtp({ email, type: purpose })
        if (result.error) throw new Error(result.error.message || 'Could not send the code.')
      }
      setCooldown(RESEND_SECONDS)
      setNotice('A new code is on its way.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

=======
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
  async function signOut() {
    setPending(true)
    setError('')
    try {
      await authClient.signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.')
    } finally {
      setPending(false)
    }
  }

  async function google() {
    setError('')
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/account' })
    if (result.error) setError(result.error.message || 'Google sign-in failed.')
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8a6d2b] uppercase">Account</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Your FitRoom profile</h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-600">
        Sign in to keep try-on history on your account. Guests can still try garments on this device.
      </p>

      {user ? (
        <section className="mt-8 rounded-[2rem] border border-neutral-200 bg-[#f8f7f4] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#111111] text-white">
                <UserRound className="size-5" />
              </span>
              <div>
                <p className="font-display text-xl font-semibold">{user.name || 'Signed in'}</p>
                <p className="text-sm text-neutral-600">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:border-neutral-500"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sign out
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold">Saved looks</h2>
            {remoteFits.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">
                No looks saved to this account yet. Generate a try-on in the{' '}
                <Link to="/" hash="studio" className="font-semibold underline">
                  studio
                </Link>
                .
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {remoteFits.map((fit) => (
                  <article key={fit.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <img src={fit.resultUrl} alt={fit.garmentName} className="aspect-[3/4] w-full object-cover" />
                    <p className="truncate px-3 py-2 text-sm font-semibold">{fit.garmentName}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
<<<<<<< HEAD
          {mode !== 'reset' ? (
            <div className="flex gap-2">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === m ? 'bg-[#111111] text-white' : 'bg-[#f8f7f4] text-neutral-600'}`}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="font-display text-lg font-semibold">Reset your password</h2>
          )}

          {step === 'form' ? (
            <form onSubmit={submitForm} className="mt-6 space-y-3">
              {mode === 'signup' ? (
                <label className="block text-sm font-medium">
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
                </label>
              ) : null}
              <label className="block text-sm font-medium">
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
              </label>
              {mode !== 'reset' ? (
                <label className="block text-sm font-medium">
                  Password (8+ characters)
                  <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={inputClass} />
                </label>
              ) : null}
              {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
              {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {mode === 'signup' ? 'Create account and email me a code' : mode === 'signin' ? 'Continue' : 'Email me a code'}
              </button>
              {mode === 'signin' ? (
                <button type="button" onClick={() => switchMode('reset')} className="w-full text-center text-sm text-neutral-600 underline">
                  Forgot your password?
                </button>
              ) : null}
              {mode === 'reset' ? (
                <button type="button" onClick={() => switchMode('signin')} className="w-full text-center text-sm text-neutral-600 underline">
                  Back to sign in
                </button>
              ) : null}
            </form>
          ) : (
            <form onSubmit={submitCode} className="mt-6 space-y-3">
              <div className="flex items-start gap-2 text-sm text-neutral-700">
                <MailCheck className="mt-0.5 size-4 shrink-0" />
                <p>
                  {purpose === 'email-verification' ? 'Verify your email. ' : purpose === 'forget-password' ? 'Reset your password. ' : 'One more step. '}
                  Enter the 6-digit code sent to <span className="font-semibold">{email}</span>.
                </p>
              </div>
              <label className="block text-sm font-medium">
                Code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  className={`${inputClass} text-center font-mono text-xl tracking-[0.5em]`}
                />
              </label>
              {purpose === 'forget-password' ? (
                <label className="block text-sm font-medium">
                  New password (8+ characters)
                  <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputClass} />
                </label>
              ) : null}
              {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
              {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {purpose === 'forget-password' ? 'Set new password' : purpose === 'email-verification' ? 'Verify email' : 'Sign in'}
              </button>
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <button type="button" onClick={resend} disabled={cooldown > 0 || pending} className="underline disabled:no-underline disabled:opacity-60">
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
                <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); setNotice('') }} className="underline">
                  Use a different email
                </button>
              </div>
            </form>
          )}
          {options.google && step === 'form' && mode !== 'reset' ? (
=======
          <div className="flex gap-2">
            <button
              onClick={() => setMode('signin')}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'signin' ? 'bg-[#111111] text-white' : 'bg-[#f8f7f4] text-neutral-600'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-[#111111] text-white' : 'bg-[#f8f7f4] text-neutral-600'}`}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === 'signup' ? (
              <label className="block text-sm font-medium">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-[#111111]" />
              </label>
            ) : null}
            <label className="block text-sm font-medium">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-[#111111]" />
            </label>
            <label className="block text-sm font-medium">
              Password (8+ characters)
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-[#111111]" />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          {options.google ? (
>>>>>>> 14ed2d993790337fa7abbca73a7f2755b6b8af56
            <button onClick={google} className="mt-3 w-full rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold hover:border-neutral-500">
              Continue with Google
            </button>
          ) : null}
        </section>
      )}
    </main>
  )
}
