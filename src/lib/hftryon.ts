// SERVER-ONLY. Free fallback try-on through a public Hugging Face Space running IDM-VTON (Gradio).
//
// Why a fallback: PixelAPI's free credits run out. The Space costs nothing but is shared: it queues, can be asleep
// or busy, and a free Hugging Face account only gets a small daily GPU quota. Fine for demos, not for production.
// The model is released under CC BY-NC-SA 4.0 (non-commercial); check its licence before charging users.
//
// Gradio queue API over plain HTTP (no extra dependency), the same protocol Gradio's own JS client uses:
//   1. GET  {space}/config            -> which function index is the "tryon" endpoint
//   2. POST {space}/upload            -> server paths for the two images
//   3. POST {space}/queue/join        -> joins the queue under a session_hash we choose
//   4. GET  {space}/queue/data?session_hash=...  -> server-sent events; each poll listens for a few seconds
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
  const detailText = detail.replace(/hf_[A-Za-z0-9]+/g, '[token]').replace(/\s+/g, ' ').trim().slice(0, 240)
  return new Error(
    `The free try-on service could not process these photos${status ? ` (code ${status})` : ''}${detailText ? ` [${detailText}]` : ''}. Use a clear, front-facing photo of a person and a top, shirt or jacket.`,
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
  orig_name: string
  meta: { _type: 'gradio.FileData' }
}

async function upload(prefix: string, dataUri: string, name: string): Promise<FileData> {
  const { blob, extension } = dataUriToBlob(dataUri)
  const filename = `${name}.${extension}`
  const form = new FormData()
  form.append('files', blob, filename)
  const response = await fetch(`${host()}${prefix}/upload`, {
    method: 'POST',
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  })
  if (!response.ok) throw Object.assign(friendly(await response.text().catch(() => ''), response.status), { status: response.status })
  const paths = (await response.json().catch(() => null)) as unknown
  const first = Array.isArray(paths) ? paths[0] : null
  const path = typeof first === 'string' ? first : (first as { path?: string } | null)?.path
  if (!path) throw friendly(`upload returned an unexpected body: ${JSON.stringify(paths).slice(0, 120)}`)
  return { path, orig_name: filename, meta: { _type: 'gradio.FileData' } }
}

let cachedFnIndex: number | null = null

/** The index of the "tryon" function in the Space's config (Gradio's queue API addresses functions by index). */
async function tryonFnIndex(prefix: string): Promise<number> {
  if (cachedFnIndex !== null) return cachedFnIndex
  const response = await fetch(`${host()}${prefix}/config`, { headers: headers(), signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS) })
  if (!response.ok) throw Object.assign(friendly(await response.text().catch(() => ''), response.status), { status: response.status })
  const config = (await response.json().catch(() => null)) as {
    dependencies?: Array<{ id?: number; api_name?: string | null; inputs?: unknown[]; outputs?: unknown[] }>
  } | null
  const dependencies = config?.dependencies ?? []
  const clean = (name?: string | null) => (name ?? '').replace(/^\//, '')
  // Prefer the named endpoint; otherwise the function shaped like the try-on (7 inputs, 2 outputs).
  let position = dependencies.findIndex((item) => clean(item.api_name) === API_NAME)
  if (position < 0) position = dependencies.findIndex((item) => item.inputs?.length === 7 && item.outputs?.length === 2)
  const dependency = dependencies[position]
  if (!dependency) {
    const names = dependencies.map((item) => clean(item.api_name) || '-').slice(0, 12).join(',')
    throw friendly(`no "${API_NAME}" function in the Space config (${dependencies.length} functions: ${names}; keys: ${Object.keys(config ?? {}).slice(0, 8).join(',')})`)
  }
  const index = typeof dependency.id === 'number' ? dependency.id : position
  cachedFnIndex = index
  return index
}

function sessionHash(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(36).padStart(2, '0')).join('')
}

/** Submits a try-on. Returns a job id for pollHfTryOn. */
export async function startHfTryOn(personDataUri: string, garmentDataUri: string, garmentName: string): Promise<string> {
  if (!hfReady()) throw new Error('The free try-on fallback is not configured. Set HF_TOKEN on the server.')
  let lastError: Error | null = null
  for (const flag of ['r', 'g'] as PrefixFlag[]) {
    const prefix = PREFIXES[flag]
    try {
      const fnIndex = await tryonFnIndex(prefix)
      const [person, garment] = await Promise.all([upload(prefix, personDataUri, 'person'), upload(prefix, garmentDataUri, 'garment')])
      const hash = sessionHash()
      const response = await fetch(`${host()}${prefix}/queue/join`, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          fn_index: fnIndex,
          session_hash: hash,
          event_data: null,
          trigger_id: null,
          data: [
            // ImageEditor value; the Space masks the clothing area automatically (auto-masking = true below).
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
      return `${flag}${hash}`
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
  data: string
}

function parseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ''
  const events: SseEvent[] = []
  for (const block of blocks) {
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length) events.push({ data: data.join('\n') })
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

interface QueueMessage {
  msg?: string
  success?: boolean
  output?: { data?: unknown[]; error?: string | null }
  title?: string
}

/** Listens for up to a few seconds. Returns "processing" if the Space has not finished, so the browser polls again. */
export async function pollHfTryOn(jobId: string): Promise<HfPollResult> {
  const flag = jobId[0] as PrefixFlag
  const hash = jobId.slice(1)
  if (!(flag in PREFIXES) || !hash) throw new Error('Missing try-on job.')
  const prefix = PREFIXES[flag]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POLL_WINDOW_MS)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(`${host()}${prefix}/queue/data?session_hash=${encodeURIComponent(hash)}`, {
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
        let message: QueueMessage
        try {
          message = JSON.parse(event.data) as QueueMessage
        } catch {
          continue
        }
        if (message.msg !== 'process_completed') continue
        if (!message.success) throw friendly(String(message.output?.error ?? message.title ?? 'process failed'))
        const output = message.output?.data?.[0] as { url?: string; path?: string } | null | undefined
        const url = output?.url || (output?.path ? `${host()}${prefix}/file=${output.path}` : '')
        if (!url) throw friendly('completed without an image')
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
