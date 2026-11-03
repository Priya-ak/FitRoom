import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { currentUser } from '@/lib/session.server'
import { keyFromFileUrl, storage, storageStatus } from '@/lib/storage'
import { hfReady, pollHfTryOn, startHfTryOn } from '@/lib/hftryon'
import { pixelApiReady, pollPixelTryOn, startPixelTryOn, type PixelCategory } from '@/lib/pixelapi'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024
const MIN_BYTES = 1024

const uploadValidator = (input: unknown) => {
  if (!(input instanceof FormData)) throw new Error('Expected a photo upload.')
  return input
}

function extensionOk(name: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(name) || name === 'photo.jpg' || name === 'onphoto-look.jpg'
}

function ownerPrefix(userId: string | null): string {
  return userId ? `users/${userId}/tryon` : 'public/tryon'
}

type TryOnProvider = 'pixelapi' | 'huggingface' | 'fashn'

// PixelAPI job ids are prefixed so polling routes to the right provider even if the env changes mid-job.
const PIXEL_JOB_PREFIX = 'px_'
const HF_JOB_PREFIX = 'hf_'
const RESULT_NOTE = 'AI try-on of your uploaded photo wearing the selected garment.'

/** TRYON_PROVIDER picks explicitly; otherwise PixelAPI when its key is set, then FASHN. */
function tryOnProvider(): TryOnProvider {
  const explicit = (process.env.TRYON_PROVIDER ?? '').trim().toLowerCase()
  if (explicit === 'pixelapi' || explicit === 'fashn' || explicit === 'huggingface') return explicit
  if (pixelApiReady()) return 'pixelapi'
  if (hfReady()) return 'huggingface'
  if (fashnKey().length > 8) return 'fashn'
  return 'pixelapi'
}

function providerReady(provider: TryOnProvider): boolean {
  if (provider === 'pixelapi') return pixelApiReady() || hfReady()
  return provider === 'huggingface' ? hfReady() : fashnKey().length > 8
}

export const getRuntimeStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const provider = tryOnProvider()
  return {
    exact: providerReady(provider),
    provider,
    storage: storageStatus(),
  } as const
})

export const getTryonMode = createServerFn({ method: 'GET' }).handler(async () => {
  const status = await getRuntimeStatus()
  return { exact: status.exact } as const
})

export const uploadTryonPhoto = createServerFn({ method: 'POST' })
  .validator(uploadValidator)
  .handler(async ({ data }: { data: FormData }) => {
    const file = data.get('file')
    if (!(file instanceof File)) throw new Error('Choose a photo file first.')
    const type = (file.type || '').toLowerCase()
    if (!ALLOWED_TYPES.has(type) && !file.type.startsWith('image/')) {
      throw new Error('That file is not a photo. Please choose a JPG, PNG or WEBP image.')
    }
    if (type && !ALLOWED_TYPES.has(type) && type !== 'image/jpg') {
      throw new Error('Please choose a JPG, JPEG, PNG or WEBP image.')
    }
    if (file.size > MAX_BYTES) throw new Error('That photo is over 10 MB. Please choose a smaller photo.')
    if (file.size < MIN_BYTES) throw new Error('That file looks empty. Please choose another photo.')
    if (file.name && !extensionOk(file.name) && !ALLOWED_TYPES.has(type)) {
      throw new Error('Please choose a JPG, JPEG, PNG or WEBP image.')
    }

    let userId: string | null = null
    try {
      userId = (await currentUser())?.id ?? null
    } catch (error) {
      console.warn('[fitroom] upload session lookup skipped', error)
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'photo.jpg'
    const key = `${ownerPrefix(userId)}/${crypto.randomUUID()}-${safe}`
    const bytes = await file.arrayBuffer()
    const extension = file.name.toLowerCase().split('.').pop()
    const contentType = ALLOWED_TYPES.has(type)
      ? (type === 'image/jpg' ? 'image/jpeg' : type)
      : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg'
    try {
      const stored = await storage.put(key, bytes, { contentType })
      return { url: stored.url, key: stored.key, backend: storageStatus().backend } as const
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'unknown storage error'
      console.error('[fitroom] upload failed', e)
      throw new Error(`Photo upload failed: ${detail}`)
    }
  })

const generateSchema = z.object({
  selfieUrl: z.string().min(8, 'Add your photo first.'),
  garmentUrl: z.string().min(8, 'Add a garment photo first.'),
  garmentName: z.string().min(1).max(120),
  garmentCategory: z.string().min(1).max(60),
})

const pollSchema = z.object({
  jobId: z.string().min(8),
})

function mapCategory(category: string): 'auto' | 'tops' | 'bottoms' | 'one-pieces' {
  const c = category.toLowerCase()
  if (
    c.includes('dress') ||
    c.includes('saree') ||
    c.includes('anarkali') ||
    c.includes('one-piece') ||
    c.includes('gown') ||
    c.includes('slip') ||
    c.includes('frock') ||
    c.includes('jumpsuit') ||
    c.includes('kurta') && c.includes('set')
  ) {
    return 'one-pieces'
  }
  if (
    c.includes('skirt') ||
    c.includes('trouser') ||
    c.includes('pant') ||
    c.includes('jean') ||
    c.includes('bottom') ||
    c.includes('short') ||
    c.includes('salwar')
  ) {
    return 'bottoms'
  }
  if (
    c.includes('top') ||
    c.includes('blouse') ||
    c.includes('shirt') ||
    c.includes('tee') ||
    c.includes('t-shirt') ||
    c.includes('jacket') ||
    c.includes('coat') ||
    c.includes('blazer') ||
    c.includes('hoodie') ||
    c.includes('sweat') ||
    c.includes('knit') ||
    c.includes('sweater') ||
    c.includes('kurti') ||
    c.includes('kurta')
  ) {
    return 'tops'
  }
  return 'auto'
}

function pixelCategory(category: string): PixelCategory {
  const mapped = mapCategory(category)
  if (mapped === 'one-pieces') return 'dress'
  if (mapped === 'bottoms') return 'lowerbody'
  return 'upperbody'
}

function bytesToDataUri(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

function providerMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value && typeof value === 'object') {
    const error = value as { message?: unknown; error?: unknown; name?: unknown }
    if (typeof error.message === 'string' && error.message.trim()) return error.message
    if (typeof error.error === 'string' && error.error.trim()) return error.error
    if (typeof error.name === 'string' && error.name.trim()) return error.name
  }
  return null
}

async function readStoredBytes(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const file = await storage.get(key)
  if (!file) return null
  const buf = await new Response(file.body).arrayBuffer()
  return { bytes: new Uint8Array(buf), contentType: file.contentType }
}

async function resolveImageDataUri(url: string, label: string): Promise<string> {
  if (url.startsWith('data:image/svg')) {
    throw new Error(
      `${label} is only a catalogue placeholder. Upload a real garment photograph to run AI try-on.`,
    )
  }
  if (url.startsWith('data:image/')) return url

  const key = keyFromFileUrl(url)
  if (key) {
    const stored = await readStoredBytes(key)
    if (stored) return bytesToDataUri(stored.bytes, stored.contentType.startsWith('image/') ? stored.contentType : 'image/jpeg')
  }

  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
    if (!response) throw new Error(`Could not load the ${label.toLowerCase()} in time. Please retry.`)
    if (!response.ok) throw new Error(`Could not load the ${label.toLowerCase()} (${response.status}).`)
    const type = (response.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim()
    if (type.includes('svg')) {
      throw new Error(`${label} is not a usable garment photograph. Upload a JPG or PNG of the clothing instead.`)
    }
    const buf = new Uint8Array(await response.arrayBuffer())
    if (buf.byteLength < MIN_BYTES) throw new Error(`${label} looks empty. Please use another photo.`)
    if (buf.byteLength > MAX_BYTES) throw new Error(`${label} is over 10 MB. Please use a smaller photo.`)
    return bytesToDataUri(buf, type.startsWith('image/') ? type : 'image/jpeg')
  }

  throw new Error(`${label} could not be read. Re-upload the photo and try again.`)
}

function fashnKey(): string {
  return (process.env.FASHN_API_KEY ?? process.env.TRYON_API_KEY ?? '').trim()
}

function fashnBase(): string {
  return (process.env.TRYON_API_URL ?? 'https://api.fashn.ai/v1').trim().replace(/\/+$/, '')
}

/** Saves a generated image under the signed-in user's prefix (or public/ for guests). */
async function storeResult(bytes: ArrayBuffer | Uint8Array, contentType: string) {
  let userId: string | null = null
  try {
    userId = (await currentUser())?.id ?? null
  } catch {
    userId = null
  }
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const key = `${ownerPrefix(userId)}/result-${crypto.randomUUID()}.${extension}`
  try {
    return await storage.put(key, bytes, { contentType })
  } catch (error) {
    console.error('[fitroom] generated result storage failed', error)
    throw new Error('The try-on completed, but its result could not be saved. Check image storage configuration and retry.')
  }
}

export const startTryOn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as z.infer<typeof generateSchema>)
  .handler(async ({ data }: { data: z.infer<typeof generateSchema> }) => {
    const parsed = generateSchema.safeParse(data)
    if (!parsed.success) throw new Error('Add both your photo and a garment photo to generate a try-on.')
    const { selfieUrl, garmentUrl, garmentName, garmentCategory } = parsed.data

    const provider = tryOnProvider()
    if (!providerReady(provider)) {
      throw new Error(
        `AI garment fitting is not configured. Set ${provider === 'pixelapi' ? 'PIXELAPI_API_KEY' : provider === 'huggingface' ? 'HF_TOKEN' : 'FASHN_API_KEY'} on the server. FitRoom will not invent a model or return your original selfie as a fake result.`,
      )
    }

    const modelImage = await resolveImageDataUri(selfieUrl, 'Your photo')
    const garmentImage = await resolveImageDataUri(garmentUrl, 'The garment photo')

    if (provider === 'pixelapi' && pixelApiReady()) {
      try {
        const jobId = await startPixelTryOn(modelImage, garmentImage, pixelCategory(garmentCategory))
        return { jobId: `${PIXEL_JOB_PREFIX}${jobId}`, garmentName, garmentCategory } as const
      } catch (error) {
        // Out of credits, rate-limited or down: use the free Hugging Face Space when it is configured.
        if (!hfReady()) throw error
        console.error('[fitroom] PixelAPI failed, falling back to Hugging Face:', error instanceof Error ? error.message : error)
      }
    }
    if (provider === 'huggingface' || provider === 'pixelapi') {
      const jobId = await startHfTryOn(modelImage, garmentImage, garmentName)
      return { jobId: `${HF_JOB_PREFIX}${jobId}`, garmentName, garmentCategory } as const
    }

    const apiKey = fashnKey()

    const res = await fetch(`${fashnBase()}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: modelImage,
          garment_image: garmentImage,
          category: mapCategory(garmentCategory),
          garment_photo_type: 'auto',
          mode: 'quality',
          return_base64: true,
          output_format: 'jpeg',
        },
      }),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error('The FASHN API key was refused. Check FASHN_API_KEY and try again.')
    }
    if (res.status === 429) {
      throw new Error('The try-on service is rate-limiting requests. Wait a moment and retry.')
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[fitroom] exact run failed', res.status, text.slice(0, 400))
      throw new Error('The try-on service refused the photos. Use a clear, front-facing photo of you and a well-lit garment image.')
    }
    const json = (await res.json().catch(() => null)) as { id?: unknown; error?: unknown } | null
    if (!json) throw new Error('The try-on service returned an unreadable response. Please retry.')
    const providerError = providerMessage(json.error)
    if (providerError) throw new Error(`The try-on service could not start: ${providerError}`)
    if (typeof json.id !== 'string' || json.id.length < 8) {
      throw new Error('The try-on service did not return a valid job. Please retry.')
    }
    return { jobId: json.id, garmentName, garmentCategory } as const
  })

export const pollTryOn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as z.infer<typeof pollSchema>)
  .handler(async ({ data }: { data: z.infer<typeof pollSchema> }) => {
    const parsed = pollSchema.safeParse(data)
    if (!parsed.success) throw new Error('Missing try-on job.')

    if (parsed.data.jobId.startsWith(PIXEL_JOB_PREFIX)) {
      const result = await pollPixelTryOn(parsed.data.jobId.slice(PIXEL_JOB_PREFIX.length))
      if (result.status === 'processing') return { status: 'processing' as const }
      const stored = await storeResult(result.bytes, result.contentType)
      return {
        status: 'completed' as const,
        imageUrl: stored.url,
        key: stored.key,
        note: RESULT_NOTE,
        mode: 'exact' as const,
      }
    }

    if (parsed.data.jobId.startsWith(HF_JOB_PREFIX)) {
      const result = await pollHfTryOn(parsed.data.jobId.slice(HF_JOB_PREFIX.length))
      if (result.status === 'processing') return { status: 'processing' as const }
      const stored = await storeResult(result.bytes, result.contentType)
      return {
        status: 'completed' as const,
        imageUrl: stored.url,
        key: stored.key,
        note: RESULT_NOTE,
        mode: 'exact' as const,
      }
    }

    const apiKey = fashnKey()
    if (!apiKey) throw new Error('AI garment fitting is not configured. Set FASHN_API_KEY on the server.')

    const res = await fetch(`${fashnBase()}/status/${encodeURIComponent(parsed.data.jobId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[fitroom] status failed', res.status, text.slice(0, 200))
      if (res.status === 401 || res.status === 403) {
        throw new Error('The FASHN API key was refused while checking the result. Check FASHN_API_KEY.')
      }
      if (res.status === 429) throw new Error('FASHN is rate-limiting status checks. Wait a moment and retry.')
      throw new Error(`The try-on status could not be checked (${res.status}). Please retry.`)
    }
    const status = (await res.json().catch(() => null)) as {
      status?: unknown
      output?: unknown
      error?: unknown
    } | null
    if (!status) throw new Error('The try-on service returned an unreadable status. Please retry.')
    const state = typeof status.status === 'string' ? status.status.toLowerCase() : ''

    if (state === 'failed') {
      throw new Error(
        providerMessage(status.error) ??
          'The try-on could not fit that garment on that photo. Try a clearer front-facing photo.',
      )
    }
    if (state === 'starting' || state === 'in_queue' || state === 'processing') {
      return { status: 'processing' as const }
    }
    if (state !== 'completed') throw new Error('The try-on service returned an unknown job status. Please retry.')
    if (!Array.isArray(status.output) || typeof status.output[0] !== 'string' || !status.output[0]) {
      throw new Error('The try-on finished without an image. Please retry.')
    }

    const output = status.output[0]
    let bytes: ArrayBuffer
    let contentType = 'image/jpeg'
    if (output.startsWith('data:image/')) {
      const comma = output.indexOf(',')
      if (comma < 0) throw new Error('The try-on service returned an invalid image. Please retry.')
      const header = output.slice(0, comma)
      const mime = header.slice('data:'.length).split(';')[0] || 'image/jpeg'
      if (!mime.startsWith('image/') || mime.includes('svg')) {
        throw new Error('The try-on service returned an unsupported image format.')
      }
      contentType = mime
      const binary = atob(output.slice(comma + 1))
      const raw = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) raw[i] = binary.charCodeAt(i)
      bytes = raw.buffer
    } else {
      const img = await fetch(output)
      if (!img.ok) throw new Error('The generated try-on image could not be downloaded. Please retry.')
      contentType = (img.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim()
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        throw new Error('The try-on service returned an unsupported image format.')
      }
      bytes = await img.arrayBuffer()
    }

    const stored = await storeResult(bytes, contentType)
    return {
      status: 'completed' as const,
      imageUrl: stored.url,
      key: stored.key,
      note: RESULT_NOTE,
      mode: 'exact' as const,
    }
  })

/** Kept for compatibility: starts a job then polls until done. Prefer startTryOn + pollTryOn on short-lived hosts. */
export const generateTryOn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as z.infer<typeof generateSchema>)
  .handler(async ({ data }: { data: z.infer<typeof generateSchema> }) => {
    const started = await startTryOn({ data })
    const deadline = Date.now() + 100_000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000))
      const result = await pollTryOn({ data: { jobId: started.jobId } })
      if (result.status === 'completed') {
        return {
          imageUrl: result.imageUrl,
          key: result.key,
          note: result.note,
          mode: result.mode,
        } as const
      }
    }
    throw new Error('The try-on is taking too long. Wait a minute and generate once more.')
  })
