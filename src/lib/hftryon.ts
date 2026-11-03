// SERVER-ONLY. Free fallback try-on through a public Hugging Face Space running IDM-VTON (Gradio).
//
// Why a fallback: PixelAPI's free credits run out. The Space costs nothing but is shared: it queues, can be asleep
// or busy, and a free Hugging Face account only gets a small daily GPU quota. Fine for demos, not for production.
// The model is released under CC BY-NC-SA 4.0 (non-commercial); check its licence before charging users.
//
// Gradio queue API over plain HTTP (no extra dependency), same async shape as PixelAPI so it fits serverless limits:
//   1. POST {space}/upload                -> server paths for the two images
//   2. POST {space}/call/tryon            -> event_id
//   3. GET  {space}/call/tryon/{event_id} -> server-sent events; we read each poll for a few seconds
//
// Env (server-side only): HF_TOKEN (read token, required: it identifies your GPU quota).
// Optional: HF_TRYON_SPACE (default "yisol-idm-vton", the subdomain of the Space's .hf.space address).

export type HfPollResult = { status: 'processing' } | { status: 'completed'; bytes: Uint8Array; contentType: string }

const USER_AGENT = 'FitRoom/0.1 (server; virtual try-on)'
const SUBMIT_TIMEOUT_MS = 25_000
const POLL_WINDOW_MS = 8_000
const DOWNLOAD_TIMEOUT_MS = 15_000
const API_NAME = 'tryon'
// Gradio 4 serves the API at the root, Gradio 5 under /gradio_api. The job id remembers which one answered.
const PREFIXES = { r: '', g: '/gradio_api' } as const
type PrefixFlag = keyof typeof PREFIXES

export function hfToken(): string {
  return (process.env.HF_TOKEN ?? '').trim()
}

export function hfReady(): boolean {
  return hfToken().length > 8
}

function host(): string {
  const space = (process.env.HF_TRYON_SPACE ?? 'yisol-idm-vton').trim().replace(/^https?:\/\//, '').replace(/\.hf\.space.*$/, '')
  return `https://${space}.hf.space`
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { authorization: `Bearer ${hfToken()}`, 'user-agent': USER_AGENT, ...extra }
}

/** Turns anything the Space or the network throws into a message that is safe to show. Details go to the log. */
function friendly(detail: string, status?: number): Error {
  const text = detail.toLowerCase()
  console.error('[fitroom] huggingface try-on problem', status ?? '', detail.slice(0, 300))
  if (status === 401 || status === 403 || text.includes('invalid token') || text.includes('unauthorized')) {
    return new Error('The free try-on fallback was refused. Check HF_TOKEN on the server.')
  }
  if (text.includes('quota') || text.includes('zerogpu') || text.includes('gpu limit')) {
    return new Error('The free try-on GPU quota is used up for today. Try again later, or top up the PixelAPI account.')
  }
  if (status === 429) return new Error('The free try-on service is busy. Wait a minute and retry.')
  if (status === 404 || (status && status >= 500) || text.includes('sleeping') || text.includes('building')) {
    return new Error('The free try-on service is waking up or unavailable. Retry in a minute.')
  }
  return new Error(
    `The free try-on service could not process these photos${status ? ` (code ${status})` : ''}. Use a clear, front-facing photo and a well-lit garment image.`,
  )
}

function dataUriToBlob(dataUri: string): { blob: Blob; extension: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUri)
  if (!match) throw new Error('The photo could not be read. Re-upload it and try again.')
  const type = match[1]!
  const binary = atob(match[2]!.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type }), extension: type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg' }
}

interface FileData {
  path: string
  meta: { _type: 'gradio.FileData' }
}

async function upload(prefix: string, dataUri: string, name: string): Promise<FileData> {
  const { blob, extension } = dataUriToBlob(dataUri)
  const form = new FormData()
  form.append('files', blob, `${name}.${extension}`)
  const response = await fetch(`${host()}${prefix}/upload`, {
    method: 'POST',
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  })
  if (!response.ok) throw Object.assign(friendly(await response.text().catch(() => ''), response.status), { status: response.status })
  const paths = (await response.json().catch(() => null)) as unknown
  const path = Array.isArray(paths) ? paths[0] : null
  if (typeof path !== 'string' || !path) throw friendly('upload returned no path')
  return { path, meta: { _type: 'gradio.FileData' } }
}

/** Submits a try-on. Returns a job id for pollHfTryOn. */
export async function startHfTryOn(personDataUri: string, garmentDataUri: string, garmentName: string): Promise<string> {
  if (!hfReady()) throw new Error('The free try-on fallback is not configured. Set HF_TOKEN on the server.')
  let lastError: Error | null = null
  for (const flag of ['r', 'g'] as PrefixFlag[]) {
    const prefix = PREFIXES[flag]
    try {
      const [person, garment] = await Promise.all([upload(prefix, personDataUri, 'person'), upload(prefix, garmentDataUri, 'garment')])
      const response = await fetch(`${host()}${prefix}/call/${API_NAME}`, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          data: [
            // ImageEditor value; the Space masks the clothing area automatically (is_checked = true below).
            { background: person, layers: [], composite: person },
            garment,
            garmentName.slice(0, 80) || 'garment',
            true, // use auto-masking
            false, // auto-crop and resize
            30, // denoising steps
            42, // seed
          ],
        }),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      })
      if (!response.ok) throw Object.assign(friendly(await response.text().catch(() => ''), response.status), { status: response.status })
      const json = (await response.json().catch(() => null)) as { event_id?: unknown } | null
      if (typeof json?.event_id !== 'string' || !json.event_id) throw friendly('call returned no event_id')
      return `${flag}${json.event_id}`
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The free try-on service did not respond. Please retry.')
      // Only a missing endpoint means "wrong API prefix, try the other one"; anything else is final.
      if ((error as { status?: number }).status !== 404) break
    }
  }
  if (lastError?.name === 'TimeoutError' || lastError?.name === 'AbortError') {
    throw new Error('The free try-on service did not respond in time. Please retry.')
  }
  throw lastError ?? new Error('The free try-on service did not respond. Please retry.')
}

interface SseEvent {
  event: string
  data: string
}

function parseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ''
  const events: SseEvent[] = []
  for (const block of blocks) {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    events.push({ event, data: data.join('\n') })
  }
  return { events, rest }
}

async function download(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok) throw friendly('result download failed', response.status)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const contentType = (response.headers.get('content-type') || 'image/png').split(';')[0]!.trim()
  if (bytes.byteLength < 1000) throw friendly('result image was empty')
  return { bytes, contentType: contentType.startsWith('image/') ? contentType : 'image/png' }
}

/** Listens for up to a few seconds. Returns "processing" if the Space has not finished, so the browser polls again. */
export async function pollHfTryOn(jobId: string): Promise<HfPollResult> {
  const flag = jobId[0] as PrefixFlag
  const eventId = jobId.slice(1)
  if (!(flag in PREFIXES) || !eventId) throw new Error('Missing try-on job.')
  const prefix = PREFIXES[flag]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POLL_WINDOW_MS)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(`${host()}${prefix}/call/${API_NAME}/${encodeURIComponent(eventId)}`, {
      headers: headers({ accept: 'text/event-stream' }),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) throw friendly(await response.text().catch(() => ''), response.status)
    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseEvents(buffer)
      buffer = parsed.rest
      for (const event of parsed.events) {
        if (event.event === 'error') throw friendly(event.data || 'error event')
        if (event.event !== 'complete') continue
        const output = (JSON.parse(event.data || '[]') as unknown[])[0] as { url?: string; path?: string } | null
        const url = output?.url || (output?.path ? `${host()}${prefix}/file=${output.path}` : '')
        if (!url) throw friendly('complete event had no image')
        const image = await download(url)
        return { status: 'completed', ...image }
      }
    }
    // The stream ended before a result: keep waiting; the browser stops polling after its own time limit.
    return { status: 'processing' }
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') return { status: 'processing' }
    throw error instanceof Error ? error : friendly(String(error))
  } finally {
    clearTimeout(timer)
    reader?.cancel().catch(() => undefined)
  }
}

/** Setup check for /api/tryon-health: is the Space reachable, which Gradio version/prefix, is the token accepted. No secrets. */
export async function hfHealth() {
  const started = Date.now()
  const result: Record<string, unknown> = { tokenSet: hfReady(), space: host() }
  try {
    const config = await fetch(`${host()}/config`, { headers: headers(), signal: AbortSignal.timeout(10_000) })
    result.configStatus = config.status
    if (config.ok) {
      const json = (await config.json().catch(() => null)) as { version?: string; api_prefix?: string; protocol?: string } | null
      result.gradioVersion = json?.version
      result.apiPrefix = json?.api_prefix ?? ''
      result.protocol = json?.protocol
    }
    for (const [flag, prefix] of Object.entries(PREFIXES)) {
      const info = await fetch(`${host()}${prefix}/info`, { headers: headers(), signal: AbortSignal.timeout(10_000) }).catch(() => null)
      result[`info_${flag === 'r' ? 'root' : 'gradio_api'}`] = info ? info.status : 'unreachable'
    }
    result.note = 'reachable'
  } catch (error) {
    result.note = error instanceof Error ? error.name : 'unreachable'
  }
  result.ms = Date.now() - started
  return result
}
