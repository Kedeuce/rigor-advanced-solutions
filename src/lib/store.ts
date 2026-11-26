import { DEFAULT_SETTINGS, type SiteSettings } from './settings'
import { supabase } from './supabase'

const LOCAL_KEY = 'ras-site-settings-v1'

function mergeWithDefaults(raw: unknown): SiteSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
  // Deep merge so older saved settings still get any new fields.
  return {
    ...DEFAULT_SETTINGS,
    ...(raw as Partial<SiteSettings>),
    colors: { ...DEFAULT_SETTINGS.colors, ...((raw as SiteSettings).colors ?? {}) },
    fonts: { ...DEFAULT_SETTINGS.fonts, ...((raw as SiteSettings).fonts ?? {}) },
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
    images: {
      home: ((raw as SiteSettings).images?.home ?? DEFAULT_SETTINGS.images.home) as SiteSettings['images']['home'],
      services: ((raw as SiteSettings).images?.services ?? DEFAULT_SETTINGS.images.services) as SiteSettings['images']['services'],
      about: ((raw as SiteSettings).images?.about ?? DEFAULT_SETTINGS.images.about) as SiteSettings['images']['about'],
      contact: ((raw as SiteSettings).images?.contact ?? DEFAULT_SETTINGS.images.contact) as SiteSettings['images']['contact'],
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
