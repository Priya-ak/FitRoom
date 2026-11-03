// SERVER-ONLY. Cloudinary object storage for user photos, garment photos and try-on results.
//
// Every asset is uploaded with `type: authenticated`, so Cloudinary never serves it publicly.
// The browser only ever sees /api/files/<key>; that route checks ownership and then streams the
// file through cloudinaryGet(), which uses a short-lived signed download request.
//
// Required env (server-side only): CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
// Optional: CLOUDINARY_FOLDER (default "fitroom") — namespaces this app's assets in the account.

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

const API_BASE = 'https://api.cloudinary.com/v1_1'
const DELIVERY_TYPE = 'authenticated'
const EXT_RE = /\.(jpe?g|png|webp)$/i
const FORMAT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const TYPE_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
// Characters Cloudinary rejects in public IDs, plus path traversal.
const UNSAFE_KEY_RE = /[?&#\\%<>\s]|\.\./

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()
  if (!cloudName || !apiKey || !apiSecret) return null
  const folder = (process.env.CLOUDINARY_FOLDER?.trim() || 'fitroom').replace(/^\/+|\/+$/g, '')
  return { cloudName, apiKey, apiSecret, folder }
}

function normalizeFormat(ext: string): string {
  const lower = ext.toLowerCase()
  return lower === 'jpeg' ? 'jpg' : lower
}

/**
 * Cloudinary stores images without an extension in the public ID, so the storage key must carry
 * the format. Keys without a known image extension get one appended from the content type.
 * The upload converts to that format, so key extension and stored format always agree.
 */
export function cloudinaryKey(key: string, contentType: string): string {
  if (EXT_RE.test(key)) return key
  const format = FORMAT_BY_TYPE[contentType.toLowerCase()] ?? 'jpg'
  return `${key}.${format}`
}

function locate(cfg: CloudinaryConfig, key: string): { publicId: string; format: string } | null {
  if (!key || UNSAFE_KEY_RE.test(key)) return null
  const match = key.match(EXT_RE)
  if (!match) return null
  return {
    publicId: `${cfg.folder}/${key.slice(0, -match[0].length)}`,
    format: normalizeFormat(match[1]!),
  }
}

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Cloudinary API request signature: every parameter except file, cloud_name, resource_type and
 * api_key, sorted by name, joined as k=v with '&', API secret appended, SHA-1 hex.
 */
export async function signCloudinaryParams(params: Record<string, string>, apiSecret: string): Promise<string> {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return sha1Hex(toSign + apiSecret)
}

function timestamp(): string {
  return String(Math.floor(Date.now() / 1000))
}

function endpoint(cfg: CloudinaryConfig, path: string): string {
  return `${API_BASE}/${encodeURIComponent(cfg.cloudName)}/${path}`
}

function providerError(json: unknown): string | null {
  const message = (json as { error?: { message?: unknown } } | null)?.error?.message
  return typeof message === 'string' && message.trim() ? message.trim().slice(0, 200) : null
}

export async function cloudinaryUpload(
  cfg: CloudinaryConfig,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ size: number; contentType: string }> {
  const target = locate(cfg, key)
  if (!target) throw new Error('Invalid storage key for Cloudinary.')

  const params: Record<string, string> = {
    format: target.format,
    overwrite: 'true',
    public_id: target.publicId,
    timestamp: timestamp(),
    type: DELIVERY_TYPE,
  }
  const signature = await signCloudinaryParams(params, cfg.apiSecret)

  const form = new FormData()
  form.append('file', new Blob([bytes.slice().buffer as ArrayBuffer], { type: contentType }), 'upload')
  for (const [name, value] of Object.entries(params)) form.append(name, value)
  form.append('api_key', cfg.apiKey)
  form.append('signature', signature)

  const response = await fetch(endpoint(cfg, 'image/upload'), { method: 'POST', body: form })
  const json = (await response.json().catch(() => null)) as { bytes?: unknown } | null
  if (!response.ok) {
    const detail = providerError(json)
    console.error('[fitroom] Cloudinary upload failed', response.status, detail)
    if (response.status === 401) throw new Error('Cloudinary refused the credentials. Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.')
    throw new Error(`Cloudinary upload failed (${response.status})${detail ? `: ${detail}` : '.'}`)
  }
  return {
    size: typeof json?.bytes === 'number' ? json.bytes : bytes.byteLength,
    contentType: TYPE_BY_FORMAT[target.format] ?? contentType,
  }
}

export async function cloudinaryGet(
  cfg: CloudinaryConfig,
  key: string,
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
  const target = locate(cfg, key)
  if (!target) return null

  const params: Record<string, string> = {
    format: target.format,
    public_id: target.publicId,
    timestamp: timestamp(),
    type: DELIVERY_TYPE,
  }
  const signature = await signCloudinaryParams(params, cfg.apiSecret)
  const query = new URLSearchParams({ ...params, api_key: cfg.apiKey, signature })

  const response = await fetch(`${endpoint(cfg, 'image/download')}?${query.toString()}`, { signal: AbortSignal.timeout(20_000) })
  if (response.status === 404) return null
  if (!response.ok || !response.body) {
    console.error('[fitroom] Cloudinary read failed', response.status)
    throw new Error(`Cloudinary read failed (${response.status}).`)
  }
  return {
    body: response.body as ReadableStream<Uint8Array>,
    contentType: TYPE_BY_FORMAT[target.format] ?? 'application/octet-stream',
    size: Number(response.headers.get('content-length') ?? 0),
  }
}

export async function cloudinaryDelete(cfg: CloudinaryConfig, key: string): Promise<void> {
  const target = locate(cfg, key)
  if (!target) return
  const params: Record<string, string> = {
    invalidate: 'true',
    public_id: target.publicId,
    timestamp: timestamp(),
    type: DELIVERY_TYPE,
  }
  const signature = await signCloudinaryParams(params, cfg.apiSecret)
  const form = new FormData()
  for (const [name, value] of Object.entries(params)) form.append(name, value)
  form.append('api_key', cfg.apiKey)
  form.append('signature', signature)

  const response = await fetch(endpoint(cfg, 'image/destroy'), { method: 'POST', body: form })
  const json = (await response.json().catch(() => null)) as { result?: unknown } | null
  if (!response.ok) {
    console.error('[fitroom] Cloudinary delete failed', response.status, providerError(json))
    throw new Error(`Cloudinary delete failed (${response.status}).`)
  }
  // result is "ok" or "not found"; both mean the asset is gone.
}

/** Lists this app's assets under a key prefix (Admin API, Basic auth). Capped at 500 results. */
export async function cloudinaryList(
  cfg: CloudinaryConfig,
  prefix: string,
): Promise<Array<{ key: string; size: number; contentType: string }>> {
  if (UNSAFE_KEY_RE.test(prefix)) return []
  const query = new URLSearchParams({ prefix: `${cfg.folder}/${prefix}`, max_results: '500' })
  const response = await fetch(`${endpoint(cfg, `resources/image/${DELIVERY_TYPE}`)}?${query.toString()}`, {
    headers: { authorization: `Basic ${btoa(`${cfg.apiKey}:${cfg.apiSecret}`)}` },
  })
  const json = (await response.json().catch(() => null)) as {
    resources?: Array<{ public_id?: string; format?: string; bytes?: number }>
  } | null
  if (!response.ok) {
    console.error('[fitroom] Cloudinary list failed', response.status, providerError(json))
    throw new Error(`Cloudinary list failed (${response.status}).`)
  }
  const folderPrefix = `${cfg.folder}/`
  return (json?.resources ?? [])
    .filter((r) => typeof r.public_id === 'string' && r.public_id.startsWith(folderPrefix) && typeof r.format === 'string')
    .map((r) => {
      const format = normalizeFormat(r.format!)
      return {
        key: `${r.public_id!.slice(folderPrefix.length)}.${format}`,
        size: typeof r.bytes === 'number' ? r.bytes : 0,
        contentType: TYPE_BY_FORMAT[format] ?? 'application/octet-stream',
      }
    })
}
