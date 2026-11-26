import { DEFAULT_SETTINGS, DEFAULT_SLOT, type PageKey, type SiteImage, type SiteSettings } from './settings'
import { supabase } from './supabase'

const LOCAL_KEY = 'ras-site-settings-v1'

/** Fill in placement + size for images saved before those fields existed. */
function normalizeImages(page: PageKey, list: unknown): SiteImage[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((im): im is SiteImage => !!im && typeof (im as SiteImage).url === 'string')
    .map((im) => ({
      ...im,
      position: im.position || DEFAULT_SLOT[page],
      size: im.size || 'medium',
      wrap: im.wrap || 'none',
    }))
}

function mergeWithDefaults(raw: unknown): SiteSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
  // Deep merge so older saved settings still get any new fields.
  return {
    ...DEFAULT_SETTINGS,
    ...(raw as Partial<SiteSettings>),
    colors: { ...DEFAULT_SETTINGS.colors, ...((raw as SiteSettings).colors ?? {}) },
    fonts: { ...DEFAULT_SETTINGS.fonts, ...((raw as SiteSettings).fonts ?? {}) },
    fontSizes: { ...DEFAULT_SETTINGS.fontSizes, ...((raw as SiteSettings).fontSizes ?? {}) },
    nav: { ...DEFAULT_SETTINGS.nav, ...((raw as SiteSettings).nav ?? {}) },
    home: {
      ...DEFAULT_SETTINGS.home,
      ...((raw as SiteSettings).home ?? {}),
      whyItems: ((raw as SiteSettings).home?.whyItems ?? DEFAULT_SETTINGS.home.whyItems) as SiteSettings['home']['whyItems'],
      processSteps: ((raw as SiteSettings).home?.processSteps ?? DEFAULT_SETTINGS.home.processSteps) as SiteSettings['home']['processSteps'],
    },
    services: { ...DEFAULT_SETTINGS.services, ...((raw as SiteSettings).services ?? {}) },
    about: {
      ...DEFAULT_SETTINGS.about,
      ...((raw as SiteSettings).about ?? {}),
      values: ((raw as SiteSettings).about?.values ?? DEFAULT_SETTINGS.about.values) as SiteSettings['about']['values'],
    },
    contact: { ...DEFAULT_SETTINGS.contact, ...((raw as SiteSettings).contact ?? {}) },
    footer: { ...DEFAULT_SETTINGS.footer, ...((raw as SiteSettings).footer ?? {}) },
    breakers: { ...DEFAULT_SETTINGS.breakers, ...((raw as SiteSettings).breakers ?? {}) },
    admin: { ...DEFAULT_SETTINGS.admin, ...((raw as SiteSettings).admin ?? {}) },
    images: {
      home: normalizeImages('home', (raw as SiteSettings).images?.home),
      services: normalizeImages('services', (raw as SiteSettings).images?.services),
      about: normalizeImages('about', (raw as SiteSettings).images?.about),
      contact: normalizeImages('contact', (raw as SiteSettings).images?.contact),
    },
  }
}

export async function loadSettings(): Promise<SiteSettings> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('site_settings').select('settings').eq('id', 1).maybeSingle()
      if (!error && data?.settings) return mergeWithDefaults(data.settings)
    } catch {
      // fall through to localStorage
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return mergeWithDefaults(JSON.parse(raw))
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

export async function saveSettings(settings: SiteSettings): Promise<'supabase' | 'local'> {
  if (supabase) {
    try {
      const { error } = await supabase.from('site_settings').upsert({ id: 1, settings }, { onConflict: 'id' })
      if (!error) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(settings))
        return 'supabase'
      }
    } catch {
      // fall through to localStorage
    }
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(settings))
  return 'local'
}
