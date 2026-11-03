// SERVER-ONLY. PixelAPI virtual try-on (https://pixelapi.dev/docs.html).
//
// Async flow: POST /v1/virtual-tryon → job_id, then GET /v1/virtual-tryon/jobs/{job_id} until
// status is "completed" (result_image_b64) or "failed". Each call is short, so it fits Netlify's
// function time limits; the browser drives polling through the pollTryOn server function.
//
// Env (server-side only): PIXELAPI_API_KEY. Optional: PIXELAPI_API_URL (default https://api.pixelapi.dev).

export type PixelCategory = 'upperbody' | 'lowerbody' | 'dress'

export type PixelPollResult =
  | { status: 'processing' }
  | { status: 'completed'; bytes: Uint8Array; contentType: string }

// Per-request limits. Override with PIXELAPI_TIMEOUT_MS (applies to submit; polls use a shorter cap).
const SUBMIT_TIMEOUT_MS = Math.min(Math.max(Number(process.env.PIXELAPI_TIMEOUT_MS) || 25_000, 5_000), 55_000)
const POLL_TIMEOUT_MS = 15_000
// PixelAPI's CDN may block requests without a descriptive User-Agent.
const USER_AGENT = 'FitRoom/0.1 (server; virtual try-on)'

export function pixelApiKey(): string {
  return (process.env.PIXELAPI_API_KEY ?? '').trim()
}

export function pixelApiReady(): boolean {
  return pixelApiKey().length > 8
}

function baseUrl(): string {
  return (process.env.PIXELAPI_API_URL ?? 'https://api.pixelapi.dev').trim().replace(/\/+$/, '')
}

/** PixelAPI expects raw base64 without a data: prefix. */
function rawBase64(dataUri: string): string {
  const comma = dataUri.indexOf(',')
  return dataUri.startsWith('data:') && comma > 0 ? dataUri.slice(comma + 1) : dataUri
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = rawBase64(b64).replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  return null
}

/** Error body: {"detail": {"error": "...", "message": "...", "guidance": "..."}} or {"detail": "..."}. */
function providerDetail(json: unknown): { code: string | null; message: string | null } {
  const detail = (json as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return { code: null, message: detail.trim().slice(0, 240) || null }
  if (detail && typeof detail === 'object') {
    const d = detail as { error?: unknown; message?: unknown; guidance?: unknown }
    const parts = [d.message, d.guidance].filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return {
      code: typeof d.error === 'string' ? d.error : null,
      message: parts.length ? parts.join(' ').slice(0, 240) : null,
    }
  }
  return { code: null, message: null }
}

async function call(stage: 'submit' | 'status', path: string, init: RequestInit): Promise<{ response: Response; json: unknown }> {
  const key = pixelApiKey()
  if (!key) throw new Error('AI garment fitting is not configured. Set PIXELAPI_API_KEY on the server.')
  const controller = new AbortController()
  const limit = stage === 'submit' ? SUBMIT_TIMEOUT_MS : POLL_TIMEOUT_MS
  const started = Date.now()
  const timer = setTimeout(() => controller.abort(), limit)
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const json = await response.json().catch(() => null)
    return { response, json }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[fitroom] PixelAPI ${stage} timed out after ${Date.now() - started}ms`)
      throw new Error(
        stage === 'submit'
          ? 'The try-on service did not accept the photos in time. Wait a minute and retry.'
          : 'The try-on service is slow to report progress. Wait a moment and generate again.',
      )
    }
    console.error('[fitroom] PixelAPI network error', error)
    throw new Error('The try-on service could not be reached. Please retry.')
  } finally {
    clearTimeout(timer)
  }
}

/** Maps HTTP failures to user-safe messages; full details go to the server log only. */
function failure(stage: string, response: Response, json: unknown): Error {
  const { code, message } = providerDetail(json)
  console.error(`[fitroom] PixelAPI ${stage} failed`, response.status, code, message)
  switch (response.status) {
    case 401:
      return new Error('The PixelAPI key was refused. Check PIXELAPI_API_KEY.')
    case 402:
      return new Error('The try-on service has run out of credits. Top up the PixelAPI account to continue.')
    case 403:
      return new Error('The try-on service blocked the request. Please retry shortly.')
    case 413:
      return new Error('The photos are too large for the try-on service. Use images under 10 MB (about 1024 px works best).')
    case 422:
    case 400:
      // PixelAPI's validation messages are written for end users (e.g. "use a portrait photo of at least 300×400").
      return new Error(message ?? 'The try-on service could not use these photos. Use a clear, front-facing portrait photo and a well-lit garment image.')
    case 429:
      return new Error('The try-on service is rate-limiting requests. Wait a moment and retry.')
    case 503:
      return new Error('The try-on service is busy. Retry in a few seconds, ideally with smaller photos (about 1024 px).')
    default:
      return new Error(`The try-on service failed (${response.status}). Please retry.`)
  }
}

export async function startPixelTryOn(personDataUri: string, garmentDataUri: string, category: PixelCategory): Promise<string> {
  const { response, json } = await call('submit', '/v1/virtual-tryon', {
    method: 'POST',
    body: JSON.stringify({
      person_image: rawBase64(personDataUri),
      garment_image: rawBase64(garmentDataUri),
      category,
    }),
  })
  if (!response.ok) throw failure('submit', response, json)
  const jobId = (json as { job_id?: unknown } | null)?.job_id
  if (typeof jobId !== 'string' || jobId.length < 4) {
    console.error('[fitroom] PixelAPI submit returned no job_id')
    throw new Error('The try-on service did not return a valid job. Please retry.')
  }
  return jobId
}

export async function pollPixelTryOn(jobId: string): Promise<PixelPollResult> {
  const { response, json } = await call('status', `/v1/virtual-tryon/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' })
  if (response.status === 404) throw new Error('The try-on job was not found. Please generate again.')
  if (!response.ok) throw failure('status', response, json)

  const body = (json ?? {}) as {
    status?: unknown
    result_image_b64?: unknown
    output_url?: unknown
    error_message?: unknown
    error?: unknown
  }
  const state = typeof body.status === 'string' ? body.status.toLowerCase() : ''

  if (state === 'queued' || state === 'processing' || state === 'pending' || state === 'running') {
    return { status: 'processing' }
  }
  if (state === 'failed') {
    const reason = typeof body.error_message === 'string' && body.error_message.trim()
      ? body.error_message.trim().slice(0, 240)
      : providerDetail(json).message
    console.error('[fitroom] PixelAPI job failed', jobId, reason)
    throw new Error(reason ?? 'The try-on could not fit that garment on that photo. Try a clearer front-facing photo.')
  }
  if (state !== 'completed') {
    console.error('[fitroom] PixelAPI unknown status', state)
    throw new Error('The try-on service returned an unknown job status. Please retry.')
  }

  let bytes: Uint8Array
  if (typeof body.result_image_b64 === 'string' && body.result_image_b64.length > 100) {
    bytes = base64ToBytes(body.result_image_b64)
  } else if (typeof body.output_url === 'string' && /^https:\/\//i.test(body.output_url)) {
    const img = await fetch(body.output_url, { headers: { 'User-Agent': USER_AGENT } })
    if (!img.ok) throw new Error('The generated try-on image could not be downloaded. Please retry.')
    bytes = new Uint8Array(await img.arrayBuffer())
  } else {
    throw new Error('The try-on finished without an image. Please retry.')
  }

  const contentType = sniffImageType(bytes)
  if (!contentType) throw new Error('The try-on service returned an unsupported image format.')
  return { status: 'completed', bytes, contentType }
}

/**
 * Cheap reachability probe used by /api/tryon-health. Polls a job id that cannot exist, so it never
 * starts work or spends credits: 404/422 means "reachable and key accepted", 401 means a bad key.
 */
export async function pixelApiHealth(): Promise<{ keySet: boolean; reachable: boolean; httpStatus: number | null; ms: number; note: string }> {
  const started = Date.now()
  if (!pixelApiKey()) return { keySet: false, reachable: false, httpStatus: null, ms: 0, note: 'PIXELAPI_API_KEY is not set on the server.' }
  try {
    const { response } = await call('status', '/v1/virtual-tryon/jobs/healthcheck-000000', { method: 'GET' })
    const ms = Date.now() - started
    const note =
      response.status === 401 ? 'The API key was refused.'
        : response.status === 403 ? 'Blocked by PixelAPI CDN.'
          : response.status === 402 ? 'Out of credits.'
            : 'PixelAPI answered.'
    return { keySet: true, reachable: true, httpStatus: response.status, ms, note }
  } catch (error) {
    return { keySet: true, reachable: false, httpStatus: null, ms: Date.now() - started, note: error instanceof Error ? error.message : 'Request failed.' }
  }
}
