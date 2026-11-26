import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, DEFAULT_SLOT, FONT_CHOICES, IMAGE_SIZES, PLACEMENT_SLOTS, type ImageSize, type PageKey, type ServiceItem, type SiteImage, type SiteSettings } from './lib/settings'
import { loadSettings, saveSettings } from './lib/store'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { cropImageFile, rotatedImageDataUrl, uploadSiteImage, type CropRect } from './lib/images'

// Static inline SVG icons for the four services, in the glowing blue style.
const SERVICE_ICONS: ReactNode[] = [
  // AI Consultation and Strategy: connected network / brain
  <svg key="brain" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="32" cy="32" r="20" />
    <circle cx="32" cy="14" r="4" /><circle cx="14" cy="32" r="4" /><circle cx="50" cy="32" r="4" /><circle cx="32" cy="50" r="4" />
    <circle cx="20" cy="20" r="3" /><circle cx="44" cy="20" r="3" /><circle cx="20" cy="44" r="3" /><circle cx="44" cy="44" r="3" />
    <path d="M32 18v6M18 32h6M40 32h6M32 40v6M23 23l6 6M41 23l-6 6M23 41l6-6M41 41l-6-6" />
  </svg>,
  // Custom AI Development: code brackets
  <svg key="code" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="32" cy="32" r="24" />
    <path d="M26 22l-8 10 8 10M38 22l8 10-8 10M36 18l-8 28" />
  </svg>,
  // Data Analytics and Insights: bar chart with a rising arrow
  <svg key="chart" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 52h40" />
    <path d="M18 52V36M28 52V26M38 52V32M48 52V18" />
    <path d="M18 30l12-8 8 5 10-9" />
    <path d="M48 18h-6M48 18v6" />
  </svg>,
  // AI-Powered Automation: gears
  <svg key="gears" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="26" cy="26" r="10" /><circle cx="26" cy="26" r="3.5" />
    <path d="M26 12v5M26 35v5M12 26h5M35 26h5M16 16l3.5 3.5M36 36l3.5 3.5M36 16l-3.5 3.5M16 36l3.5-3.5" />
    <circle cx="46" cy="46" r="8" /><circle cx="46" cy="46" r="2.5" />
    <path d="M46 35v4M46 53v4M35 46h4M53 46h4M38 38l3 3M54 54l-3-3M54 38l-3 3M38 54l3-3" />
  </svg>,
]

/**
 * Images for one page at one placement slot, in list order.
 * Images saved before placement existed carry the page's old fixed slot,
 * so they keep showing exactly where they used to.
 */
function SlotImages({ page, slot, images, className = '' }: { page: PageKey; slot: string; images: SiteImage[]; className?: string }) {
  const list = (images ?? []).filter((im) => (im.position || DEFAULT_SLOT[page]) === slot)
  if (list.length === 0) return null
  return (
    <div className={`slot-images ${className}`}>
      {list.map((img) => (
        <figure className={`slot-img size-${img.size || 'medium'}`} key={img.id}>
          <img src={img.url} alt={img.alt || 'Image'} loading="lazy" />
          {img.caption ? <figcaption>{img.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  )
}

// Only Dada's emails can sign in as admin. Anyone else gets signed straight back out.
const ADMIN_EMAILS = ['kebraphotography@gmail.com', 'kedeuce@gmail.com']

type View = 'home' | 'services' | 'about' | 'contact' | 'admin'

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-row">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {FONT_CHOICES.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  )
}

type AspectChoice = 'free' | '1:1' | '16:9' | '4:3'
const ASPECT_RATIOS: Record<AspectChoice, number | null> = { free: null, '1:1': 1, '16:9': 16 / 9, '4:3': 4 / 3 }

/**
 * Simple crop editor: a draggable, resizable crop box over a preview,
 * aspect-ratio buttons and a rotate button. The preview is the photo
 * already rotated, so the crop box matches exactly what gets saved.
 * Phone-friendly: big touch targets, no tiny handles except one corner.
 */
function ImageCropper({ file, onDone, onCancel }: { file: File; onDone: (cropped: File) => void; onCancel: () => void }) {
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState<AspectChoice>('free')
  const [preview, setPreview] = useState('')
  const [previewSize, setPreviewSize] = useState({ w: 1, h: 1 })
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: CropRect } | null>(null)

  useEffect(() => {
    let alive = true
    setBusy(true)
    rotatedImageDataUrl(file, rotation).then((url) => {
      if (!alive) return
      const img = new Image()
      img.onload = () => {
        if (!alive) return
        setPreview(url)
        setPreviewSize({ w: img.naturalWidth, h: img.naturalHeight })
        setCrop(fitCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, ASPECT_RATIOS[aspect]))
        setBusy(false)
      }
      img.onerror = () => { if (alive) { setNote('Could not read this photo.'); setBusy(false) } }
      img.src = url
    }).catch(() => { if (alive) { setNote('Could not read this photo.'); setBusy(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, rotation])

  function fitCrop(r: CropRect, ratio: number | null): CropRect {
    let { x, y, w, h } = r
    if (ratio) {
      const cx = x + w / 2
      const cy = y + h / 2
      if (w / h > ratio) w = h * ratio
      else h = w / ratio
      x = cx - w / 2
      y = cy - h / 2
    }
    w = Math.min(w, 1)
    h = Math.min(h, 1)
    x = Math.max(0, Math.min(x, 1 - w))
    y = Math.max(0, Math.min(y, 1 - h))
    return { x, y, w, h }
  }

  function changeAspect(a: AspectChoice) {
    setAspect(a)
    setCrop((c) => fitCrop(c, ASPECT_RATIOS[a]))
  }

  function onPointerDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, start: crop }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    const el = boxRef.current
    if (!drag || !el) return
    const rect = el.getBoundingClientRect()
    const dx = (e.clientX - drag.sx) / rect.width
    const dy = (e.clientY - drag.sy) / rect.height
    const s = drag.start
    if (drag.mode === 'move') {
      setCrop({
        x: Math.max(0, Math.min(s.x + dx, 1 - s.w)),
        y: Math.max(0, Math.min(s.y + dy, 1 - s.h)),
        w: s.w,
        h: s.h,
      })
    } else {
      const ratio = ASPECT_RATIOS[aspect]
      let w = Math.max(0.05, Math.min(s.w + dx, 1 - s.x))
      let h = ratio ? w / ratio : Math.max(0.05, Math.min(s.h + dy, 1 - s.y))
      if (ratio && h > 1 - s.y) { h = 1 - s.y; w = h * ratio }
      setCrop({ x: s.x, y: s.y, w, h })
    }
  }

  function onPointerUp() { dragRef.current = null }

  async function confirm(useCrop: boolean) {
    if (!preview) return
    setBusy(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const cropped = await cropImageFile(blob, useCrop ? crop : { x: 0, y: 0, w: 1, h: 1 }, file.name)
      onDone(cropped)
    } catch {
      setNote('Could not crop this photo. Try the full photo instead, or another image.')
      setBusy(false)
    }
  }

  return (
    <div className="cropper">
      <h3 style={{ marginTop: 0 }}>Crop your photo</h3>
      <p style={{ fontSize: 14, color: 'var(--muted)' }}>Drag the box to move it, drag its bottom-right corner to resize it. Pick a shape, or rotate the photo first.</p>
      <div className="crop-aspects">
        {(['free', '1:1', '16:9', '4:3'] as AspectChoice[]).map((a) => (
          <button key={a} type="button" className={aspect === a ? 'btn secondary' : 'btn secondary'} style={{ marginTop: 0, padding: '8px 14px', minHeight: 40, background: aspect === a ? 'var(--accent)' : 'transparent', color: aspect === a ? 'var(--button-text)' : 'var(--accent)' }} onClick={() => changeAspect(a)}>
            {a === 'free' ? 'Free' : a}
          </button>
        ))}
        <button type="button" className="btn secondary" style={{ marginTop: 0, padding: '8px 14px', minHeight: 40 }} onClick={() => setRotation((r) => (r + 90) % 360)}>Rotate 90°</button>
      </div>
      {preview ? (
        <div
          ref={boxRef}
          className="cropper-wrap"
          style={{ aspectRatio: `${previewSize.w} / ${previewSize.h}` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img src={preview} alt="Photo to crop" draggable={false} />
          <div
            className="crop-box"
            style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
            onPointerDown={(e) => onPointerDown(e, 'move')}
          >
            <div className="crop-handle" onPointerDown={(e) => onPointerDown(e, 'resize')} />
          </div>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)' }}>{busy ? 'Loading your photo…' : 'No preview.'}</p>
      )}
      {note && <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{note}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn" style={{ marginTop: 0 }} disabled={busy || !preview} onClick={() => void confirm(true)}>{busy ? 'Working…' : 'Use this crop'}</button>
        <button type="button" className="btn secondary" style={{ marginTop: 0 }} disabled={busy || !preview} onClick={() => void confirm(false)}>Use full photo</button>
        <button type="button" className="btn secondary" style={{ marginTop: 0 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [adminUser, setAdminUser] = useState<string | null>(null)
  // PIN sign-in: 6 digits, never stored or logged anywhere.
  const [pin, setPin] = useState('')
  const [pinNote, setPinNote] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  // Recovery: the old email magic-link flow, only for a forgotten PIN.
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('kebraphotography@gmail.com')
  const [recoveryNote, setRecoveryNote] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  // Set / change PIN, while signed in.
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinFormNote, setPinFormNote] = useState('')
  const [pinFormBusy, setPinFormBusy] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [urlDraft, setUrlDraft] = useState<Record<PageKey, string>>({ home: '', services: '', about: '', contact: '' })
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<{ kind: 'page'; page: PageKey } | { kind: 'hero' } | { kind: 'replace'; page: PageKey; id: string } | null>(null)

  // Admin is hidden from public visitors: it opens only via the #admin
  // address (e.g. https://rigoradvancedsolutions.com/#admin). No button or
  // link anywhere on the public site leads to it.
  useEffect(() => {
    const openAdminFromHash = () => {
      if (window.location.hash === '#admin') setView('admin')
    }
    openAdminFromHash()
    window.addEventListener('hashchange', openAdminFromHash)
    return () => window.removeEventListener('hashchange', openAdminFromHash)
  }, [])

  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); setLoaded(true) })
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return
    client.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? null
      setAdminUser(email && ADMIN_EMAILS.includes(email) ? email : null)
      if (email && !ADMIN_EMAILS.includes(email)) void client.auth.signOut()
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null
      setAdminUser(email && ADMIN_EMAILS.includes(email) ? email : null)
      if (email && !ADMIN_EMAILS.includes(email)) void client.auth.signOut()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  /** PIN sign-in: the PIN is the Supabase Auth password for the admin email. */
  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) { setPinNote('Supabase is not configured yet, so sign in is unavailable.'); return }
    if (Date.now() < lockedUntil) { setPinNote('Too many wrong tries. Please wait a moment and try again.'); return }
    if (!/^\d{6}$/.test(pin)) { setPinNote('Enter your 6-digit PIN.'); return }
    setPinBusy(true)
    setPinNote('')
    let ok = false
    for (const email of ADMIN_EMAILS) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (!error) { ok = true; break }
    }
    setPinBusy(false)
    if (ok) {
      setFailedAttempts(0)
      setPin('')
      // A successful PIN sign-in proves a PIN exists, so record that.
      if (!settings.admin?.pinSet) {
        const updated = { ...settings, admin: { pinSet: true } }
        setSettings(updated)
        void saveSettings(updated)
      }
    } else {
      const n = failedAttempts + 1
      setFailedAttempts(n)
      if (n >= 5) {
        setLockedUntil(Date.now() + 30000)
        setPinNote('Wrong PIN 5 times. Wait 30 seconds before trying again.')
        window.setTimeout(() => { setFailedAttempts(0); setLockedUntil(0) }, 30000)
      } else {
        setPinNote(`Wrong PIN. ${5 - n} ${5 - n === 1 ? 'try' : 'tries'} left before a short wait.`)
      }
    }
  }

  /** Forgotten PIN: send the old email magic link as the recovery path. */
  async function handleForgotPin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) { setRecoveryNote('Supabase is not configured yet.'); return }
    const email = recoveryEmail.trim().toLowerCase()
    if (!ADMIN_EMAILS.includes(email)) { setRecoveryNote('That email is not the admin email for this site.'); return }
    setRecoveryBusy(true)
    setRecoveryNote('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setRecoveryBusy(false)
    setRecoveryNote(error ? `Could not send the sign-in link: ${error.message}` : 'Sign-in link sent. Check your email and tap the link — it will bring you back here signed in. Then set a new PIN below.')
  }

  /** First-time setup, while signed in via the email link: set the PIN. */
  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) { setPinFormNote('Supabase is not configured yet.'); return }
    if (!/^\d{6}$/.test(newPin)) { setPinFormNote('Your PIN must be exactly 6 digits.'); return }
    if (newPin !== confirmPin) { setPinFormNote('The two PINs do not match. Try again.'); return }
    setPinFormBusy(true)
    setPinFormNote('')
    const { error } = await supabase.auth.updateUser({ password: newPin })
    setPinFormBusy(false)
    if (error) { setPinFormNote(`Could not save your PIN: ${error.message}`); return }
    const updated = { ...settings, admin: { pinSet: true } }
    setSettings(updated)
    await saveSettings(updated)
    setNewPin('')
    setConfirmPin('')
    setPinFormNote('PIN set — next time just enter your PIN to sign in.')
  }

  /** Change the PIN anytime, while signed in: current PIN is checked first. */
  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !adminUser) { setPinFormNote('Sign in first.'); return }
    if (!/^\d{6}$/.test(currentPin)) { setPinFormNote('Enter your current 6-digit PIN.'); return }
    if (!/^\d{6}$/.test(newPin)) { setPinFormNote('Your new PIN must be exactly 6 digits.'); return }
    if (newPin !== confirmPin) { setPinFormNote('The two new PINs do not match. Try again.'); return }
    if (newPin === currentPin) { setPinFormNote('Your new PIN is the same as the current one.'); return }
    setPinFormBusy(true)
    setPinFormNote('')
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: adminUser, password: currentPin })
    if (checkError) { setPinFormBusy(false); setPinFormNote('Your current PIN is wrong.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPin })
    setPinFormBusy(false)
    if (error) { setPinFormNote(`Could not change your PIN: ${error.message}`); return }
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setPinFormNote('PIN changed. Use your new PIN next time you sign in.')
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
    setAdminUser(null)
    go('home')
  }

  const vars = useMemo(() => ({
    '--bg': settings.colors.background,
    '--surface': settings.colors.surface,
    '--accent': settings.colors.accent,
    '--heading': settings.colors.heading,
    '--body': settings.colors.body,
    '--muted': settings.colors.muted,
    '--border': settings.colors.border,
    '--button-text': settings.colors.buttonText,
    '--gold': settings.colors.gold,
    '--heading-font': `'${settings.fonts.headingFont}', sans-serif`,
    '--body-font': `'${settings.fonts.bodyFont}', sans-serif`,
    '--radius': `${settings.fonts.radius}px`,
  }) as CSSProperties, [settings])

  // Leaving Admin (sign out, or Preview Site) clears the #admin hash so the
  // Admin view is not left open in the address bar.
  const go = (v: View) => {
    setView(v)
    if (v === 'admin') {
      if (window.location.hash !== '#admin') window.history.replaceState(null, '', '#admin')
    } else if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    window.scrollTo({ top: 0 })
  }
  const set = (fn: (s: SiteSettings) => SiteSettings) => { setSettings((prev) => fn(prev)); setSaveNote('') }
  const updateService = (i: number, patch: Partial<ServiceItem>) =>
    set((s) => ({ ...s, services: { ...s.services, items: s.services.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } }))

  const newImageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const addImage = (page: PageKey, url: string, alt = '') =>
    set((s) => ({ ...s, images: { ...s.images, [page]: [...(s.images?.[page] ?? []), { id: newImageId(), url, alt, caption: '', position: DEFAULT_SLOT[page], size: 'medium' as ImageSize }] } }))
  const updateImage = (page: PageKey, id: string, patch: Partial<SiteImage>) =>
    set((s) => ({ ...s, images: { ...s.images, [page]: (s.images?.[page] ?? []).map((im) => (im.id === id ? { ...im, ...patch } : im)) } }))
  const removeImage = (page: PageKey, id: string) =>
    set((s) => ({ ...s, images: { ...s.images, [page]: (s.images?.[page] ?? []).filter((im) => im.id !== id) } }))
  const moveImage = (page: PageKey, id: string, dir: -1 | 1) =>
    set((s) => {
      const list = [...(s.images?.[page] ?? [])]
      const i = list.findIndex((im) => im.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return s
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...s, images: { ...s.images, [page]: list } }
    })

  /** Picking a photo opens the cropper first; the cropped photo is uploaded when she confirms it. */
  function handleImageFile(page: PageKey, file: File | undefined) {
    if (!file) return
    setCropFile(file)
    setCropTarget({ kind: 'page', page })
  }

  function handleHeroImageFile(file: File | undefined) {
    if (!file) return
    setCropFile(file)
    setCropTarget({ kind: 'hero' })
  }

  async function handleCropDone(cropped: File) {
    const target = cropTarget
    setCropFile(null)
    setCropTarget(null)
    if (!target) return
    setUploadBusy(true)
    setUploadNote('Uploading your image…')
    try {
      const { url, stored } = await uploadSiteImage(cropped)
      if (target.kind === 'hero') {
        set((p) => ({ ...p, heroImage: url }))
        setUploadNote('Hero image changed. Press Save Changes to make it live.')
      } else if (target.kind === 'replace') {
        updateImage(target.page, target.id, { url })
        setUploadNote('Photo replaced. Press Save Changes to make it live.')
      } else {
        addImage(target.page, url, cropped.name.replace(/\.[^.]+$/, ''))
        setUploadNote(stored === 'storage' ? 'Image added. Press Save Changes to make it live.' : 'Image added (saved with the site settings). Press Save Changes to make it live.')
      }
    } catch {
      setUploadNote('That image could not be added. Try a different photo, or paste an image link instead.')
    } finally {
      setUploadBusy(false)
    }
  }

  function handleImageUrl(page: PageKey) {
    const url = (urlDraft[page] || '').trim()
    if (!url) { setUploadNote('Paste an image link first, or choose a file to upload.'); return }
    addImage(page, url)
    setUrlDraft((d) => ({ ...d, [page]: '' }))
    setUploadNote('Image added. Press Save Changes to make it live.')
  }

  const imageEditor = (page: PageKey, label: string) => {
    const list = settings.images?.[page] ?? []
    const cropHere = cropFile && cropTarget && ((cropTarget.kind === 'page' && cropTarget.page === page) || (cropTarget.kind === 'replace' && cropTarget.page === page))
    return (
      <section className="admin-section" key={`images-${page}`}>
        <h2>{label}</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Add photos to this page and choose exactly where each one sits, how big it is, and what order they appear in. Uploading a photo lets you crop and rotate it first.</p>
        {list.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)' }}>No images on this page yet.</p>}
        {list.map((img, i) => (
          <div className="img-row" key={img.id}>
            <img className="img-thumb" src={img.url} alt={img.alt || 'Image preview'} />
            <div className="img-row-fields">
              <Field label="Description (alt text)" value={img.alt} onChange={(v) => updateImage(page, img.id, { alt: v })} />
              <Field label="Caption under the image (optional)" value={img.caption ?? ''} onChange={(v) => updateImage(page, img.id, { caption: v })} />
              <div className="field">
                <label>Where on the page</label>
                <select value={img.position || DEFAULT_SLOT[page]} onChange={(e) => updateImage(page, img.id, { position: e.target.value })}>
                  {PLACEMENT_SLOTS[page].map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Size</label>
                <select value={img.size || 'medium'} onChange={(e) => updateImage(page, img.id, { size: e.target.value as ImageSize })}>
                  {IMAGE_SIZES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn secondary" style={{ marginTop: 0, padding: '10px 14px', minHeight: 44 }} disabled={i === 0} onClick={() => moveImage(page, img.id, -1)}>↑ Move up</button>
                <button className="btn secondary" style={{ marginTop: 0, padding: '10px 14px', minHeight: 44 }} disabled={i === list.length - 1} onClick={() => moveImage(page, img.id, 1)}>↓ Move down</button>
                <label className="btn secondary" style={{ marginTop: 0, padding: '10px 14px', minHeight: 44, display: 'inline-block', textAlign: 'center' }}>
                  Replace photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCropFile(f); setCropTarget({ kind: 'replace', page, id: img.id }) } e.target.value = '' }} />
                </label>
                <button className="btn secondary" style={{ marginTop: 0, padding: '10px 14px', minHeight: 44 }} onClick={() => { if (window.confirm('Delete this image from the page?')) removeImage(page, img.id) }}>Delete image</button>
              </div>
            </div>
          </div>
        ))}
        {cropHere && (
          <ImageCropper file={cropFile} onDone={(f) => void handleCropDone(f)} onCancel={() => { setCropFile(null); setCropTarget(null) }} />
        )}
        <div className="img-add">
          <label className="btn secondary" style={{ marginTop: 0, padding: '10px 18px', minHeight: 44, display: 'inline-block', textAlign: 'center' }}>
            {uploadBusy ? 'Uploading…' : 'Upload a photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadBusy} onChange={(e) => { handleImageFile(page, e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <input type="text" placeholder="Or paste an image link, then press Add" value={urlDraft[page]} onChange={(e) => setUrlDraft((d) => ({ ...d, [page]: e.target.value }))} />
          <button className="btn secondary" style={{ marginTop: 0, padding: '10px 18px', minHeight: 44 }} onClick={() => handleImageUrl(page)}>Add</button>
        </div>
        {uploadNote && <p style={{ marginTop: 10, color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{uploadNote}</p>}
      </section>
    )
  }

  async function handleSave() {
    const where = await saveSettings(settings)
    setSaveNote(where === 'supabase' ? 'Saved to Supabase, and it is live now.' : 'Saved in this browser (localStorage). Add your Supabase keys in Vercel to save to Supabase.')
  }
  function handleReset() {
    if (window.confirm('Reset everything to the original approved design?')) {
      setSettings(DEFAULT_SETTINGS)
      void saveSettings(DEFAULT_SETTINGS)
      setSaveNote('Reset to the original design.')
    }
  }

  if (!loaded) return <div className="wrap" style={{ ...vars, background: 'var(--bg)', minHeight: '100vh' }}><p style={{ padding: 40 }}>Loading Rigor Advanced Solutions…</p></div>

  const s = settings
  const navBtn = (v: View, label: string) => (
    <button key={v} className={view === v ? 'active' : ''} onClick={() => go(v)}>{label}</button>
  )

  let page: ReactNode = null

  if (view === 'home') {
    const heroSlotImages = (s.images?.home ?? []).filter((im) => (im.position || DEFAULT_SLOT.home) === 'hero')
    page = (
      <>
        <div className="wrap"><SlotImages page="home" slot="top" images={s.images?.home ?? []} /></div>
        <section className="hero">
          <div className="wrap hero-inner">
            <div className="hero-text">
              <span className="eyebrow">{s.home.eyebrow}</span>
              <h1>{s.home.headline}</h1>
              <p className="subhead">{s.home.subhead}</p>
              <p className="lede">{s.home.intro}</p>
              <p className="gold-line">{s.home.goldLine}</p>
            </div>
            {s.heroImage ? <img className="hero-img" src={s.heroImage} alt="Glowing network globe" /> : heroSlotImages.map((im) => <img key={im.id} className="hero-img" src={im.url} alt={im.alt || 'Image'} />)}
          </div>
        </section>
        <section className="section"><div className="wrap">
          <span className="eyebrow">{s.home.servicesLabel}</span>
          <h2 className="section-title">{s.services.label}</h2>
          <div className="cards">
            {s.services.items.map((it, i) => (
              <article className="card" key={it.name}>
                <div className="service-icon">{SERVICE_ICONS[i] ?? null}</div>
                <h3>{it.name}</h3>
                <p>{it.short}</p>
                <button className="linklike" onClick={() => go('services')}>See full details</button>
              </article>
            ))}
          </div>
          <SlotImages page="home" slot="after-services" images={s.images?.home ?? []} />
        </div></section>
        <section className="section"><div className="wrap">
          <h2 className="section-title">{s.home.whyTitle}</h2>
          <p>{s.home.whyIntro}</p>
          <div className="cards">
            {s.home.whyItems.map((w) => (
              <article className="card" key={w.title}><h3>{w.title}</h3><p>{w.text}</p></article>
            ))}
          </div>
        </div></section>
        <section className="section"><div className="wrap">
          <h2 className="section-title">{s.home.processTitle}</h2>
          <p>{s.home.processIntro}</p>
          <div className="steps">
            {s.home.processSteps.map((st, i) => (
              <article className="card" key={st.title}>
                <div className="step-num">{i + 1}</div>
                <h3>{st.title}</h3><p>{st.text}</p>
              </article>
            ))}
          </div>
          <SlotImages page="home" slot="after-how-we-work" images={s.images?.home ?? []} />
        </div></section>
        <div className="wrap"><SlotImages page="home" slot="bottom" images={s.images?.home ?? []} /></div>
      </>
    )
  }

  if (view === 'services') {
    page = (
      <section className="section" style={{ paddingBottom: 84 }}><div className="wrap">
        <SlotImages page="services" slot="top" images={s.images?.services ?? []} />
        <span className="eyebrow">{s.services.label}</span>
        <h1>{s.services.title}</h1>
        <p style={{ maxWidth: 720, fontSize: 18 }}>{s.services.intro}</p>
        {s.services.items.map((it, i) => (
          <article className="service-detail" key={it.name}>
            <div className="service-icon">{SERVICE_ICONS[i] ?? null}</div>
            <h2>{it.name}</h2>
            <p>{it.detail}</p>
            <h3 style={{ color: 'var(--gold)' }}>{s.services.whoHeading}</h3>
            <p>{it.whoFor}</p>
            <h3>{s.services.includesHeading}</h3>
            <ul>{it.includes.map((inc) => <li key={inc}>{inc}</li>)}</ul>
          </article>
        ))}
        <SlotImages page="services" slot="after-details" images={s.images?.services ?? []} />
        <SlotImages page="services" slot="bottom" images={s.images?.services ?? []} />
      </div></section>
    )
  }

  if (view === 'about') {
    page = (
      <section className="section"><div className="wrap">
        <SlotImages page="about" slot="top" images={s.images?.about ?? []} />
        <span className="eyebrow">{s.about.label}</span>
        <h1>{s.about.title}</h1>
        <p style={{ maxWidth: 720, fontSize: 18 }}>{s.about.intro}</p>
        <p style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 600 }}>{s.tagline}</p>
        <div className="two-col" style={{ marginTop: 28 }}>
          <article className="info-card"><h2>{s.about.missionTitle}</h2><p>{s.about.missionText}</p></article>
          <article className="info-card"><h2>{s.about.promiseTitle}</h2><p>{s.about.promiseText}</p></article>
        </div>
        <SlotImages page="about" slot="after-story" images={s.images?.about ?? []} />
        <h2 className="section-title" style={{ marginTop: 40 }}>{s.about.valuesTitle}</h2>
        <div className="cards">
          {s.about.values.map((v) => (
            <article className="card" key={v.title}><h3>{v.title}</h3><p>{v.text}</p></article>
          ))}
        </div>
        <SlotImages page="about" slot="after-values" images={s.images?.about ?? []} />
        <SlotImages page="about" slot="bottom" images={s.images?.about ?? []} />
      </div></section>
    )
  }

  if (view === 'contact') {
    page = (
      <section className="section"><div className="wrap">
        <SlotImages page="contact" slot="top" images={s.images?.contact ?? []} />
        <span className="eyebrow">{s.contact.label}</span>
        <h1>{s.contact.title}</h1>
        <p style={{ maxWidth: 720, fontSize: 18 }}>{s.contact.intro}</p>
        <div className="two-col" style={{ marginTop: 28 }}>
          <article className="info-card">
            <h2>{s.contact.phoneCardTitle}</h2>
            <a href={`tel:${s.phoneTel}`}>{s.phoneDisplay}</a>
            <p>{s.contact.phoneCardNote}</p>
          </article>
          <article className="info-card">
            <h2>{s.contact.locationCardTitle}</h2>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--heading)' }}>{s.location}</p>
            <p>{s.contact.locationCardNote}</p>
          </article>
        </div>
        <SlotImages page="contact" slot="after-info" images={s.images?.contact ?? []} />
        <form className="consult" onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}>
          <h2>{s.contact.formTitle}</h2>
          <label>{s.contact.nameLabel}</label>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label>{s.contact.emailLabel}</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label>{s.contact.phoneLabel}</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <label>{s.contact.messageLabel}</label>
          <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {submitted ? (
            <p style={{ marginTop: 20, color: 'var(--accent)', fontWeight: 600 }}>{s.contact.thankYou}</p>
          ) : (
            <button className="btn" type="submit">{s.contact.submitLabel}</button>
          )}
          {submitted && <a className="btn secondary" href={`tel:${s.phoneTel}`} style={{ marginLeft: 12, textDecoration: 'none' }}>{s.contact.callButtonLabel}</a>}
        </form>
        <SlotImages page="contact" slot="after-form" images={s.images?.contact ?? []} />
        <div className="closing">
          <h2>{s.contact.closingTitle}</h2>
          <p>{s.contact.closingText}</p>
          <a className="btn" href={`tel:${s.phoneTel}`} style={{ textDecoration: 'none' }}>{s.contact.callButtonLabel}</a>
        </div>
        <SlotImages page="contact" slot="bottom" images={s.images?.contact ?? []} />
      </div></section>
    )
  }

  if (view === 'admin') {
    if (!adminUser) {
      const locked = Date.now() < lockedUntil
      page = (
        <div className="wrap admin-grid">
          <div>
            <h1>Admin sign in</h1>
            <p>This is Dada's private admin area. Enter your 6-digit admin PIN — no email needed.</p>
            {!settings.admin?.pinSet && (
              <p style={{ color: 'var(--accent)', fontWeight: 600 }}>No PIN set yet. Use the sign-in link below first, then set your PIN in Admin.</p>
            )}
            <form className="consult" onSubmit={(e) => void handlePinLogin(e)}>
              <label>Admin PIN</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                style={{ letterSpacing: '0.4em', fontSize: 22, textAlign: 'center' }}
              />
              <button className="btn" type="submit" disabled={pinBusy || locked}>{pinBusy ? 'Signing in…' : locked ? 'Wait a moment…' : 'Sign in with PIN'}</button>
              {pinNote && <p style={{ marginTop: 16, color: 'var(--accent)', fontWeight: 600 }}>{pinNote}</p>}
            </form>
            <p style={{ marginTop: 18 }}>
              <button className="linklike" type="button" onClick={() => setShowRecovery((v) => !v)}>Forgot PIN? Send a sign-in link</button>
            </p>
            {showRecovery && (
              <form className="consult" onSubmit={(e) => void handleForgotPin(e)}>
                <label>Admin email</label>
                <input type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="kebraphotography@gmail.com" />
                <button className="btn secondary" type="submit" disabled={recoveryBusy}>{recoveryBusy ? 'Sending…' : 'Send me a sign-in link'}</button>
                {recoveryNote && <p style={{ marginTop: 16, color: 'var(--accent)', fontWeight: 600 }}>{recoveryNote}</p>}
              </form>
            )}
          </div>
        </div>
      )
    } else {
    page = (
      <div className="wrap admin-grid">
        <div>
          <h1>Admin</h1>
          <p>
            Signed in as {adminUser}. <button className="linklike" onClick={() => void handleLogout()}>Sign out</button><br />
            Edit everything you see on the site here, then press Save Changes. Storage: {isSupabaseConfigured ? 'Supabase' : 'this browser (localStorage), Supabase is not configured yet'}.
            Use Preview Site at the top to see the live site.
          </p>
          <div className="preview-box">
            <span className="eyebrow">Live preview</span>
            <h2 style={{ fontSize: 28 }}>{s.home.headline}</h2>
            <p className="subhead" style={{ color: 'var(--accent)' }}>{s.home.subhead}</p>
            <p>{s.tagline}</p>
          </div>
        </div>

        <section className="admin-section">
          <h2>{s.admin?.pinSet ? 'Change admin PIN' : 'Set your admin PIN'}</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            {s.admin?.pinSet
              ? 'Your PIN is how you sign in as admin — no email needed. You can change it here anytime.'
              : 'No PIN set yet. Choose a 6-digit PIN now — after this, you will sign in with just your PIN.'}
          </p>
          <form className="consult" style={{ marginTop: 0 }} onSubmit={(e) => void (s.admin?.pinSet ? handleChangePin(e) : handleSetPin(e))}>
            {s.admin?.pinSet && (
              <>
                <label>Current PIN</label>
                <input type="password" inputMode="numeric" autoComplete="off" required maxLength={6} value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }} />
              </>
            )}
            <label>New PIN (6 digits)</label>
            <input type="password" inputMode="numeric" autoComplete="off" required maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }} />
            <label>Repeat new PIN</label>
            <input type="password" inputMode="numeric" autoComplete="off" required maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }} />
            <button className="btn" type="submit" disabled={pinFormBusy}>{pinFormBusy ? 'Saving…' : s.admin?.pinSet ? 'Change PIN' : 'Set PIN'}</button>
            {pinFormNote && <p style={{ marginTop: 16, color: 'var(--accent)', fontWeight: 600 }}>{pinFormNote}</p>}
          </form>
        </section>

        <section className="admin-section"><h2>Business details</h2>
          <Field label="Business name" value={s.businessName} onChange={(v) => set((p) => ({ ...p, businessName: v }))} />
          <Field label="Tagline" value={s.tagline} onChange={(v) => set((p) => ({ ...p, tagline: v }))} />
          <Field label="Phone, as shown" value={s.phoneDisplay} onChange={(v) => set((p) => ({ ...p, phoneDisplay: v }))} />
          <Field label="Phone, for tap to call (digits only, with country code)" value={s.phoneTel} onChange={(v) => set((p) => ({ ...p, phoneTel: v }))} />
          <Field label="Location" value={s.location} onChange={(v) => set((p) => ({ ...p, location: v }))} />
          <Field label="Menu label, Home" value={s.nav.home} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, home: v } }))} />
          <Field label="Menu label, Services" value={s.nav.services} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, services: v } }))} />
          <Field label="Menu label, About" value={s.nav.about} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, about: v } }))} />
          <Field label="Menu label, Contact" value={s.nav.contact} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, contact: v } }))} />
        </section>

        <section className="admin-section"><h2>Design, fonts and colours</h2>
          <SelectField label="Heading font" value={s.fonts.headingFont} onChange={(v) => set((p) => ({ ...p, fonts: { ...p.fonts, headingFont: v } }))} />
          <SelectField label="Body font" value={s.fonts.bodyFont} onChange={(v) => set((p) => ({ ...p, fonts: { ...p.fonts, bodyFont: v } }))} />
          <div className="field"><label>Corner roundness (px)</label>
            <input type="text" value={String(s.fonts.radius)} onChange={(e) => set((p) => ({ ...p, fonts: { ...p.fonts, radius: Number(e.target.value) || 0 } }))} />
          </div>
          <ColorField label="Background" value={s.colors.background} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, background: v } }))} />
          <ColorField label="Card surface" value={s.colors.surface} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, surface: v } }))} />
          <ColorField label="Accent" value={s.colors.accent} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, accent: v } }))} />
          <ColorField label="Heading colour" value={s.colors.heading} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, heading: v } }))} />
          <ColorField label="Body text colour" value={s.colors.body} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, body: v } }))} />
          <ColorField label="Muted text colour" value={s.colors.muted} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, muted: v } }))} />
          <ColorField label="Border colour" value={s.colors.border} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, border: v } }))} />
          <ColorField label="Button text colour" value={s.colors.buttonText} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, buttonText: v } }))} />
          <ColorField label="Gold highlight colour" value={s.colors.gold} onChange={(v) => set((p) => ({ ...p, colors: { ...p.colors, gold: v } }))} />
        </section>

        <section className="admin-section"><h2>Home page</h2>
          <Field label="Eyebrow" value={s.home.eyebrow} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, eyebrow: v } }))} />
          <Field label="Headline" value={s.home.headline} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, headline: v } }))} />
          <Field label="Subhead" value={s.home.subhead} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, subhead: v } }))} />
          <Field label="Intro" value={s.home.intro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, intro: v } }))} />
          <Field label="Gold line under the intro" value={s.home.goldLine} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, goldLine: v } }))} />
          <Field label="Hero image (the globe on the home page — leave blank to hide it)" value={s.heroImage} onChange={(v) => set((p) => ({ ...p, heroImage: v }))} />
          {s.heroImage ? <img src={s.heroImage} alt="Hero preview" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 14 }} /> : null}
          <div className="img-add" style={{ marginTop: 0, marginBottom: 14 }}>
            <label className="btn secondary" style={{ marginTop: 0, padding: '10px 18px', minHeight: 44, display: 'inline-block', textAlign: 'center' }}>
              {uploadBusy ? 'Uploading…' : 'Upload a new hero image'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadBusy} onChange={(e) => { handleHeroImageFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          {cropFile && cropTarget?.kind === 'hero' && (
            <ImageCropper file={cropFile} onDone={(f) => void handleCropDone(f)} onCancel={() => { setCropFile(null); setCropTarget(null) }} />
          )}
          <Field label="Services label" value={s.home.servicesLabel} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, servicesLabel: v } }))} />
          <Field label="Why Rigor title" value={s.home.whyTitle} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyTitle: v } }))} />
          <Field label="Why Rigor intro" value={s.home.whyIntro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyIntro: v } }))} />
          {s.home.whyItems.map((w, i) => (
            <div key={i}>
              <Field label={`Why item ${i + 1}, title`} value={w.title} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyItems: p.home.whyItems.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))} />
              <Field label={`Why item ${i + 1}, text`} value={w.text} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyItems: p.home.whyItems.map((x, j) => (j === i ? { ...x, text: v } : x)) } }))} />
            </div>
          ))}
          <Field label="How We Work title" value={s.home.processTitle} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processTitle: v } }))} />
          <Field label="How We Work intro" value={s.home.processIntro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processIntro: v } }))} />
          {s.home.processSteps.map((st, i) => (
            <div key={i}>
              <Field label={`Step ${i + 1}, title`} value={st.title} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processSteps: p.home.processSteps.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))} />
              <Field label={`Step ${i + 1}, text`} value={st.text} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processSteps: p.home.processSteps.map((x, j) => (j === i ? { ...x, text: v } : x)) } }))} />
            </div>
          ))}
        </section>

        {imageEditor('home', 'Home page images')}

        <section className="admin-section"><h2>Services page</h2>
          <Field label="Services label" value={s.services.label} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, label: v } }))} />
          <Field label="Services title" value={s.services.title} textarea onChange={(v) => set((p) => ({ ...p, services: { ...p.services, title: v } }))} />
          <Field label="Services intro" value={s.services.intro} textarea onChange={(v) => set((p) => ({ ...p, services: { ...p.services, intro: v } }))} />
          <Field label="Who it is for, heading" value={s.services.whoHeading} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, whoHeading: v } }))} />
          <Field label="What it includes, heading" value={s.services.includesHeading} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, includesHeading: v } }))} />
          {s.services.items.map((it, i) => (
            <div key={it.name} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <Field label={`Service ${i + 1}, name`} value={it.name} onChange={(v) => updateService(i, { name: v })} />
              <Field label={`Service ${i + 1}, short text`} value={it.short} textarea onChange={(v) => updateService(i, { short: v })} />
              <Field label={`Service ${i + 1}, full detail`} value={it.detail} textarea onChange={(v) => updateService(i, { detail: v })} />
              <Field label={`Service ${i + 1}, who it is for`} value={it.whoFor} textarea onChange={(v) => updateService(i, { whoFor: v })} />
              <Field label={`Service ${i + 1}, includes (comma separated)`} value={it.includes.join(', ')} onChange={(v) => updateService(i, { includes: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </div>
          ))}
        </section>

        {imageEditor('services', 'Services page images')}

        <section className="admin-section"><h2>About page</h2>
          <Field label="About label" value={s.about.label} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, label: v } }))} />
          <Field label="About title" value={s.about.title} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, title: v } }))} />
          <Field label="About intro" value={s.about.intro} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, intro: v } }))} />
          <Field label="Mission title" value={s.about.missionTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, missionTitle: v } }))} />
          <Field label="Mission text" value={s.about.missionText} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, missionText: v } }))} />
          <Field label="Promise title" value={s.about.promiseTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, promiseTitle: v } }))} />
          <Field label="Promise text" value={s.about.promiseText} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, promiseText: v } }))} />
          <Field label="Values title" value={s.about.valuesTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, valuesTitle: v } }))} />
          {s.about.values.map((v, i) => (
            <div key={i}>
              <Field label={`Value ${i + 1}, title`} value={v.title} onChange={(val) => set((p) => ({ ...p, about: { ...p.about, values: p.about.values.map((x, j) => (j === i ? { ...x, title: val } : x)) } }))} />
              <Field label={`Value ${i + 1}, text`} value={v.text} textarea onChange={(val) => set((p) => ({ ...p, about: { ...p.about, values: p.about.values.map((x, j) => (j === i ? { ...x, text: val } : x)) } }))} />
            </div>
          ))}
        </section>

        {imageEditor('about', 'About page images')}

        <section className="admin-section"><h2>Contact page and footer</h2>
          <Field label="Contact label" value={s.contact.label} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, label: v } }))} />
          <Field label="Contact title" value={s.contact.title} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, title: v } }))} />
          <Field label="Contact intro" value={s.contact.intro} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, intro: v } }))} />
          <Field label="Phone card title" value={s.contact.phoneCardTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneCardTitle: v } }))} />
          <Field label="Note under the phone number" value={s.contact.phoneCardNote} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneCardNote: v } }))} />
          <Field label="Location card title" value={s.contact.locationCardTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, locationCardTitle: v } }))} />
          <Field label="Location card note" value={s.contact.locationCardNote} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, locationCardNote: v } }))} />
          <Field label="Form title" value={s.contact.formTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, formTitle: v } }))} />
          <Field label="Name label" value={s.contact.nameLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, nameLabel: v } }))} />
          <Field label="Email label" value={s.contact.emailLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, emailLabel: v } }))} />
          <Field label="Phone label" value={s.contact.phoneLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneLabel: v } }))} />
          <Field label="Message label" value={s.contact.messageLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, messageLabel: v } }))} />
          <Field label="Submit button" value={s.contact.submitLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, submitLabel: v } }))} />
          <Field label="Thank you message" value={s.contact.thankYou} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, thankYou: v } }))} />
          <Field label="Closing title" value={s.contact.closingTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, closingTitle: v } }))} />
          <Field label="Closing text" value={s.contact.closingText} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, closingText: v } }))} />
          <Field label="Call button word" value={s.contact.callButtonLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, callButtonLabel: v } }))} />
          <Field label="Footer Explore heading" value={s.footer.exploreTitle} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, exploreTitle: v } }))} />
          <Field label="Footer Contact heading" value={s.footer.contactTitle} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, contactTitle: v } }))} />
          <Field label="Copyright line" value={s.footer.copyright} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, copyright: v } }))} />
        </section>

        {imageEditor('contact', 'Contact page images')}

        <div className="sticky-actions">
          <button className="btn" style={{ marginTop: 0 }} onClick={() => void handleSave()}>Save Changes</button>
          <button className="btn secondary" style={{ marginTop: 0 }} onClick={() => go('home')}>Preview Site</button>
          <button className="btn secondary" style={{ marginTop: 0 }} onClick={handleReset}>Reset to Original</button>
          {saveNote && <span className="saved-note">{saveNote}</span>}
        </div>
      </div>
    )
    }
  }

  return (
    <div style={{ ...vars, background: 'var(--bg)', minHeight: '100vh', color: 'var(--body)' }}>
      {view === 'admin' && (
        <div className="admin-bar"><div className="wrap">
          <span>Admin panel. <button className="linklike" onClick={() => go('home')}>Preview Site</button></span>
        </div></div>
      )}
      <header className="site-header">
        <div className="wrap">
          <div className="brand-row">
            <div className="logo-mark">RAS</div>
            <div>
              <div className="brand-name">{s.businessName}</div>
              <div className="brand-tag">{s.tagline}</div>
            </div>
          </div>
          <nav className="nav-row" aria-label="Main navigation">
            {navBtn('home', s.nav.home)}
            {navBtn('services', s.nav.services)}
            {navBtn('about', s.nav.about)}
            {navBtn('contact', s.nav.contact)}
          </nav>
        </div>
      </header>
      <main>{page}</main>
      {view === 'contact' && (
        <footer className="site-footer"><div className="wrap"><div className="cols">
          <div><h3>{s.businessName}</h3><p style={{ color: 'var(--gold)' }}>{s.tagline}</p></div>
          <div><h3>{s.footer.exploreTitle}</h3>
            <p><button className="linklike" onClick={() => go('home')}>{s.nav.home}</button><br />
            <button className="linklike" onClick={() => go('services')}>{s.nav.services}</button><br />
            <button className="linklike" onClick={() => go('about')}>{s.nav.about}</button><br />
            <button className="linklike" onClick={() => go('contact')}>{s.nav.contact}</button></p>
          </div>
          <div><h3>{s.footer.contactTitle}</h3>
            <p><a href={`tel:${s.phoneTel}`}>{s.phoneDisplay}</a><br />{s.location}</p>
          </div>
        </div><p style={{ marginTop: 24 }}>{s.footer.copyright}</p></div></footer>
      )}
    </div>
  )
}
