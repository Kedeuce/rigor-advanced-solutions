import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, DEFAULT_SLOT, FONT_CHOICES, IMAGE_SIZES, IMAGE_WRAPS, PLACEMENT_SLOTS, type BreakerSettings, type ImageSize, type ImageWrap, type PageKey, type ServiceItem, type SiteImage, type SiteSettings } from './lib/settings'
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
 * Images with Text wrap set to Float left/right render floated, so the
 * page text flows around them; the rest render in the centred gallery.
 * (With includeFloated={false} the floated ones are left out — the Home
 * top slot uses that, because its floated images render inside the hero
 * text instead, where the hero headline and intro wrap around them.)
 */
function FloatImages({ page, slot, images }: { page: PageKey; slot: string; images: SiteImage[] }) {
  const list = (images ?? []).filter((im) => (im.position || DEFAULT_SLOT[page]) === slot && (im.wrap === 'left' || im.wrap === 'right'))
  if (list.length === 0) return null
  return (
    <>
      {list.map((img) => (
        <figure className={`slot-img size-${img.size || 'medium'} wrap-${img.wrap}`} key={img.id}>
          <img src={img.url} alt={img.alt || 'Image'} loading="lazy" />
          {img.caption ? <figcaption>{img.caption}</figcaption> : null}
        </figure>
      ))}
    </>
  )
}

function SlotImages({ page, slot, images, className = '', includeFloated = true }: { page: PageKey; slot: string; images: SiteImage[]; className?: string; includeFloated?: boolean }) {
  const list = (images ?? []).filter((im) => (im.position || DEFAULT_SLOT[page]) === slot)
  if (list.length === 0) return null
  const normal = list.filter((im) => !im.wrap || im.wrap === 'none')
  return (
    <>
      {includeFloated && <FloatImages page={page} slot={slot} images={images} />}
      {normal.length > 0 && (
        <div className={`slot-images ${className}`}>
          {normal.map((img) => (
            <figure className={`slot-img size-${img.size || 'medium'}`} key={img.id}>
              <img src={img.url} alt={img.alt || 'Image'} loading="lazy" />
              {img.caption ? <figcaption>{img.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      )}
    </>
  )
}

// Only Dada's emails can sign in as admin. Anyone else gets signed straight back out.
const ADMIN_EMAILS = ['kebraphotography@gmail.com', 'kedeuce@gmail.com']

type View = 'home' | 'services' | 'about' | 'contact' | 'admin'

/**
 * A text field in Admin. Pass sizeKey (plus sizeValue / sizePlaceholder /
 * onSizeChange) and a small "Size" box appears right beside the text, so
 * Dada can size that exact piece of text. Leaving the size box blank
 * removes the per-text size and the text falls back to the general size.
 */
function Field({ label, value, onChange, textarea = false, sizeKey, sizeValue, sizePlaceholder, onSizeChange }: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  sizeKey?: string
  sizeValue?: number
  sizePlaceholder?: number
  onSizeChange?: (n: number | undefined) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-with-size">
        {textarea ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {sizeKey && onSizeChange && (
          <div className="size-box">
            <span>Size</span>
            <DraftSizeInput
              value={sizeValue}
              placeholder={sizePlaceholder}
              min={10}
              max={96}
              onCommit={onSizeChange}
              title="Size of this text in pixels — leave blank to use the general size"
            />
          </div>
        )}
      </div>
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

function CheckField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

/**
 * A size-only box for a text whose words are edited somewhere else
 * (the big "Our Services" title on the Home page shares its words with
 * the small Services-page label, so it gets its own size).
 */
function SizeField({ label, value, placeholder, onChange }: { label: string; value?: number; placeholder?: number; onChange: (n: number | undefined) => void }) {
  return (
    <div className="field"><label>{label}</label>
      <DraftSizeInput
        value={value}
        placeholder={placeholder}
        min={10}
        max={96}
        onCommit={onChange}
        title="Size of this text in pixels — leave blank to use the general size"
      />
    </div>
  )
}

/**
 * A size input that types smoothly on iPhone.
 *
 * The old version wrote every keystroke straight into the whole site
 * settings, re-rendering the entire Admin on each digit — on iOS that
 * kills typing (the keyboard dismisses, focus is lost, digits don't
 * stick). This one keeps a LOCAL draft while typing: only the draft
 * changes per keystroke, nothing else re-renders. The size is committed
 * to settings on blur (or Enter). Empty clears the size (undefined).
 * Uses type="text" with a numeric keyboard instead of type="number",
 * which has its own quirks on iOS.
 */
function DraftSizeInput({ value, placeholder, min, max, onCommit, title }: {
  value?: number
  placeholder?: number
  min: number
  max: number
  onCommit: (n: number | undefined) => void
  title: string
}) {
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '')
  useEffect(() => { setDraft(value !== undefined ? String(value) : '') }, [value])
  const commit = () => {
    const raw = draft.trim()
    if (raw === '') { onCommit(undefined); return }
    const n = Number(raw)
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, Math.round(n))))
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      placeholder={placeholder !== undefined ? String(placeholder) : ''}
      title={title}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
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
  /** Where a newly added image goes on each page — picked in the Add row, before adding. */
  const [addPosition, setAddPosition] = useState<Record<PageKey, string>>({ home: DEFAULT_SLOT.home, services: DEFAULT_SLOT.services, about: DEFAULT_SLOT.about, contact: DEFAULT_SLOT.contact })
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<{ kind: 'page'; page: PageKey; position: string } | { kind: 'hero' } | { kind: 'replace'; page: PageKey; id: string } | null>(null)
  /** The image currently being dragged in an Images editor (HTML5 drag and drop). */
  const [dragImg, setDragImg] = useState<{ page: PageKey; id: string } | null>(null)

  // Admin is hidden from public visitors: it opens only via the /admin
  // path (e.g. https://rigoradvancedsolutions.com/admin) or the #admin
  // hash (e.g. https://rigoradvancedsolutions.com/#admin). The /admin path
  // is the main way in: a hash can be dropped by the apex-to-www redirect
  // on some mobile browsers, but a path always survives it. No button or
  // link anywhere on the public site leads to it.
  useEffect(() => {
    const openAdminFromUrl = () => {
      const path = window.location.pathname
      if (path === '/admin' || path === '/admin/' || window.location.hash === '#admin') {
        setView('admin')
        // Normalise the address bar to the /admin path, no page reload.
        if (path !== '/admin') window.history.replaceState(null, '', '/admin')
      }
    }
    openAdminFromUrl()
    window.addEventListener('hashchange', openAdminFromUrl)
    return () => window.removeEventListener('hashchange', openAdminFromUrl)
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
    '--heading-size': `${Math.min(72, Math.max(12, settings.fonts.headingSize ?? 38))}px`,
    '--body-size': `${Math.min(24, Math.max(12, settings.fonts.bodySize ?? 16))}px`,
    '--breaker-color': settings.breakers?.color ?? '#0e5f8f',
    '--breaker-thickness': `${Math.min(12, Math.max(1, settings.breakers?.thickness ?? 1))}px`,
  }) as CSSProperties, [settings])

  // Leaving Admin (sign out, or Preview Site) returns the address bar to
  // '/' and clears any #admin hash, so the Admin view is not left open.
  const go = (v: View) => {
    setView(v)
    if (v === 'admin') {
      if (window.location.pathname !== '/admin') window.history.replaceState(null, '', '/admin')
    } else if (window.location.pathname === '/admin' || window.location.pathname === '/admin/' || window.location.hash === '#admin') {
      window.history.replaceState(null, '', '/')
    }
    window.scrollTo({ top: 0 })
  }
  const set = (fn: (s: SiteSettings) => SiteSettings) => { setSettings((prev) => fn(prev)); setSaveNote('') }
  const updateService = (i: number, patch: Partial<ServiceItem>) =>
    set((s) => ({ ...s, services: { ...s.services, items: s.services.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } }))

  const headingBase = settings.fonts.headingSize ?? 38
  const bodyBase = settings.fonts.bodySize ?? 16
  /** Per-text size: a size saved for this exact text wins, otherwise the
      general heading/body size is used. Clamped to 10–96px. */
  const fs = (key: string, fallback: number) => {
    const v = settings.fontSizes?.[key]
    const n = typeof v === 'number' && v > 0 ? v : fallback
    return Math.min(96, Math.max(10, n))
  }
  /** Section-title size, keeping the responsive clamp shape the site already uses. */
  const titleSize = (key: string) => {
    const f = fs(key, headingBase)
    return `clamp(${Math.round(f * 0.68)}px, 4vw, ${f}px)`
  }
  /** Props to wire a Field's "Size" box to one text's per-text size. */
  const sizeProps = (key: string, fallback: number) => ({
    sizeKey: key,
    sizeValue: settings.fontSizes?.[key],
    sizePlaceholder: fallback,
    onSizeChange: (n?: number) => setSize(key, n),
  })
  /** Save (or clear, when n is undefined) one text's per-text size. */
  const setSize = (key: string, n?: number) => set((p) => {
    const next = { ...(p.fontSizes ?? {}) }
    if (n === undefined) delete next[key]
    else next[key] = n
    return { ...p, fontSizes: next }
  })
  /** Patch the section-breaker settings (colour, thickness, show/hide). */
  const setBreaker = (patch: Partial<BreakerSettings>) =>
    set((p) => ({ ...p, breakers: { ...DEFAULT_SETTINGS.breakers, ...(p.breakers ?? {}), ...patch } }))

  const newImageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const addImage = (page: PageKey, url: string, alt = '', position?: string) =>
    set((s) => ({ ...s, images: { ...s.images, [page]: [...(s.images?.[page] ?? []), { id: newImageId(), url, alt, caption: '', position: position || DEFAULT_SLOT[page], size: 'medium' as ImageSize }] } }))
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
  /** Drag and drop: move an image to a new spot in the same page's list. */
  const moveImageTo = (page: PageKey, id: string, toIndex: number) =>
    set((s) => {
      const list = [...(s.images?.[page] ?? [])]
      const from = list.findIndex((im) => im.id === id)
      if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return s
      const [item] = list.splice(from, 1)
      list.splice(toIndex, 0, item)
      return { ...s, images: { ...s.images, [page]: list } }
    })

  /** Picking a photo opens the cropper first; the cropped photo is uploaded when she confirms it. */
  function handleImageFile(page: PageKey, file: File | undefined) {
    if (!file) return
    setCropFile(file)
    setCropTarget({ kind: 'page', page, position: addPosition[page] || DEFAULT_SLOT[page] })
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
        addImage(target.page, url, cropped.name.replace(/\.[^.]+$/, ''), target.position)
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
    addImage(page, url, '', addPosition[page] || DEFAULT_SLOT[page])
    setUrlDraft((d) => ({ ...d, [page]: '' }))
    setUploadNote('Image added. Press Save Changes to make it live.')
  }

  const imageEditor = (page: PageKey, label: string) => {
    const list = settings.images?.[page] ?? []
    const cropHere = cropFile && cropTarget && ((cropTarget.kind === 'page' && cropTarget.page === page) || (cropTarget.kind === 'replace' && cropTarget.page === page))
    return (
      <section className="admin-section" key={`images-${page}`}>
        <h2>{label}</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Add photos to this page and choose exactly where each one sits, how big it is, and what order they appear in. Drag a photo by its thumbnail to move it up or down, or use the Move up / Move down buttons. Uploading a photo lets you crop and rotate it first.</p>
        {list.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)' }}>No images on this page yet.</p>}
        {list.map((img, i) => (
          <div
            className="img-row"
            key={img.id}
            style={dragImg?.id === img.id ? { opacity: 0.45 } : undefined}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); if (dragImg && dragImg.page === page && dragImg.id !== img.id) moveImageTo(page, dragImg.id, i); setDragImg(null) }}
          >
            <img
              className="img-thumb"
              src={img.url}
              alt={img.alt || 'Image preview'}
              draggable
              title="Drag this photo to move it up or down"
              onDragStart={(e) => { setDragImg({ page, id: img.id }); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', img.id) } catch { /* some browsers need data set to start a drag */ } }}
              onDragEnd={() => setDragImg(null)}
            />
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
              <div className="field">
                <label>Text wrap</label>
                <select value={img.wrap || 'none'} onChange={(e) => updateImage(page, img.id, { wrap: e.target.value as ImageWrap })}>
                  {IMAGE_WRAPS.map((opt) => (
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
          <div className="field" style={{ flex: '1 1 220px', minWidth: 200, marginBottom: 0 }}>
            <label>Where on the page</label>
            <select value={addPosition[page] || DEFAULT_SLOT[page]} onChange={(e) => setAddPosition((d) => ({ ...d, [page]: e.target.value }))}>
              {PLACEMENT_SLOTS[page].map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
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
    <button key={v} className={view === v ? 'active' : ''} style={{ fontSize: fs(`nav.${v}`, 16) }} onClick={() => go(v)}>{label}</button>
  )

  let page: ReactNode = null

  if (view === 'home') {
    const heroSlotImages = (s.images?.home ?? []).filter((im) => (im.position || DEFAULT_SLOT.home) === 'hero')
    page = (
      <>
        <div className="wrap"><SlotImages page="home" slot="top" images={s.images?.home ?? []} includeFloated={false} /></div>
        <section className="hero">
          <div className="wrap hero-inner">
            <div className="hero-text">
              <FloatImages page="home" slot="top" images={s.images?.home ?? []} />
              <span className="eyebrow" style={{ fontSize: fs('home.eyebrow', 13) }}>{s.home.eyebrow}</span>
              <h1 style={{ fontSize: `clamp(34px, 6vw, ${fs('home.headline', Math.round(headingBase * 1.6))}px)` }}>{s.home.headline}</h1>
              <p className="subhead" style={{ fontSize: `clamp(18px, 2.5vw, ${fs('home.subhead', 24)}px)` }}>{s.home.subhead}</p>
              <p className="lede" style={{ fontSize: fs('home.intro', 18) }}>{s.home.intro}</p>
              {s.breakers?.showGoldLine !== false && <p className="gold-line" style={{ fontSize: fs('home.goldLine', 18) }}>{s.home.goldLine}</p>}
            </div>
            {s.heroImage ? <img className="hero-img" src={s.heroImage} alt="Glowing network globe" /> : heroSlotImages.map((im) => <img key={im.id} className="hero-img" src={im.url} alt={im.alt || 'Image'} />)}
          </div>
        </section>
        {s.breakers?.homeSections && <div className="wrap"><hr className="section-breaker" /></div>}
        <section className="section"><div className="wrap">
          <span className="eyebrow" style={{ fontSize: fs('home.servicesLabel', 13) }}>{s.home.servicesLabel}</span>
          <h2 className="section-title" style={{ fontSize: titleSize('home.servicesTitle') }}>{s.services.label}</h2>
          <div className="cards">
            {s.services.items.map((it, i) => (
              <article className="card" key={it.name}>
                <div className="service-icon">{SERVICE_ICONS[i] ?? null}</div>
                <h3 style={{ fontSize: fs(`services.items.${i}.name`, 21) }}>{it.name}</h3>
                <p style={{ fontSize: fs(`services.items.${i}.short`, bodyBase) }}>{it.short}</p>
                <button className="linklike" onClick={() => go('services')}>See full details</button>
              </article>
            ))}
          </div>
          <SlotImages page="home" slot="after-services" images={s.images?.home ?? []} />
        </div></section>
        {s.breakers?.homeSections && <div className="wrap"><hr className="section-breaker" /></div>}
        <section className="section"><div className="wrap">
          <h2 className="section-title" style={{ fontSize: titleSize('home.whyTitle') }}>{s.home.whyTitle}</h2>
          <p style={{ fontSize: fs('home.whyIntro', bodyBase) }}>{s.home.whyIntro}</p>
          <div className="cards">
            {s.home.whyItems.map((w, i) => (
              <article className="card" key={w.title}><h3 style={{ fontSize: fs(`home.whyItems.${i}.title`, 21) }}>{w.title}</h3><p style={{ fontSize: fs(`home.whyItems.${i}.text`, bodyBase) }}>{w.text}</p></article>
            ))}
          </div>
        </div></section>
        {s.breakers?.homeSections && <div className="wrap"><hr className="section-breaker" /></div>}
        <section className="section"><div className="wrap">
          <h2 className="section-title" style={{ fontSize: titleSize('home.processTitle') }}>{s.home.processTitle}</h2>
          <p style={{ fontSize: fs('home.processIntro', bodyBase) }}>{s.home.processIntro}</p>
          <div className="steps">
            {s.home.processSteps.map((st, i) => (
              <article className="card" key={st.title}>
                <div className="step-num">{i + 1}</div>
                <h3 style={{ fontSize: fs(`home.processSteps.${i}.title`, 21) }}>{st.title}</h3><p style={{ fontSize: fs(`home.processSteps.${i}.text`, bodyBase) }}>{st.text}</p>
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
        <span className="eyebrow" style={{ fontSize: fs('services.label', 13) }}>{s.services.label}</span>
        <h1 style={{ fontSize: fs('services.title', headingBase) }}>{s.services.title}</h1>
        <p style={{ maxWidth: 720, fontSize: fs('services.intro', 18) }}>{s.services.intro}</p>
        {s.services.items.map((it, i) => (
          <Fragment key={it.name}>
            <article className="service-detail">
              <div className="service-icon">{SERVICE_ICONS[i] ?? null}</div>
              <h2 style={{ fontSize: fs(`services.items.${i}.name`, Math.round(headingBase * 0.63)) }}>{it.name}</h2>
              <p style={{ fontSize: fs(`services.items.${i}.detail`, bodyBase) }}>{it.detail}</p>
              <h3 style={{ color: 'var(--gold)', fontSize: fs('services.whoHeading', 19) }}>{s.services.whoHeading}</h3>
              <p style={{ fontSize: fs(`services.items.${i}.whoFor`, bodyBase) }}>{it.whoFor}</p>
              <h3 style={{ fontSize: fs('services.includesHeading', 19) }}>{s.services.includesHeading}</h3>
              <ul style={{ fontSize: fs(`services.items.${i}.includes`, bodyBase) }}>{it.includes.map((inc) => <li key={inc}>{inc}</li>)}</ul>
            </article>
            {s.breakers?.servicesSections && i < s.services.items.length - 1 && <hr className="section-breaker" />}
          </Fragment>
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
        <span className="eyebrow" style={{ fontSize: fs('about.label', 13) }}>{s.about.label}</span>
        <h1 style={{ fontSize: fs('about.title', headingBase) }}>{s.about.title}</h1>
        <p style={{ maxWidth: 720, fontSize: fs('about.intro', 18) }}>{s.about.intro}</p>
        <p style={{ fontSize: fs('tagline', 20), color: 'var(--accent)', fontWeight: 600 }}>{s.tagline}</p>
        <div className="two-col" style={{ marginTop: 28 }}>
          <article className="info-card"><h2 style={{ fontSize: fs('about.missionTitle', Math.round(headingBase * 0.63)) }}>{s.about.missionTitle}</h2><p style={{ fontSize: fs('about.missionText', bodyBase) }}>{s.about.missionText}</p></article>
          <article className="info-card"><h2 style={{ fontSize: fs('about.promiseTitle', Math.round(headingBase * 0.63)) }}>{s.about.promiseTitle}</h2><p style={{ fontSize: fs('about.promiseText', bodyBase) }}>{s.about.promiseText}</p></article>
        </div>
        <SlotImages page="about" slot="after-story" images={s.images?.about ?? []} />
        {s.breakers?.aboutSections && <hr className="section-breaker" />}
        <h2 className="section-title" style={{ marginTop: 40, fontSize: titleSize('about.valuesTitle') }}>{s.about.valuesTitle}</h2>
        <div className="cards">
          {s.about.values.map((v, i) => (
            <article className="card" key={v.title}><h3 style={{ fontSize: fs(`about.values.${i}.title`, 21) }}>{v.title}</h3><p style={{ fontSize: fs(`about.values.${i}.text`, bodyBase) }}>{v.text}</p></article>
          ))}
        </div>
        {s.breakers?.aboutSections && <hr className="section-breaker" />}
        <SlotImages page="about" slot="after-values" images={s.images?.about ?? []} />
        <SlotImages page="about" slot="bottom" images={s.images?.about ?? []} />
      </div></section>
    )
  }

  if (view === 'contact') {
    page = (
      <section className="section"><div className="wrap">
        <SlotImages page="contact" slot="top" images={s.images?.contact ?? []} />
        <span className="eyebrow" style={{ fontSize: fs('contact.label', 13) }}>{s.contact.label}</span>
        <h1 style={{ fontSize: fs('contact.title', headingBase) }}>{s.contact.title}</h1>
        <p style={{ maxWidth: 720, fontSize: fs('contact.intro', 18) }}>{s.contact.intro}</p>
        <div className="two-col" style={{ marginTop: 28 }}>
          <article className="info-card">
            <h2 style={{ fontSize: fs('contact.phoneCardTitle', Math.round(headingBase * 0.63)) }}>{s.contact.phoneCardTitle}</h2>
            <a href={`tel:${s.phoneTel}`} style={{ fontSize: fs('business.phoneDisplay', 22) }}>{s.phoneDisplay}</a>
            <p style={{ fontSize: fs('contact.phoneCardNote', bodyBase) }}>{s.contact.phoneCardNote}</p>
          </article>
          <article className="info-card">
            <h2 style={{ fontSize: fs('contact.locationCardTitle', Math.round(headingBase * 0.63)) }}>{s.contact.locationCardTitle}</h2>
            <p style={{ fontSize: fs('contact.location', 22), fontWeight: 700, color: 'var(--heading)' }}>{s.location}</p>
            <p style={{ fontSize: fs('contact.locationCardNote', bodyBase) }}>{s.contact.locationCardNote}</p>
          </article>
        </div>
        {s.breakers?.contactSections && <hr className="section-breaker" />}
        <SlotImages page="contact" slot="after-info" images={s.images?.contact ?? []} />
        <form className="consult" onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}>
          <h2 style={{ fontSize: fs('contact.formTitle', 24) }}>{s.contact.formTitle}</h2>
          <label style={{ fontSize: fs('contact.nameLabel', bodyBase) }}>{s.contact.nameLabel}</label>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: fs('contact.emailLabel', bodyBase) }}>{s.contact.emailLabel}</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label style={{ fontSize: fs('contact.phoneLabel', bodyBase) }}>{s.contact.phoneLabel}</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <label style={{ fontSize: fs('contact.messageLabel', bodyBase) }}>{s.contact.messageLabel}</label>
          <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {submitted ? (
            <p style={{ marginTop: 20, color: 'var(--accent)', fontWeight: 600, fontSize: fs('contact.thankYou', bodyBase) }}>{s.contact.thankYou}</p>
          ) : (
            <button className="btn" type="submit" style={{ fontSize: fs('contact.submitLabel', 17) }}>{s.contact.submitLabel}</button>
          )}
          {submitted && <a className="btn secondary" href={`tel:${s.phoneTel}`} style={{ marginLeft: 12, textDecoration: 'none', fontSize: fs('contact.callButtonLabel', 17) }}>{s.contact.callButtonLabel}</a>}
        </form>
        <SlotImages page="contact" slot="after-form" images={s.images?.contact ?? []} />
        {s.breakers?.contactSections && <hr className="section-breaker" />}
        <div className="closing">
          <h2 style={{ fontSize: `clamp(24px, 4vw, ${fs('contact.closingTitle', Math.round(headingBase * 0.9))}px)` }}>{s.contact.closingTitle}</h2>
          <p style={{ fontSize: fs('contact.closingText', bodyBase) }}>{s.contact.closingText}</p>
          <a className="btn" href={`tel:${s.phoneTel}`} style={{ textDecoration: 'none', fontSize: fs('contact.callButtonLabel', 17) }}>{s.contact.callButtonLabel}</a>
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
          <Field label="Business name" value={s.businessName} onChange={(v) => set((p) => ({ ...p, businessName: v }))} {...sizeProps('brand.name', 26)} />
          <Field label="Tagline" value={s.tagline} onChange={(v) => set((p) => ({ ...p, tagline: v }))} {...sizeProps('tagline', 16)} />
          <Field label="Phone, as shown" value={s.phoneDisplay} onChange={(v) => set((p) => ({ ...p, phoneDisplay: v }))} {...sizeProps('business.phoneDisplay', 16)} />
          <Field label="Phone, for tap to call (digits only, with country code)" value={s.phoneTel} onChange={(v) => set((p) => ({ ...p, phoneTel: v }))} />
          <Field label="Location" value={s.location} onChange={(v) => set((p) => ({ ...p, location: v }))} {...sizeProps('contact.location', 16)} />
          <Field label="Menu label, Home" value={s.nav.home} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, home: v } }))} {...sizeProps('nav.home', 16)} />
          <Field label="Menu label, Services" value={s.nav.services} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, services: v } }))} {...sizeProps('nav.services', 16)} />
          <Field label="Menu label, About" value={s.nav.about} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, about: v } }))} {...sizeProps('nav.about', 16)} />
          <Field label="Menu label, Contact" value={s.nav.contact} onChange={(v) => set((p) => ({ ...p, nav: { ...p.nav, contact: v } }))} {...sizeProps('nav.contact', 16)} />
        </section>

        <section className="admin-section"><h2>Design, fonts and colours</h2>
          <SelectField label="Heading font" value={s.fonts.headingFont} onChange={(v) => set((p) => ({ ...p, fonts: { ...p.fonts, headingFont: v } }))} />
          <SelectField label="Body font" value={s.fonts.bodyFont} onChange={(v) => set((p) => ({ ...p, fonts: { ...p.fonts, bodyFont: v } }))} />
          <div className="field"><label>Heading size (px)</label>
            <DraftSizeInput value={s.fonts.headingSize ?? 38} min={12} max={72} onCommit={(n) => set((p) => ({ ...p, fonts: { ...p.fonts, headingSize: n ?? 38 } }))} title="Heading size in pixels" />
          </div>
          <div className="field"><label>Body text size (px)</label>
            <DraftSizeInput value={s.fonts.bodySize ?? 16} min={12} max={24} onCommit={(n) => set((p) => ({ ...p, fonts: { ...p.fonts, bodySize: n ?? 16 } }))} title="Body text size in pixels" />
          </div>
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

        <section className="admin-section"><h2>Section breakers</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>The lines that break up the page: under the header, above the footer, the gold line under the Home intro, and divider lines between sections. The gold line's colour is the Gold highlight colour in Design, and its size is set beside its text in the Home page section.</p>
          <ColorField label="Divider line colour" value={s.breakers?.color ?? '#0e5f8f'} onChange={(v) => setBreaker({ color: v })} />
          <div className="field"><label>Divider line thickness (px)</label>
            <input type="number" min={1} max={12} value={s.breakers?.thickness ?? 1} onChange={(e) => setBreaker({ thickness: Number(e.target.value) || 1 })} />
          </div>
          <CheckField label="Show the line under the header" value={s.breakers?.showHeader ?? true} onChange={(v) => setBreaker({ showHeader: v })} />
          <CheckField label="Show the line above the footer" value={s.breakers?.showFooter ?? true} onChange={(v) => setBreaker({ showFooter: v })} />
          <CheckField label="Show the gold line under the Home intro" value={s.breakers?.showGoldLine ?? true} onChange={(v) => setBreaker({ showGoldLine: v })} />
          <CheckField label="Show divider lines between the sections on the Home page" value={s.breakers?.homeSections ?? false} onChange={(v) => setBreaker({ homeSections: v })} />
          <CheckField label="Show divider lines between the service details on the Services page" value={s.breakers?.servicesSections ?? false} onChange={(v) => setBreaker({ servicesSections: v })} />
          <CheckField label="Show divider lines between the blocks on the About page" value={s.breakers?.aboutSections ?? false} onChange={(v) => setBreaker({ aboutSections: v })} />
          <CheckField label="Show divider lines between the blocks on the Contact page" value={s.breakers?.contactSections ?? false} onChange={(v) => setBreaker({ contactSections: v })} />
        </section>

        <section className="admin-section"><h2>Home page</h2>
          <Field label="Eyebrow" value={s.home.eyebrow} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, eyebrow: v } }))} {...sizeProps('home.eyebrow', 13)} />
          <Field label="Headline" value={s.home.headline} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, headline: v } }))} {...sizeProps('home.headline', Math.round(headingBase * 1.6))} />
          <Field label="Subhead" value={s.home.subhead} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, subhead: v } }))} {...sizeProps('home.subhead', 24)} />
          <Field label="Intro" value={s.home.intro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, intro: v } }))} {...sizeProps('home.intro', 18)} />
          <Field label="Gold line under the intro" value={s.home.goldLine} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, goldLine: v } }))} {...sizeProps('home.goldLine', 18)} />
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
          <Field label="Services label" value={s.home.servicesLabel} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, servicesLabel: v } }))} {...sizeProps('home.servicesLabel', 13)} />
          <SizeField label="Services title size — the big “Our Services” heading on the Home page (px)" value={settings.fontSizes?.['home.servicesTitle']} placeholder={headingBase} onChange={(n) => setSize('home.servicesTitle', n)} />
          <Field label="Why Rigor title" value={s.home.whyTitle} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyTitle: v } }))} {...sizeProps('home.whyTitle', headingBase)} />
          <Field label="Why Rigor intro" value={s.home.whyIntro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyIntro: v } }))} {...sizeProps('home.whyIntro', bodyBase)} />
          {s.home.whyItems.map((w, i) => (
            <div key={i}>
              <Field label={`Why item ${i + 1}, title`} value={w.title} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyItems: p.home.whyItems.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))} {...sizeProps(`home.whyItems.${i}.title`, 21)} />
              <Field label={`Why item ${i + 1}, text`} value={w.text} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, whyItems: p.home.whyItems.map((x, j) => (j === i ? { ...x, text: v } : x)) } }))} {...sizeProps(`home.whyItems.${i}.text`, bodyBase)} />
            </div>
          ))}
          <Field label="How We Work title" value={s.home.processTitle} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processTitle: v } }))} {...sizeProps('home.processTitle', headingBase)} />
          <Field label="How We Work intro" value={s.home.processIntro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processIntro: v } }))} {...sizeProps('home.processIntro', bodyBase)} />
          {s.home.processSteps.map((st, i) => (
            <div key={i}>
              <Field label={`Step ${i + 1}, title`} value={st.title} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processSteps: p.home.processSteps.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))} {...sizeProps(`home.processSteps.${i}.title`, 21)} />
              <Field label={`Step ${i + 1}, text`} value={st.text} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, processSteps: p.home.processSteps.map((x, j) => (j === i ? { ...x, text: v } : x)) } }))} {...sizeProps(`home.processSteps.${i}.text`, bodyBase)} />
            </div>
          ))}
        </section>

        {imageEditor('home', 'Home page images')}

        <section className="admin-section"><h2>Services page</h2>
          <Field label="Services label" value={s.services.label} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, label: v } }))} {...sizeProps('services.label', 13)} />
          <Field label="Services title" value={s.services.title} textarea onChange={(v) => set((p) => ({ ...p, services: { ...p.services, title: v } }))} {...sizeProps('services.title', headingBase)} />
          <Field label="Services intro" value={s.services.intro} textarea onChange={(v) => set((p) => ({ ...p, services: { ...p.services, intro: v } }))} {...sizeProps('services.intro', 18)} />
          <Field label="Who it is for, heading" value={s.services.whoHeading} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, whoHeading: v } }))} {...sizeProps('services.whoHeading', 19)} />
          <Field label="What it includes, heading" value={s.services.includesHeading} onChange={(v) => set((p) => ({ ...p, services: { ...p.services, includesHeading: v } }))} {...sizeProps('services.includesHeading', 19)} />
          {s.services.items.map((it, i) => (
            <div key={it.name} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <Field label={`Service ${i + 1}, name`} value={it.name} onChange={(v) => updateService(i, { name: v })} {...sizeProps(`services.items.${i}.name`, 21)} />
              <Field label={`Service ${i + 1}, short text`} value={it.short} textarea onChange={(v) => updateService(i, { short: v })} {...sizeProps(`services.items.${i}.short`, bodyBase)} />
              <Field label={`Service ${i + 1}, full detail`} value={it.detail} textarea onChange={(v) => updateService(i, { detail: v })} {...sizeProps(`services.items.${i}.detail`, bodyBase)} />
              <Field label={`Service ${i + 1}, who it is for`} value={it.whoFor} textarea onChange={(v) => updateService(i, { whoFor: v })} {...sizeProps(`services.items.${i}.whoFor`, bodyBase)} />
              <Field label={`Service ${i + 1}, includes (comma separated)`} value={it.includes.join(', ')} onChange={(v) => updateService(i, { includes: v.split(',').map((x) => x.trim()).filter(Boolean) })} {...sizeProps(`services.items.${i}.includes`, bodyBase)} />
            </div>
          ))}
        </section>

        {imageEditor('services', 'Services page images')}

        <section className="admin-section"><h2>About page</h2>
          <Field label="About label" value={s.about.label} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, label: v } }))} {...sizeProps('about.label', 13)} />
          <Field label="About title" value={s.about.title} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, title: v } }))} {...sizeProps('about.title', headingBase)} />
          <Field label="About intro" value={s.about.intro} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, intro: v } }))} {...sizeProps('about.intro', 18)} />
          <Field label="Mission title" value={s.about.missionTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, missionTitle: v } }))} {...sizeProps('about.missionTitle', Math.round(headingBase * 0.63))} />
          <Field label="Mission text" value={s.about.missionText} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, missionText: v } }))} {...sizeProps('about.missionText', bodyBase)} />
          <Field label="Promise title" value={s.about.promiseTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, promiseTitle: v } }))} {...sizeProps('about.promiseTitle', Math.round(headingBase * 0.63))} />
          <Field label="Promise text" value={s.about.promiseText} textarea onChange={(v) => set((p) => ({ ...p, about: { ...p.about, promiseText: v } }))} {...sizeProps('about.promiseText', bodyBase)} />
          <Field label="Values title" value={s.about.valuesTitle} onChange={(v) => set((p) => ({ ...p, about: { ...p.about, valuesTitle: v } }))} {...sizeProps('about.valuesTitle', headingBase)} />
          {s.about.values.map((v, i) => (
            <div key={i}>
              <Field label={`Value ${i + 1}, title`} value={v.title} onChange={(val) => set((p) => ({ ...p, about: { ...p.about, values: p.about.values.map((x, j) => (j === i ? { ...x, title: val } : x)) } }))} {...sizeProps(`about.values.${i}.title`, 21)} />
              <Field label={`Value ${i + 1}, text`} value={v.text} textarea onChange={(val) => set((p) => ({ ...p, about: { ...p.about, values: p.about.values.map((x, j) => (j === i ? { ...x, text: val } : x)) } }))} {...sizeProps(`about.values.${i}.text`, bodyBase)} />
            </div>
          ))}
        </section>

        {imageEditor('about', 'About page images')}

        <section className="admin-section"><h2>Contact page and footer</h2>
          <Field label="Contact label" value={s.contact.label} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, label: v } }))} {...sizeProps('contact.label', 13)} />
          <Field label="Contact title" value={s.contact.title} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, title: v } }))} {...sizeProps('contact.title', headingBase)} />
          <Field label="Contact intro" value={s.contact.intro} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, intro: v } }))} {...sizeProps('contact.intro', 18)} />
          <Field label="Phone card title" value={s.contact.phoneCardTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneCardTitle: v } }))} {...sizeProps('contact.phoneCardTitle', Math.round(headingBase * 0.63))} />
          <Field label="Note under the phone number" value={s.contact.phoneCardNote} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneCardNote: v } }))} {...sizeProps('contact.phoneCardNote', bodyBase)} />
          <Field label="Location card title" value={s.contact.locationCardTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, locationCardTitle: v } }))} {...sizeProps('contact.locationCardTitle', Math.round(headingBase * 0.63))} />
          <Field label="Location card note" value={s.contact.locationCardNote} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, locationCardNote: v } }))} {...sizeProps('contact.locationCardNote', bodyBase)} />
          <Field label="Form title" value={s.contact.formTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, formTitle: v } }))} {...sizeProps('contact.formTitle', 24)} />
          <Field label="Name label" value={s.contact.nameLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, nameLabel: v } }))} {...sizeProps('contact.nameLabel', bodyBase)} />
          <Field label="Email label" value={s.contact.emailLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, emailLabel: v } }))} {...sizeProps('contact.emailLabel', bodyBase)} />
          <Field label="Phone label" value={s.contact.phoneLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, phoneLabel: v } }))} {...sizeProps('contact.phoneLabel', bodyBase)} />
          <Field label="Message label" value={s.contact.messageLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, messageLabel: v } }))} {...sizeProps('contact.messageLabel', bodyBase)} />
          <Field label="Submit button" value={s.contact.submitLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, submitLabel: v } }))} {...sizeProps('contact.submitLabel', 17)} />
          <Field label="Thank you message" value={s.contact.thankYou} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, thankYou: v } }))} {...sizeProps('contact.thankYou', bodyBase)} />
          <Field label="Closing title" value={s.contact.closingTitle} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, closingTitle: v } }))} {...sizeProps('contact.closingTitle', Math.round(headingBase * 0.9))} />
          <Field label="Closing text" value={s.contact.closingText} textarea onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, closingText: v } }))} {...sizeProps('contact.closingText', bodyBase)} />
          <Field label="Call button word" value={s.contact.callButtonLabel} onChange={(v) => set((p) => ({ ...p, contact: { ...p.contact, callButtonLabel: v } }))} {...sizeProps('contact.callButtonLabel', 17)} />
          <Field label="Footer Explore heading" value={s.footer.exploreTitle} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, exploreTitle: v } }))} {...sizeProps('footer.exploreTitle', 18)} />
          <Field label="Footer Contact heading" value={s.footer.contactTitle} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, contactTitle: v } }))} {...sizeProps('footer.contactTitle', 18)} />
          <Field label="Copyright line" value={s.footer.copyright} onChange={(v) => set((p) => ({ ...p, footer: { ...p.footer, copyright: v } }))} {...sizeProps('footer.copyright', bodyBase)} />
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
      <header className="site-header" style={s.breakers?.showHeader === false ? { borderBottom: 'none' } : undefined}>
        <div className="wrap">
          <div className="brand-row">
            <div className="logo-mark">RAS</div>
            <div>
              <div className="brand-name" style={{ fontSize: fs('brand.name', 26) }}>{s.businessName}</div>
              <div className="brand-tag" style={{ fontSize: fs('tagline', 13) }}>{s.tagline}</div>
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
        <footer className="site-footer" style={s.breakers?.showFooter === false ? { borderTop: 'none' } : undefined}><div className="wrap"><div className="cols">
          <div><h3 style={{ fontSize: fs('brand.name', 18) }}>{s.businessName}</h3><p style={{ color: 'var(--gold)', fontSize: fs('tagline', bodyBase) }}>{s.tagline}</p></div>
          <div><h3 style={{ fontSize: fs('footer.exploreTitle', 18) }}>{s.footer.exploreTitle}</h3>
            <p><button className="linklike" style={{ fontSize: fs('nav.home', 15) }} onClick={() => go('home')}>{s.nav.home}</button><br />
            <button className="linklike" style={{ fontSize: fs('nav.services', 15) }} onClick={() => go('services')}>{s.nav.services}</button><br />
            <button className="linklike" style={{ fontSize: fs('nav.about', 15) }} onClick={() => go('about')}>{s.nav.about}</button><br />
            <button className="linklike" style={{ fontSize: fs('nav.contact', 15) }} onClick={() => go('contact')}>{s.nav.contact}</button></p>
          </div>
          <div><h3 style={{ fontSize: fs('footer.contactTitle', 18) }}>{s.footer.contactTitle}</h3>
            <p><a href={`tel:${s.phoneTel}`} style={{ fontSize: fs('business.phoneDisplay', bodyBase) }}>{s.phoneDisplay}</a><br /><span style={{ fontSize: fs('contact.location', bodyBase) }}>{s.location}</span></p>
          </div>
        </div><p style={{ marginTop: 24, fontSize: fs('footer.copyright', bodyBase) }}>{s.footer.copyright}</p></div></footer>
      )}
    </div>
  )
}
