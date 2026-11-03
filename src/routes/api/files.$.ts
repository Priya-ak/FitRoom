import { createFileRoute } from '@tanstack/react-router'
import { currentUser } from '@/lib/session.server'
import { storage } from '@/lib/storage'

/**
 * GET /api/files/<key> — serves stored files.
 * public/* is readable with the URL.
 * users/<userId>/* is only readable by that signed-in user.
 */
export const Route = createFileRoute('/api/files/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = decodeURIComponent(params._splat ?? '')
        if (!key || key.includes('..')) return new Response('Not found', { status: 404 })

        if (key.startsWith('users/')) {
          const user = await currentUser().catch(() => null)
          const allowed = user && key.startsWith(`users/${user.id}/`)
          if (!allowed) return new Response('Sign in to access this file', { status: 401 })
        } else if (!key.startsWith('public/')) {
          if (!(await currentUser().catch(() => null))) {
            return new Response('Sign in to access this file', { status: 401 })
          }
        }

        const file = await storage.get(key)
        if (!file) return new Response('Not found', { status: 404 })
        return new Response(file.body, {
          headers: {
            'content-type': file.contentType,
            'cache-control': key.startsWith('public/') ? 'public, max-age=3600' : 'private, no-cache',
          },
        })
      },
    },
  },
})
