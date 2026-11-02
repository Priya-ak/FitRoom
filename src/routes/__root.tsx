import type { ReactNode } from 'react'
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { seoConfig, seoHead } from '@/lib/monstarx/seo'
import { authClient } from '@/lib/auth-client'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: (ctx) => {
    const seo = seoHead(ctx)
    return {
      ...seo,
      links: [
        ...seo.links,
        { rel: 'stylesheet', href: appCss },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    }
  },
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={seoConfig.locale || 'en'}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-white font-body text-[#1a1a1e] antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:px-6">
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#111111] font-display text-lg font-semibold text-white">F</span>
            <span className="truncate font-display text-lg font-semibold tracking-tight sm:text-xl">FitRoom</span>
            <span className="hidden shrink-0 rounded-full bg-[#f8f7f4] px-2.5 py-1 text-[11px] font-semibold tracking-widest text-neutral-500 uppercase sm:inline">Atelier</span>
          </Link>
          <nav className="flex min-w-0 shrink-0 items-center gap-0.5 text-sm font-medium sm:gap-2">
            <Link to="/" hash="collection" className="hidden rounded-full px-3 py-2 text-neutral-600 transition hover:bg-[#f8f7f4] hover:text-[#1a1a1e] sm:block">
              Collection
            </Link>
            <Link to="/" hash="studio" className="hidden rounded-full px-3 py-2 text-neutral-600 transition hover:bg-[#f8f7f4] hover:text-[#1a1a1e] sm:block">
              Studio
            </Link>
            <Link to="/" hash="fits" className="hidden rounded-full px-3 py-2 text-neutral-600 transition hover:bg-[#f8f7f4] hover:text-[#1a1a1e] sm:block">
              My Fits
            </Link>
            <AccountLink />
            <Link
              to="/"
              hash="studio"
              className="ml-1 shrink-0 rounded-full bg-[#111111] px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-black"
            >
              Try on
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
      <footer className="border-t border-neutral-200 bg-[#f8f7f4]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl font-semibold">FitRoom</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">
              A private virtual atelier. Try any garment on your own photo in seconds — no sign-in, no keys, no appointments.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#c9a96a]/50 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
              <span className="size-1.5 rounded-full bg-[#c9a96a]" /> AI looks are inspired re-creations
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Explore</p>
            <ul className="mt-3 space-y-2 text-sm font-medium">
              <li><a href="#collection" className="text-neutral-700 hover:text-black">The collection</a></li>
              <li><a href="#studio" className="text-neutral-700 hover:text-black">Try-on studio</a></li>
              <li><a href="#fits" className="text-neutral-700 hover:text-black">My fits</a></li>
              <li><a href="#guide" className="text-neutral-700 hover:text-black">Photo guide</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Good to know</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Photos stay in your browser unless you download.</li>
              <li>Best results: daylight, front pose, fitted clothing.</li>
              <li>Garment photos work best flat or on a hanger.</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-neutral-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-neutral-500 sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} FitRoom. Dress well, decide faster.</p>
            <p>Crafted for thoughtful shoppers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function AccountLink() {
  const session = authClient.useSession()
  const signedIn = Boolean(session.data?.user)
  return (
    <Link to="/account" className="rounded-full px-3 py-2 text-neutral-600 transition hover:bg-[#f8f7f4] hover:text-[#1a1a1e]">
      {signedIn ? 'Profile' : 'Sign in'}
    </Link>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-neutral-500">The page you are looking for does not exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white">
          Back to FitRoom
        </Link>
      </div>
    </main>
  )
}
