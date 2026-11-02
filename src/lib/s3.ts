// SERVER-ONLY. AWS Signature Version 4 for Cloudflare R2's S3-compatible API.
// Uses Web Crypto so it runs on Cloudflare Workers and Node.

const encoder = new TextEncoder()

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

async function signingKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

export type S3Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl?: string
  region?: string
}

function endpointHost(accountId: string): string {
  return `${accountId}.r2.cloudflarestorage.com`
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

export async function s3Request(
  config: S3Config,
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
  key: string,
  options: { body?: ArrayBuffer | Uint8Array | Blob | string; contentType?: string; query?: string } = {},
): Promise<Response> {
  const region = config.region || 'auto'
  const host = endpointHost(config.accountId)
  const path = `/${config.bucket}/${encodeKey(key)}`
  const query = options.query ?? ''
  const url = `https://${host}${path}${query ? `?${query}` : ''}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = 'UNSIGNED-PAYLOAD'
  const contentType = options.contentType ?? 'application/octet-stream'

  const signedHeaders = options.body !== undefined ? 'content-type;host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    options.body !== undefined
      ? `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
      : `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`

  const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n')
  const signature = hex(await hmac(await signingKey(config.secretAccessKey, dateStamp, region, 's3'), stringToSign))

  const headers: Record<string, string> = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (options.body !== undefined) headers['content-type'] = contentType

  let body: BodyInit | undefined
  if (options.body instanceof Blob) body = options.body
  else if (typeof options.body === 'string') body = options.body
  else if (options.body) body = options.body as BufferSource

  return fetch(url, { method, headers, body })
}

export function r2PublicUrl(config: S3Config, key: string): string | null {
  const base = config.publicBaseUrl?.replace(/\/+$/, '')
  if (!base) return null
  return `${base}/${encodeKey(key)}`
}
