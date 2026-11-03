import { createFileRoute } from '@tanstack/react-router'
import { hfHealth } from '@/lib/hftryon'
import { pixelApiHealth } from '@/lib/pixelapi'
import { storageStatus } from '@/lib/storage'

/**
 * GET /api/tryon-health — setup check for the deployed site. Reports whether the try-on providers
 * are configured and reachable from the server. Booleans, status codes and timings only; no secrets.
 */
export const Route = createFileRoute('/api/tryon-health')({
  server: {
    handlers: {
      GET: async () => {
        const [pixelapi, huggingface] = await Promise.all([pixelApiHealth(), hfHealth()])
        const storage = storageStatus()
        return new Response(
          JSON.stringify({ pixelapi, huggingface, storage: { backend: storage.backend, ready: storage.ready } }, null, 2),
          { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
        )
      },
    },
  },
})
