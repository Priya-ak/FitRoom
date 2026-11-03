import { createFileRoute } from '@tanstack/react-router'
import { pixelApiHealth } from '@/lib/pixelapi'
import { storageStatus } from '@/lib/storage'

/**
 * GET /api/tryon-health — setup check for the deployed site. Reports whether the try-on provider
 * is configured and reachable from the server. Booleans, status codes and timings only; no secrets.
 */
export const Route = createFileRoute('/api/tryon-health')({
  server: {
    handlers: {
      GET: async () => {
        const [pixelapi] = await Promise.all([pixelApiHealth()])
        const storage = storageStatus()
        return new Response(
          JSON.stringify({ provider: 'pixelapi', pixelapi, storage: { backend: storage.backend, ready: storage.ready } }, null, 2),
          { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
        )
      },
    },
  },
})
