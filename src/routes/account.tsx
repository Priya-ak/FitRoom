import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, LogIn, LogOut, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { getSessionUser, getSignInOptions } from '@/lib/session'
import { listUserFits } from '@/server/fits'

export const Route = createFileRoute('/account')({
  loader: async () => {
    const [user, options, remoteFits] = await Promise.all([getSessionUser(), getSignInOptions(), listUserFits()])
    return { user, options, remoteFits }
  },
  component: AccountPage,
})

function AccountPage() {
  const { user: loaderUser, options, remoteFits } = Route.useLoaderData()
  const session = authClient.useSession()
  const user = session.data?.user ?? loaderUser
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({ name: name.trim() || email.split('@')[0] || 'Guest', email, password })
        if (result.error) throw new Error(result.error.message || 'Could not create the account.')
        setNotice('Account created. You are signed in.')
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) throw new Error(result.error.message || 'Could not sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

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
            <button onClick={google} className="mt-3 w-full rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold hover:border-neutral-500">
              Continue with Google
            </button>
          ) : null}
        </section>
      )}
    </main>
  )
}
