// SERVER-ONLY. Object storage for user photos, garment photos, and try-on results.
// Backends (first match wins):
//   1. Cloudflare R2 S3 API — R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME
//   2. Worker R2 binding named FITROOM_BUCKET (optional wrangler binding)
//   3. MonstarX object storage — MONSTARX_STORAGE_URL + MONSTARX_DATA_TOKEN
//   4. Local development adapter — in-memory + optional .data/uploads on Node
// Credentials never leave the server. Browser code only receives URLs.

export interface StoredFile {
  key: string
  size: number
  contentType: string
  url: string
}

export type FileBody = ArrayBuffer | ArrayBufferView | Blob | string

export type StorageBackend = 'r2' | 'r2-binding' | 'monstarx' | 'local'

type MemoryEntry = { body: Uint8Array; contentType: string }

const memory = (() => {
  const g = globalThis as typeof globalThis & { __fitroomFiles?: Map<string, MemoryEntry> }
  g.__fitroomFiles ??= new Map()
  return g.__fitroomFiles
})()

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

function toUint8Array(body: FileBody): Promise<Uint8Array> | Uint8Array {
  if (typeof body === 'string') return new TextEncoder().encode(body)
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  return body.arrayBuffer().then((buf) => new Uint8Array(buf))
}

function appOrigin(): string {
  return (process.env.BETTER_AUTH_URL || process.env.APP_URL || '').replace(/\/+$/, '')
}

function appUrlFor(key: string): string {
  const origin = appOrigin()
  const path = `/api/files/${encodeKey(key)}`
  return origin ? `${origin}${path}` : path
}

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() || undefined,
  }
}

async function workersR2Binding(): Promise<{
  put: (key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>
  get: (key: string) => Promise<{ body: ReadableStream<Uint8Array>; size: number; httpMetadata?: { contentType?: string } } | null>
  delete: (key: string) => Promise<void>
  list: (options: Record<string, unknown>) => Promise<{ objects: Array<{ key: string; size: number; httpMetadata?: { contentType?: string } }> }>
} | null> {
  try {
    const specifier = 'cloudflare:workers'
    const mod = (await import(/* @vite-ignore */ specifier)) as { env?: Record<string, unknown> }
    return (mod.env?.FITROOM_BUCKET as never) ?? null
  } catch {
    return null
  }
}

function monstarxEndpoint(): { base: string; token: string } | null {
  const base = process.env.MONSTARX_STORAGE_URL?.replace(/\/+$/, '')
  const token = process.env.MONSTARX_DATA_TOKEN
  if (!base || !token) return null
  return { base, token }
}

async function localDir(): Promise<string | null> {
  try {
    const path = await import('node:path')
    const fs = await import('node:fs/promises')
    const dir = path.join(process.cwd(), '.data', 'uploads')
    await fs.mkdir(dir, { recursive: true })
    return dir
  } catch {
    return null
  }
}

function diskName(key: string): string {
  return encodeURIComponent(key)
}

export function storageBackend(): StorageBackend {
  if (r2Config()) return 'r2'
  if (process.env.FITROOM_BUCKET || process.env.R2_BINDING) return 'r2-binding'
  if (monstarxEndpoint()) return 'monstarx'
  return 'local'
}

export function storageStatus(): { backend: StorageBackend; ready: boolean; detail: string } {
  const backend = storageBackend()
  if (backend === 'r2') return { backend, ready: true, detail: 'Cloudflare R2 (S3 API)' }
  if (backend === 'r2-binding') return { backend, ready: true, detail: 'Cloudflare R2 Worker binding' }
  if (backend === 'monstarx') return { backend, ready: true, detail: 'MonstarX object storage' }
  return {
    backend: 'local',
    ready: process.env.NODE_ENV !== 'production',
    detail: process.env.NODE_ENV === 'production'
      ? 'Persistent storage is not configured. Configure Cloudflare R2 or MonstarX storage before accepting uploads.'
      : 'Local development storage (in-memory / .data/uploads). Files are not in production object storage.',
  }
}

function urlFor(key: string): string {
  const r2 = r2Config()
  if (r2?.publicBaseUrl && key.startsWith('public/')) {
    return `${r2.publicBaseUrl.replace(/\/+$/, '')}/${encodeKey(key)}`
  }
  if (key.startsWith('public/')) {
    const mx = monstarxEndpoint()
    if (mx) return `${mx.base}/public/${encodeKey(key.slice('public/'.length))}`
  }
  return appUrlFor(key)
}

async function putLocal(key: string, body: FileBody, contentType: string): Promise<StoredFile> {
  const bytes = await toUint8Array(body)
  memory.set(key, { body: bytes, contentType })
  const dir = await localDir()
  if (dir) {
    try {
      const path = await import('node:path')
      const fs = await import('node:fs/promises')
      await fs.writeFile(path.join(dir, diskName(key)), bytes)
      await fs.writeFile(path.join(dir, `${diskName(key)}.meta.json`), JSON.stringify({ contentType, size: bytes.byteLength }))
    } catch (error) {
      console.warn('[fitroom] local disk write skipped', error)
    }
  }
  return { key, size: bytes.byteLength, contentType, url: urlFor(key) }
}

async function getLocal(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
  const hit = memory.get(key)
  if (hit) {
    const bytes = new Uint8Array(hit.body.byteLength)
    bytes.set(hit.body)
    return { body: new Blob([bytes.buffer]).stream() as ReadableStream<Uint8Array>, contentType: hit.contentType, size: hit.body.byteLength }
  }
  const dir = await localDir()
  if (!dir) return null
  try {
    const path = await import('node:path')
    const fs = await import('node:fs/promises')
    const bytes = new Uint8Array(await fs.readFile(path.join(dir, diskName(key))))
    let contentType = 'application/octet-stream'
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, `${diskName(key)}.meta.json`), 'utf8')) as { contentType?: string }
      if (meta.contentType) contentType = meta.contentType
    } catch {
      /* no meta */
    }
    memory.set(key, { body: bytes, contentType })
    return { body: new Blob([bytes.buffer]).stream() as ReadableStream<Uint8Array>, contentType, size: bytes.byteLength }
  } catch {
    return null
  }
}

export const storage = {
  async put(key: string, body: FileBody, options: { contentType?: string } = {}): Promise<StoredFile> {
    const contentType = options.contentType ?? (body instanceof Blob && body.type ? body.type : 'application/octet-stream')
    const r2 = r2Config()
    if (r2) {
      const { s3Request, r2PublicUrl } = await import('./s3')
      const bytes = await toUint8Array(body)
      const response = await s3Request(r2, 'PUT', key, { body: bytes, contentType })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`R2 upload failed (${response.status}): ${text.slice(0, 180) || 'check R2 credentials and bucket name.'}`)
      }
      const publicUrl = key.startsWith('public/') ? r2PublicUrl(r2, key) : null
      return { key, size: bytes.byteLength, contentType, url: publicUrl ?? appUrlFor(key) }
    }

    const binding = await workersR2Binding()
    if (binding) {
      const bytes = await toUint8Array(body)
      await binding.put(key, bytes, { httpMetadata: { contentType } })
      return { key, size: bytes.byteLength, contentType, url: appUrlFor(key) }
    }

    const mx = monstarxEndpoint()
    if (mx) {
      const bytes = await toUint8Array(body)
      const uploadBody = new Uint8Array(bytes.byteLength)
      uploadBody.set(bytes)
      const response = await fetch(`${mx.base}/objects/${encodeKey(key)}`, {
        method: 'PUT',
        body: uploadBody.buffer,
        headers: { authorization: `Bearer ${mx.token}`, 'content-type': contentType },
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        let detail = ''
        try {
          detail = (JSON.parse(text) as { error?: string }).error ?? ''
        } catch {
          detail = text.slice(0, 180)
        }
        console.error('[fitroom] MonstarX storage upload failed', response.status, detail)
        throw new Error(detail || `MonstarX storage request failed (${response.status}).`)
      }
      return { key, size: bytes.byteLength, contentType, url: urlFor(key) }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Persistent image storage is not configured. Configure Cloudflare R2 or MonstarX storage.')
    }
    return putLocal(key, body, contentType)
  },

  async get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
    const r2 = r2Config()
    if (r2) {
      const { s3Request } = await import('./s3')
      const response = await s3Request(r2, 'GET', key)
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`R2 read failed (${response.status})`)
      if (!response.body) throw new Error('R2 returned an empty object response.')
      return {
        body: response.body as ReadableStream<Uint8Array>,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        size: Number(response.headers.get('content-length') ?? 0),
      }
    }

    const binding = await workersR2Binding()
    if (binding) {
      const object = await binding.get(key)
      return object
        ? { body: object.body, contentType: object.httpMetadata?.contentType ?? 'application/octet-stream', size: object.size }
        : null
    }

    const mx = monstarxEndpoint()
    if (mx) {
      const response = await fetch(`${mx.base}/objects/${encodeKey(key)}`, {
        headers: { authorization: `Bearer ${mx.token}` },
      })
      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[fitroom] MonstarX storage read failed', response.status, text.slice(0, 180))
        throw new Error(`MonstarX storage read failed (${response.status}).`)
      }
      if (!response.body) throw new Error('MonstarX storage returned an empty object response.')
      return {
        body: response.body as ReadableStream<Uint8Array>,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        size: Number(response.headers.get('content-length') ?? 0),
      }
    }

    return getLocal(key)
  },

  async delete(key: string): Promise<void> {
    const r2 = r2Config()
    if (r2) {
      const { s3Request } = await import('./s3')
      const response = await s3Request(r2, 'DELETE', key)
      if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed (${response.status})`)
      return
    }
    const binding = await workersR2Binding()
    if (binding) {
      await binding.delete(key)
      return
    }
    const mx = monstarxEndpoint()
    if (mx) {
      const response = await fetch(`${mx.base}/objects/${encodeKey(key)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${mx.token}` },
      })
      if (!response.ok && response.status !== 404) {
        const text = await response.text().catch(() => '')
        console.error('[fitroom] MonstarX storage delete failed', response.status, text.slice(0, 180))
        throw new Error(`MonstarX storage delete failed (${response.status}).`)
      }
      return
    }
    memory.delete(key)
  },

  async list(prefix = ''): Promise<StoredFile[]> {
    const mx = monstarxEndpoint()
    if (mx) {
      const response = await fetch(`${mx.base}/list?prefix=${encodeURIComponent(prefix)}&limit=1000`, {
        headers: { authorization: `Bearer ${mx.token}` },
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        console.error('[fitroom] MonstarX storage list failed', response.status, text.slice(0, 180))
        throw new Error(`MonstarX storage list failed (${response.status}).`)
      }
      const data = (await response.json()) as { objects: Array<{ key: string; size: number; contentType: string }> }
      return data.objects.map((object) => ({ ...object, url: urlFor(object.key) }))
    }
    return [...memory.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.body.byteLength, contentType: value.contentType, url: urlFor(key) }))
  },

  publicUrl(key: string): string {
    return urlFor(key)
  },
}

export function keyFromFileUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://local.invalid')
    const marker = '/api/files/'
    const idx = parsed.pathname.indexOf(marker)
    if (idx >= 0) return decodeURIComponent(parsed.pathname.slice(idx + marker.length))
  } catch {
    /* ignore */
  }
  const relative = url.match(/\/api\/files\/(.+)$/)
  if (relative) return decodeURIComponent(relative[1]!)
  return null
}
