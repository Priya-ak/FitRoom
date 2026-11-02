import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Camera, Check, Download, ImagePlus, Loader2, RefreshCw, Share2, Shirt, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { useAction } from '@/lib/actions'
import { AUDIENCES, CATALOG, HERO_IMG, categoriesFor, isPlaceholderGarment, type FitRecord, type Garment } from '@/lib/fitroom'
import { saveUserFit } from '@/server/fits'
import { getRuntimeStatus, pollTryOn, startTryOn, uploadTryonPhoto } from '@/server/tryon'

export const Route = createFileRoute('/')({
  component: Home,
})

const FITS_KEY = 'fitroom-fits-v1'
const MAX_MB = 8

function loadFits(): FitRecord[] {
  try {
    const raw = localStorage.getItem(FITS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as FitRecord[]
    if (!Array.isArray(arr)) return []
    const isSavedUrl = (u: unknown) =>
      typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'));
    return arr.filter(
      (f) =>
        f &&
        typeof f.id === 'string' &&
        isSavedUrl(f.resultUrl) &&
        isSavedUrl(f.selfieUrl),
    )
  } catch {
    return []
  }
}

type PhotoState = { localUrl: string; remoteUrl: string; uploading: boolean; error: string; name: string }

const emptyPhoto: PhotoState = { localUrl: '', remoteUrl: '', uploading: false, error: '', name: '' }

function isAiFit(fit: FitRecord): boolean {
  return fit.mode === 'exact' || (typeof fit.note === 'string' && fit.note.startsWith('AI try-on of your uploaded photo'))
}

function Home() {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [audience, setAudience] = useState('All')
  const [selected, setSelected] = useState<Garment | null>(null)
  const [selfie, setSelfie] = useState<PhotoState>(emptyPhoto)
  const [garmentPhoto, setGarmentPhoto] = useState<PhotoState>(emptyPhoto)
  const [customGarmentName, setCustomGarmentName] = useState('')
  const [customAudience, setCustomAudience] = useState<'Women' | 'Men' | 'Kids' | 'Unisex'>('Unisex')
  const [fits, setFits] = useState<FitRecord[]>([])
  const [activeFitId, setActiveFitId] = useState<string | null>(null)
  const [cleared, setCleared] = useState(false)
  const [detail, setDetail] = useState<Garment | null>(null)
  const [shareMsg, setShareMsg] = useState('')
  const [exactMode, setExactMode] = useState(false)
  const [aiReady, setAiReady] = useState(false)
  const [storageNote, setStorageNote] = useState('')
  const [genPending, setGenPending] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genProgress, setGenProgress] = useState('')
  const [compare, setCompare] = useState(58)
  const selfieInput = useRef<HTMLInputElement>(null)
  const garmentInput = useRef<HTMLInputElement>(null)
  const genLock = useRef(false)
  const photoUploadIds = useRef({ selfie: 0, garment: 0 })

  useEffect(() => {
    try {
      setFits(loadFits())
    } catch {
      setFits([])
    }
    void getRuntimeStatus()
      .then((status) => {
        setAiReady(Boolean(status.exact))
        setStorageNote(status.storage.backend === 'local' ? status.storage.detail : '')
      })
      .catch(() => {
        setAiReady(false)
      })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FITS_KEY, JSON.stringify(fits.slice(0, 24)))
    } catch {
      /* storage full — keep in memory */
    }
  }, [fits])

  const categoryOptions = useMemo(() => categoriesFor(audience), [audience])
  useEffect(() => {
    if (!categoryOptions.includes(cat)) setCat('All')
  }, [categoryOptions, cat])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATALOG.filter((g) => {
      const okCat = cat === 'All' || g.category === cat
      const okAud = audience === 'All' || g.audience === audience
      const okQ = !q || `${g.name} ${g.category} ${g.audience} ${g.clothingType} ${g.color} ${g.blurb}`.toLowerCase().includes(q)
      return okCat && okAud && okQ
    })
  }, [query, cat, audience])

  const activeGarment: Garment | null = garmentPhoto.remoteUrl
    ? {
        id: 'custom',
        name: customGarmentName.trim() || 'My garment',
        category: 'Custom',
        audience: customAudience,
        clothingType: 'Custom garment',
        color: 'Custom',
        sizes: [],
        price: 'Your piece',
        fabric: 'Your uploaded garment',
        description: 'Your uploaded piece.',
        blurb: 'Your uploaded piece.',
        image: garmentPhoto.remoteUrl,
      }
    : (selected ?? null)

  const garmentNeedsPhoto = Boolean(activeGarment && isPlaceholderGarment(activeGarment.image) && !garmentPhoto.remoteUrl)
  const canGenerate = Boolean(selfie.remoteUrl) && Boolean(activeGarment) && !selfie.uploading && !garmentPhoto.uploading && !garmentNeedsPhoto

  function rememberFit(rec: FitRecord) {
    setFits((prev) => [rec, ...prev].slice(0, 24))
    setActiveFitId(rec.id)
    setCleared(false)
    void saveUserFit({
      data: {
        id: rec.id,
        createdAt: rec.createdAt,
        selfieUrl: rec.selfieUrl,
        garmentUrl: rec.garmentUrl,
        garmentName: rec.garmentName,
        garmentCategory: rec.garmentCategory,
        resultUrl: rec.resultUrl,
        note: rec.note,
      },
    }).catch((error) => console.warn('[fitroom] account save skipped', error))
  }

  async function runGenerate() {
    if (!canGenerate || genLock.current || !activeGarment) return
    genLock.current = true
    setGenPending(true)
    setGenError(null)
    setGenProgress('Preparing your photo and garment…')
    document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    try {
      const started = await startTryOn({
        data: {
          selfieUrl: selfie.remoteUrl,
          garmentUrl: activeGarment.image,
          garmentName: activeGarment.name,
          garmentCategory: activeGarment.category,
        },
      })
      setGenProgress('Fitting the garment onto your photo…')
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000))
        const poll = await pollTryOn({ data: { jobId: started.jobId } })
        if (poll.status === 'completed' && poll.imageUrl) {
          setExactMode(true)
          rememberFit({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            selfieUrl: selfie.remoteUrl,
            garmentUrl: activeGarment.image,
            garmentName: activeGarment.name,
            garmentCategory: activeGarment.category,
            resultUrl: poll.imageUrl,
            note: poll.note ?? `Wearing ${activeGarment.name} on your uploaded photo.`,
            mode: 'exact',
          })
          setGenProgress('')
          return
        }
        setGenProgress('Still generating — keeping your identity, changing the clothes…')
      }
      throw new Error('The try-on is taking too long. Wait a minute and retry. No fake result was shown.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The AI try-on could not complete. Please retry.'
      setGenError(message)
    } finally {
      genLock.current = false
      setGenPending(false)
    }
  }

  const activeFit = cleared ? null : (fits.find((f) => f.id === activeFitId) ?? fits[0] ?? null)
  const latestResultUrl = activeFit?.resultUrl ?? ''
  const latestNote = activeFit?.note ?? ''

  async function handleFile(kind: 'selfie' | 'garment', file: File | undefined) {
    if (!file) return
    const set = kind === 'selfie' ? setSelfie : setGarmentPhoto
    const type = file.type.toLowerCase()
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
      set((p) => ({ ...p, error: 'Please choose a JPG, PNG or WEBP image.' }))
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      set((p) => ({ ...p, error: `That file is over ${MAX_MB}MB. Please choose a smaller photo.` }))
      return
    }
    const previousUrl = kind === 'selfie' ? selfie.localUrl : garmentPhoto.localUrl
    if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
    const uploadId = ++photoUploadIds.current[kind]
    const localUrl = URL.createObjectURL(file)
    set({ localUrl, remoteUrl: '', uploading: true, error: '', name: file.name })
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await uploadTryonPhoto({ data: fd })
      if (photoUploadIds.current[kind] !== uploadId) return
      const remote = res.url
      if (!remote) throw new Error('The storage service did not return an image URL.')
      set({ localUrl, remoteUrl: remote, uploading: false, error: '', name: file.name })
      if (kind === 'garment') setCustomGarmentName((v) => v || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40))
    } catch (e) {
      if (photoUploadIds.current[kind] === uploadId) {
        set({ localUrl, remoteUrl: '', uploading: false, error: e instanceof Error ? e.message : 'Upload failed. Please try again.', name: file.name })
      }
    }
  }

  function clearPhoto(kind: 'selfie' | 'garment') {
    photoUploadIds.current[kind] += 1
    if (kind === 'selfie') {
      if (selfie.localUrl.startsWith('blob:')) URL.revokeObjectURL(selfie.localUrl)
      setSelfie(emptyPhoto)
      if (selfieInput.current) selfieInput.current.value = ''
    } else {
      if (garmentPhoto.localUrl.startsWith('blob:')) URL.revokeObjectURL(garmentPhoto.localUrl)
      setGarmentPhoto(emptyPhoto)
      setCustomGarmentName('')
      setCustomAudience('Unisex')
      if (garmentInput.current) garmentInput.current.value = ''
    }
  }

  async function downloadUrl(url: string, name: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 4000)
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }

  async function shareFit(fit: FitRecord) {
    setShareMsg('')
    const shareData = { title: `FitRoom — ${fit.garmentName}`, text: `My FitRoom try-on: ${fit.garmentName}`, url: fit.resultUrl }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      throw new Error('no-share')
    } catch {
      try {
        await navigator.clipboard.writeText(fit.resultUrl)
        setShareMsg('Link copied — paste it anywhere to share your look.')
      } catch {
        setShareMsg('Copy this link to share: ' + fit.resultUrl)
      }
    }
  }

  function saveComposite(url: string, garmentName: string, garmentCategory: string, selfieUrl: string, garmentUrl: string) {
    const rec: FitRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      selfieUrl,
      garmentUrl,
      garmentName,
      garmentCategory,
      resultUrl: url,
      note: 'On-photo fitting — your own photo with the garment placed on you.',
    }
    setFits((prev) => [rec, ...prev].slice(0, 24))
    setActiveFitId(rec.id)
    setCleared(false)
    setExactMode(false)
  }

  const selfieView = selfie.localUrl || selfie.remoteUrl
  const garmentView = garmentPhoto.localUrl || garmentPhoto.remoteUrl || activeGarment?.image

  return (
    <main className="bg-white">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,#f3e8d3,transparent)]" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-[#f8f7f4] px-3 py-1.5 text-xs font-semibold tracking-widest text-neutral-600 uppercase">
              <Sparkles className="size-3.5 text-[#c9a96a]" /> Virtual atelier · No sign-in
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              The dress goes on <em className="text-[#c9a96a] not-italic">your photo</em>, not a model's.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Choose a garment photo from the catalogue or upload your own. When FASHN is configured,
            FitRoom uses your selfie and that garment image for a real AI try-on — never a random model result.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#studio" className="rounded-full bg-[#111111] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/10 transition hover:bg-black">
                Start your try-on
              </a>
              <a href="#collection" className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-[#1a1a1e] transition hover:border-[#1a1a1e]">
                Browse the collection
              </a>
            </div>
            <dl className="mt-8 flex flex-wrap gap-6 text-sm">
              {[
                ['Your photo', 'stays yours'],
                  ['Women · Men · Kids · Unisex', 'racks included'],
                  ['FASHN AI', 'when configured'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-xl font-semibold">{v}</dt>
                  <dd className="text-neutral-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-neutral-200 shadow-2xl shadow-neutral-900/10">
              <img src={HERO_IMG} alt="Model wearing a champagne slip dress in a bright atelier" className="aspect-[4/5] w-full object-cover sm:aspect-[5/5]" />
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:left-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#111111] text-white"><Wand2 className="size-5" /></span>
              <div className="text-sm">
                <p className="font-semibold">On-photo fitting</p>
                <p className="text-neutral-500">Your selfie + garment → your look</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" id="guide">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Three steps to your fitting</h2>
        <p className="mt-2 max-w-2xl text-neutral-600">Your face never changes. The garment comes to you.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Camera, t: '1 · Add your photo', d: 'Front-facing, daylight, fitted top. Shoulders and waist visible works best — this photo is the final result.' },
            { icon: Shirt, t: '2 · Pick a garment', d: 'Browse Women, Men, Kids and Unisex; upload a real garment photo when a catalogue illustration is shown.' },
            { icon: Sparkles, t: '3 · Generate your try-on', d: 'FASHN uses your uploaded selfie and the selected garment photo. Manual overlays are clearly marked as previews.' },
          ].map((s) => (
            <div key={s.t} className="rounded-3xl border border-neutral-200 bg-[#f8f7f4] p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#111111] text-white"><s.icon className="size-5" /></span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COLLECTION */}
      <section className="scroll-mt-20 border-y border-neutral-200 bg-[#f8f7f4]" id="collection">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#8a6d2b] uppercase">The collection</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Women · Men · Kids · Unisex</h2>
              <p className="mt-1 text-sm text-neutral-600">Select a catalogue piece to pre-fill the studio. Some catalogue cards are illustrations; upload a real garment photo for those before generating.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search silk, kurta, kids…"
                className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400 focus:border-[#111111] sm:w-56"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Shop by">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${audience === a ? 'bg-[#c9a96a] text-[#1a1a1e]' : 'border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500'}`}
              >
                {a === 'All' ? 'Everyone' : a}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {categoryOptions.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${cat === c ? 'bg-[#111111] text-white' : 'border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500'}`}
              >
                {c}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <p className="font-display text-xl font-semibold">Nothing matches “{query}”</p>
              <p className="mt-1 text-sm text-neutral-500">Try “silk”, “kurta” or clear the filters to see everything.</p>
              <button onClick={() => { setQuery(''); setCat('All'); setAudience('All') }} className="mt-4 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white">Show everything</button>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {filtered.map((g) => {
                const isSel = selected?.id === g.id && !garmentPhoto.remoteUrl
                return (
                  <article key={g.id} className={`group overflow-hidden rounded-3xl border bg-white transition ${isSel ? 'border-[#111111] shadow-lg' : 'border-neutral-200 hover:shadow-lg'}`}>
                    <button onClick={() => setDetail(g)} className="block w-full text-left" aria-label={`View ${g.name}`}>
                      <div className="relative overflow-hidden">
                        <img src={g.image} alt={g.name} loading="lazy" className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">{g.audience} · {g.category}</span>
                        {isSel && <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#111111] px-2.5 py-1 text-[11px] font-semibold text-white"><Check className="size-3" /> In studio</span>}
                      </div>
                    </button>
                    <div className="p-4">
                      <h3 className="font-display text-[15px] leading-snug font-semibold">{g.name}</h3>
                      <p className="mt-0.5 text-xs text-neutral-500">{g.price} · {g.blurb}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => { setSelected(g); clearPhoto('garment'); document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' }) }}
                          className={`flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition ${isSel ? 'bg-[#f8f7f4] text-[#1a1a1e] ring-1 ring-[#111111]' : 'bg-[#111111] text-white hover:bg-black'}`}
                        >
                          {isSel ? 'Selected' : 'Try this on'}
                        </button>
                        <button onClick={() => setDetail(g)} className="rounded-full border border-neutral-300 px-3 py-2 text-[13px] font-semibold text-neutral-700 hover:border-neutral-500" aria-label={`Details for ${g.name}`}>
                          View
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* STUDIO */}
      <section id="studio" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#8a6d2b] uppercase">The studio</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Create your look — on your photo</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 sm:text-base">Generate a FASHN AI try-on with your uploaded selfie and the selected garment. A separate manual overlay preview is available below.</p>
        {storageNote && <p role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{storageNote}</p>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <Uploader
              label="Your photo"
              hint="Front-facing · daylight · fitted top — this stays the final image"
              photo={selfie}
              inputRef={selfieInput}
              onPick={(f) => handleFile('selfie', f)}
              onClear={() => clearPhoto('selfie')}
              icon={<Camera className="size-5" />}
            />
            <Uploader
              label="Garment photo"
              hint="Or keep the selected collection piece below"
              photo={garmentPhoto}
              inputRef={garmentInput}
              onPick={(f) => handleFile('garment', f)}
              onClear={() => clearPhoto('garment')}
              icon={<ImagePlus className="size-5" />}
            />
            {activeGarment && !garmentPhoto.remoteUrl && (
              <div className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-[#f8f7f4] p-3">
                <img src={activeGarment.image} alt={activeGarment.name} className="size-16 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activeGarment.name}</p>
                  <p className="text-xs text-neutral-500">{activeGarment.audience} · {activeGarment.category}{activeGarment.price ? ` · ${activeGarment.price}` : ''}</p>
                </div>
                <a href="#collection" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:border-neutral-500">Change</a>
              </div>
            )}
            {garmentPhoto.remoteUrl && (
              <div>
                <label htmlFor="gname" className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Name this piece</label>
                <input id="gname" value={customGarmentName} onChange={(e) => setCustomGarmentName(e.target.value)} placeholder="e.g. Vintage denim jacket" className="mt-1.5 w-full rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-[#111111]" maxLength={60} />
                <label htmlFor="gaudience" className="mt-3 block text-xs font-semibold tracking-wide text-neutral-500 uppercase">Who is this garment for?</label>
                <select id="gaudience" value={customAudience} onChange={(e) => setCustomAudience(e.target.value as 'Women' | 'Men' | 'Kids' | 'Unisex')} className="mt-1.5 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#111111]">
                  <option value="Women">Women</option>
                  <option value="Men">Men</option>
                  <option value="Kids">Kids</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>
            )}

            <button
              disabled={!canGenerate || genPending}
              onClick={() => void runGenerate()}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold shadow-lg transition ${canGenerate && !genPending ? 'bg-[#111111] text-white shadow-neutral-900/15 hover:bg-black' : 'cursor-not-allowed bg-neutral-200 text-neutral-500 shadow-none'}`}
            >
              {genPending ? (<><Loader2 className="size-4 animate-spin" /> Generating AI try-on…</>) : (<><Wand2 className="size-4" /> Generate AI try-on</>)}
            </button>
            {!aiReady && <p role="status" className="text-center text-xs text-amber-800">AI try-on is not configured. Set FASHN_API_KEY on the server to generate a result.</p>}
            {!canGenerate && (
              <p className="text-center text-xs text-neutral-500">
                {selfie.remoteUrl
                  ? garmentNeedsPhoto
                    ? 'This catalogue item is an illustration. Upload a real garment photo to generate a try-on.'
                    : activeGarment
                      ? 'Ready to generate your AI try-on.'
                      : 'Choose a collection piece or upload a garment.'
                  : 'Add your photo to begin — then pick or upload a garment.'}
              </p>
            )}
            {genProgress && genPending && <p role="status" className="text-center text-xs text-neutral-600">{genProgress}</p>}
            {genError && (
              <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {genError} <button onClick={() => setGenError(null)} className="ml-1 font-semibold underline">Dismiss</button>
              </p>
            )}
          </div>

          <div className="space-y-4">
            <OnPhotoFit
              selfieUrl={selfieView}
              garmentUrl={garmentView ?? ''}
              garmentName={activeGarment?.name ?? 'Look'}
              garmentCategory={activeGarment?.category ?? ''}
              selfieRemote={selfie.remoteUrl}
              garmentRemote={activeGarment?.image ?? ''}
              onSave={saveComposite}
            />
            <div id="result" className="scroll-mt-24 rounded-[2rem] border border-neutral-200 bg-[#f8f7f4] p-4 sm:p-6">
              {!latestResultUrl && !genPending ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#f8f7f4]"><Sparkles className="size-6 text-[#c9a96a]" /></span>
                  <h3 className="mt-4 font-display text-xl font-semibold">Your photo look lives here</h3>
                  <p className="mt-1 max-w-xs text-sm text-neutral-500">Select a garment photo and generate a real AI try-on. Manual overlays are labeled as previews, not AI results.</p>
                </div>
              ) : genPending && !latestResultUrl ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center">
                  <Loader2 className="size-10 animate-spin text-[#c9a96a]" />
                  <h3 className="mt-4 font-display text-xl font-semibold">Generating your AI try-on…</h3>
                  <p className="mt-1 max-w-xs text-sm text-neutral-500">FASHN is applying your selected garment to your uploaded photo.</p>
                </div>
              ) : latestResultUrl ? (
                <div className="relative">
                  {genPending && (
                    <div role="status" className="mb-3 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
                      <Loader2 className="size-4 animate-spin text-[#c9a96a]" /> Generating your next look…
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold">{activeFit?.garmentName ?? activeGarment?.name ?? 'Your look'}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-widest text-neutral-500 uppercase ring-1 ring-neutral-200">{exactMode ? 'AI try-on' : 'Manual preview'}</span>
                  </div>
                  <div className="mt-3">
                    {activeFit && <img src={activeFit.resultUrl} alt={`${activeFit.garmentName} on your photo`} className="aspect-[3/4] w-full rounded-2xl border border-neutral-200 bg-white object-cover" />}
                  </div>
                  {!exactMode && <p className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-neutral-600">This is a manually positioned photo preview, not an AI fitting or a prediction of garment fit. Use “Generate AI try-on” for the FASHN result.</p>}
                  {latestNote && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-neutral-600 ring-1 ring-neutral-200">{latestNote}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => latestResultUrl && activeFit && downloadUrl(latestResultUrl, `fitroom-${activeFit.garmentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`)} className="flex items-center gap-1.5 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black">
                      <Download className="size-4" /> Download
                    </button>
                    <button onClick={() => activeFit && shareFit(activeFit)} className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:border-neutral-500">
                      <Share2 className="size-4" /> Share
                    </button>
                    <button onClick={() => { setActiveFitId(null); setCleared(true); setExactMode(false); setGenError(null); setGenProgress('') }} className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:border-neutral-500">
                      <RefreshCw className="size-4" /> New look
                    </button>
                  </div>
                  {shareMsg && <p className="mt-2 text-xs text-neutral-500">{shareMsg}</p>}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* FITS */}
      <section id="fits" className="border-t border-neutral-200 bg-[#f8f7f4]">
        <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">My Fits</h2>
              <p className="mt-1 text-sm text-neutral-600">On-photo fittings and previews stay on this device automatically. Download any look to keep it forever.</p>
            </div>
            {fits.length > 0 && (
              <button onClick={() => { setFits([]); setActiveFitId(null); setCleared(true) }} className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600">
                <Trash2 className="size-3.5" /> Clear all
              </button>
            )}
          </div>
          {fits.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <p className="font-display text-xl font-semibold">No fittings yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">Your recent try-ons will live here — even if you close the page. Create your first look in the studio above.</p>
              <a href="#studio" className="mt-4 inline-block rounded-full bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white">Open the studio</a>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {fits.map((f) => (
                <article key={f.id} className={`overflow-hidden rounded-3xl border bg-white ${activeFitId === f.id ? 'border-[#111111]' : 'border-neutral-200'}`}>
                  <button onClick={() => { setActiveFitId(f.id); setCleared(false); setExactMode(isAiFit(f)) }} className="block w-full text-left">
                    <img src={f.resultUrl} alt={`${f.garmentName} try-on`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  </button>
                  <div className="p-3.5">
                    <p className="truncate text-sm font-semibold">{f.garmentName}</p>
                    <p className="text-[11px] text-neutral-500">{new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {f.garmentCategory || (f as unknown as { category?: string }).category || 'Custom'}</p>
                    <div className="mt-2.5 flex gap-1.5">
                      <button onClick={() => { setActiveFitId(f.id); setCleared(false); setExactMode(isAiFit(f)) }} className="flex-1 rounded-full bg-[#111111] px-2 py-1.5 text-xs font-semibold text-white">View</button>
                      <button onClick={() => downloadUrl(f.resultUrl, `fitroom-${f.id.slice(0, 6)}.jpg`)} className="rounded-full border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold" aria-label={`Download ${f.garmentName}`}><Download className="size-3.5" /></button>
                      <button onClick={() => shareFit(f)} className="rounded-full border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold" aria-label={`Share ${f.garmentName}`}><Share2 className="size-3.5" /></button>
                      <button onClick={() => setFits((p) => p.filter((x) => x.id !== f.id))} className="rounded-full border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-red-300 hover:text-red-600" aria-label={`Delete ${f.garmentName}`}><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {shareMsg && fits.length > 0 && <p className="mt-3 text-xs text-neutral-500">{shareMsg}</p>}
        </div>
      </section>

      {/* Garment detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => setDetail(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-white sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
            <div className="grid sm:grid-cols-2">
              <img src={detail.image} alt={detail.name} className="aspect-[3/4] w-full object-cover sm:aspect-auto sm:h-full" />
              <div className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-[#f8f7f4] px-3 py-1 text-[11px] font-semibold tracking-widest uppercase">{detail.audience} · {detail.category}</span>
                  <button onClick={() => setDetail(null)} className="rounded-full border border-neutral-200 p-1.5 hover:border-neutral-400" aria-label="Close details"><X className="size-4" /></button>
                </div>
                <h3 className="mt-3 font-display text-2xl font-semibold">{detail.name}</h3>
                <p className="mt-1 text-sm font-medium text-[#8a6d2b]">{detail.price} · {detail.fabric}</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{detail.blurb}. {detail.description}</p>
                <div className="mt-auto flex gap-2 pt-6">
                  <button
                    onClick={() => { setSelected(detail); clearPhoto('garment'); setDetail(null); document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' }) }}
                    className="flex-1 rounded-full bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                  >
                    Try this on — on my photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function OnPhotoFit({ selfieUrl, garmentUrl, garmentName, garmentCategory, selfieRemote, garmentRemote, onSave }: {
  selfieUrl: string
  garmentUrl: string
  garmentName: string
  garmentCategory: string
  selfieRemote: string
  garmentRemote: string
  onSave: (url: string, name: string, cat: string, selfie: string, garment: string) => void
}) {
  const [scale, setScale] = useState(72)
  const [posX, setPosX] = useState(50)
  const [posY, setPosY] = useState(58)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const ready = Boolean(selfieUrl) && Boolean(garmentUrl)
  const save = useAction(uploadTryonPhoto, {
    onSuccess: (res) => {
      const url = (res as unknown as { url?: string }).url
      if (url) {
        onSave(url, garmentName, garmentCategory, selfieRemote, garmentRemote)
        setMsg('Saved to My Fits below.')
        document.getElementById('fits')?.scrollIntoView({ behavior: 'smooth' })
      }
      setSaving(false)
    },
    onError: () => setSaving(false),
  })

  function onPointerDown(e: React.PointerEvent) {
    if (!boxRef.current) return
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, px: posX, py: posY }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    const box = boxRef.current
    if (!d || !box) return
    const r = box.getBoundingClientRect()
    const dx = ((e.clientX - d.x) / r.width) * 100
    const dy = ((e.clientY - d.y) / r.height) * 100
    setPosX(Math.min(88, Math.max(12, d.px + dx)))
    setPosY(Math.min(92, Math.max(8, d.py + dy)))
  }
  function onPointerUp() { dragRef.current = null }

  async function downloadComposite() {
    setMsg('')
    try {
      const selfieImg = await loadImage(selfieUrl)
      const garmentImg = await loadImage(garmentUrl)
      const W = 1080, H = 1440
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      // cover-fit selfie
      const sr = Math.max(W / selfieImg.width, H / selfieImg.height)
      const sw = selfieImg.width * sr, sh = selfieImg.height * sr
      ctx.drawImage(selfieImg, (W - sw) / 2, (H - sh) / 2, sw, sh)
      // garment contain-fit at slider position
      const gw = (W * scale) / 100
      const gh = (garmentImg.height / garmentImg.width) * gw
      const gx = (W * posX) / 100 - gw / 2
      const gy = (H * posY) / 100 - gh / 2
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 40
      ctx.drawImage(garmentImg, gx, gy, gw, gh)
      ctx.restore()
      ctx.fillStyle = 'rgba(17,17,17,0.72)'
      roundRect(ctx, 28, H - 120, 560, 72, 36)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = '600 34px Inter, system-ui, sans-serif'
      ctx.fillText(`FitRoom · ${garmentName}`.slice(0, 32), 58, H - 74)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('export failed')
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = `fitroom-onphoto-${garmentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}.jpg`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 4000)
      setMsg('Downloaded — your face and photo are unchanged.')
    } catch {
      setMsg('Could not export just now. Try again.')
    }
  }

  async function saveToFits() {
    setMsg('')
    if (!ready) return
    setSaving(true)
    try {
      const selfieImg = await loadImage(selfieUrl)
      const garmentImg = await loadImage(garmentUrl)
      const W = 1080, H = 1440
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      const sr = Math.max(W / selfieImg.width, H / selfieImg.height)
      const sw = selfieImg.width * sr, sh = selfieImg.height * sr
      ctx.drawImage(selfieImg, (W - sw) / 2, (H - sh) / 2, sw, sh)
      const gw = (W * scale) / 100
      const gh = (garmentImg.height / garmentImg.width) * gw
      ctx.drawImage(garmentImg, (W * posX) / 100 - gw / 2, (H * posY) / 100 - gh / 2, gw, gh)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
      if (!blob) throw new Error('export failed')
      const fd = new FormData()
      fd.set('file', new File([blob], 'onphoto-look.jpg', { type: 'image/jpeg' }))
      save.run({ data: fd })
    } catch {
      setSaving(false)
      setMsg('Could not save just now. Try again.')
    }
  }

  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-[#111111] p-4 text-white sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Placed on your photo</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase">Your face kept</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-white/70">Manual overlay preview only — this does not model garment shape, occlusion or fit. Drag the image or use the sliders; use Generate AI try-on for an AI-generated fitting.</p>
      {!ready ? (
        <div className="mt-4 rounded-3xl border border-dashed border-white/25 bg-white/5 p-8 text-center">
          <p className="font-semibold">Add your photo + pick a piece</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] text-white/60">Upload your selfie above and choose from Women, Men or Kids — the fitting appears here on your photo.</p>
        </div>
      ) : (
        <>
          <div
            ref={boxRef}
            className="relative mt-4 aspect-[3/4] w-full touch-none overflow-hidden rounded-2xl bg-neutral-900 select-none"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          >
            <img src={selfieUrl} alt="Your uploaded photo" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <img
              src={garmentUrl}
              alt={`${garmentName} placed on your photo`}
              className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl"
              style={{ left: `${posX}%`, top: `${posY}%`, width: `${scale}%` }}
              draggable={false}
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold">Your photo · {garmentName}</span>
          </div>
          <div className="mt-4 space-y-3 text-[13px]">
            <label className="block">
              <span className="mb-1 flex justify-between text-white/70"><span>Garment size</span><span>{scale}%</span></span>
              <input type="range" min={30} max={110} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-[#c9a96a]" />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-white/70"><span>Up / down</span><span>{posY}%</span></span>
              <input type="range" min={10} max={90} value={posY} onChange={(e) => setPosY(Number(e.target.value))} className="w-full accent-[#c9a96a]" />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-white/70"><span>Left / right</span><span>{posX}%</span></span>
              <input type="range" min={15} max={85} value={posX} onChange={(e) => setPosX(Number(e.target.value))} className="w-full accent-[#c9a96a]" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={downloadComposite} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
              <Download className="size-4" /> Download my look
            </button>
            <button onClick={saveToFits} disabled={saving || save.pending} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#c9a96a] px-5 py-2.5 text-sm font-semibold text-[#1a1a1e] hover:bg-[#b8945a] disabled:opacity-60">
              {saving || save.pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save to My Fits
            </button>
          </div>
        </>
      )}
      {msg && <p className="mt-2 text-xs text-white/70">{msg}</p>}
      {save.error && <p role="alert" className="mt-2 text-xs text-red-300">{save.error}</p>}
    </div>
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function Uploader({ label, hint, photo, inputRef, onPick, onClear, icon }: {
  label: string
  hint: string
  photo: PhotoState
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (f: File | undefined) => void
  onClear: () => void
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        {photo.localUrl && (
          <button onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-red-600">
            <X className="size-3.5" /> Remove
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          onPick(file)
        }}
      />
      {!photo.localUrl ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-[#f8f7f4] px-4 py-8 text-sm font-medium text-neutral-600 transition hover:border-[#111111] hover:text-[#1a1a1e]"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#1a1a1e] shadow-sm">{icon}</span>
          Tap to upload · JPG, PNG or WEBP up to {MAX_MB}MB
        </button>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-2xl border border-neutral-200">
          <img src={photo.localUrl} alt={`${label} preview`} className="aspect-[4/3] w-full object-cover" />
          {photo.uploading && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/70 text-sm font-semibold backdrop-blur-sm">
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </span>
          )}
          {!photo.uploading && photo.remoteUrl && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-[#111111]/90 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Check className="size-3" /> Ready
            </span>
          )}
          <button onClick={() => inputRef.current?.click()} className="absolute right-3 bottom-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow hover:bg-neutral-100">
            Retake
          </button>
        </div>
      )}
      {photo.error && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{photo.error}</p>}
    </div>
  )
}
