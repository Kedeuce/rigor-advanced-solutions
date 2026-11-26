import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, FONT_CHOICES, type ServiceItem, type SiteSettings } from './lib/settings'
import { loadSettings, saveSettings } from './lib/store'
import { isSupabaseConfigured } from './lib/supabase'

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

export default function App() {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); setLoaded(true) })
  }, [])

  const vars = useMemo(() => ({
    '--bg': settings.colors.background,
    '--surface': settings.colors.surface,
    '--accent': settings.colors.accent,
    '--heading': settings.colors.heading,
    '--body': settings.colors.body,
    '--muted': settings.colors.muted,
    '--border': settings.colors.border,
    '--button-text': settings.colors.buttonText,
    '--heading-font': `'${settings.fonts.headingFont}', sans-serif`,
    '--body-font': `'${settings.fonts.bodyFont}', sans-serif`,
    '--radius': `${settings.fonts.radius}px`,
  }) as CSSProperties, [settings])

  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }) }
  const set = (fn: (s: SiteSettings) => SiteSettings) => { setSettings((prev) => fn(prev)); setSaveNote('') }
  const updateService = (i: number, patch: Partial<ServiceItem>) =>
    set((s) => ({ ...s, services: { ...s.services, items: s.services.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } }))

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

  if (!loaded) return <div className="wrap" style={vars}><p style={{ padding: 40 }}>Loading Rigor Advanced Solutions…</p></div>

  const s = settings
  const navBtn = (v: View, label: string) => (
    <button key={v} className={view === v ? 'active' : ''} onClick={() => go(v)}>{label}</button>
  )

  let page: ReactNode = null

  if (view === 'home') {
    page = (
      <>
        <section className="hero">
          <div className="globe" aria-hidden="true" />
          <div className="wrap">
            <span className="eyebrow">{s.home.eyebrow}</span>
            <h1>{s.home.headline}</h1>
            <p className="subhead">{s.home.subhead}</p>
            <p className="lede">{s.home.intro}</p>
            <p className="gold-line">{s.home.goldLine}</p>
          </div>
        </section>
        <section className="section"><div className="wrap">
          <span className="eyebrow">{s.home.servicesLabel}</span>
          <h2 className="section-title">{s.services.label}</h2>
          <div className="cards">
            {s.services.items.map((it, i) => (
              <article className="card" key={it.name}>
                <h3>{it.name}</h3>
                <p>{it.short}</p>
                <button className="linklike" onClick={() => go('services')}>See full details</button>
                {i === 0 && <span style={{ display: 'none' }} />}
              </article>
            ))}
          </div>
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
        </div></section>
      </>
    )
  }

  if (view === 'services') {
    page = (
      <section className="section" style={{ paddingBottom: 84 }}><div className="wrap">
        <span className="eyebrow">{s.services.label}</span>
        <h1>{s.services.title}</h1>
        <p style={{ maxWidth: 720, fontSize: 18 }}>{s.services.intro}</p>
        {s.services.items.map((it) => (
          <article className="service-detail" key={it.name}>
            <h2>{it.name}</h2>
            <p>{it.detail}</p>
            <h3>{s.services.whoHeading}</h3>
            <p>{it.whoFor}</p>
            <h3>{s.services.includesHeading}</h3>
            <ul>{it.includes.map((inc) => <li key={inc}>{inc}</li>)}</ul>
          </article>
        ))}
      </div></section>
    )
  }

  if (view === 'about') {
    page = (
      <section className="section"><div className="wrap">
        <span className="eyebrow">{s.about.label}</span>
        <h1>{s.about.title}</h1>
        <p style={{ maxWidth: 720, fontSize: 18 }}>{s.about.intro}</p>
        <p style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 600 }}>{s.tagline}</p>
        <div className="two-col" style={{ marginTop: 28 }}>
          <article className="info-card"><h2>{s.about.missionTitle}</h2><p>{s.about.missionText}</p></article>
          <article className="info-card"><h2>{s.about.promiseTitle}</h2><p>{s.about.promiseText}</p></article>
        </div>
        <h2 className="section-title" style={{ marginTop: 40 }}>{s.about.valuesTitle}</h2>
        <div className="cards">
          {s.about.values.map((v) => (
            <article className="card" key={v.title}><h3>{v.title}</h3><p>{v.text}</p></article>
          ))}
        </div>
      </div></section>
    )
  }

  if (view === 'contact') {
    page = (
      <section className="section"><div className="wrap">
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
        <div className="closing">
          <h2>{s.contact.closingTitle}</h2>
          <p>{s.contact.closingText}</p>
          <a className="btn" href={`tel:${s.phoneTel}`} style={{ textDecoration: 'none' }}>{s.contact.callButtonLabel}</a>
        </div>
      </div></section>
    )
  }

  if (view === 'admin') {
    page = (
      <div className="wrap admin-grid">
        <div>
          <h1>Admin</h1>
          <p>
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
        </section>

        <section className="admin-section"><h2>Home page</h2>
          <Field label="Eyebrow" value={s.home.eyebrow} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, eyebrow: v } }))} />
          <Field label="Headline" value={s.home.headline} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, headline: v } }))} />
          <Field label="Subhead" value={s.home.subhead} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, subhead: v } }))} />
          <Field label="Intro" value={s.home.intro} textarea onChange={(v) => set((p) => ({ ...p, home: { ...p.home, intro: v } }))} />
          <Field label="Gold line under the intro" value={s.home.goldLine} onChange={(v) => set((p) => ({ ...p, home: { ...p.home, goldLine: v } }))} />
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

        <div className="sticky-actions">
          <button className="btn" style={{ marginTop: 0 }} onClick={() => void handleSave()}>Save Changes</button>
          <button className="btn secondary" style={{ marginTop: 0 }} onClick={() => go('home')}>Preview Site</button>
          <button className="btn secondary" style={{ marginTop: 0 }} onClick={handleReset}>Reset to Original</button>
          {saveNote && <span className="saved-note">{saveNote}</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={vars}>
      <div className="admin-bar"><div className="wrap">
        {view !== 'admin'
          ? <span>Viewing the live site. <button className="linklike" onClick={() => go('admin')}>Open Admin</button> to edit fonts, colours, and every word.</span>
          : <span>Admin panel. <button className="linklike" onClick={() => go('home')}>Preview Site</button></span>}
      </div></div>
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
          <div><h3>{s.businessName}</h3><p>{s.tagline}</p></div>
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
