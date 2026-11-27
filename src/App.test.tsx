/**
 * Interaction test for the Admin font-size Size boxes.
 *
 * Regression test: the old Size boxes wrote every keystroke straight into
 * the whole site settings, re-rendering the entire Admin on each digit —
 * on iOS that kills typing (keyboard dismisses, focus is lost, digits
 * don't stick). The boxes now keep a local draft while typing and commit
 * on blur / Enter. This test types digit by digit into a real mounted
 * App and proves the digits land, focus survives, and the rendered text
 * actually changes size — without any real Supabase account.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import App from './App'
import { DEFAULT_SETTINGS } from './lib/settings'
import { supabase } from './lib/supabase'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { email: 'kebraphotography@gmail.com' } } },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithPassword: async () => ({ error: null }),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      signOut: async () => ({}),
      updateUser: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: async () => ({ error: null }),
    }),
  },
  isSupabaseConfigured: true,
}))

const SIZE_TITLE = 'Size of this text in pixels — leave blank to use the general size'

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = '#admin'
})

// This project imports test globals explicitly from 'vitest', so the
// library's automatic cleanup never registers: unmount each App by hand,
// or a previous test's App stays in the document and later queries hit
// the wrong App's DOM.
afterEach(() => {
  cleanup()
})

describe('Admin font-size Size boxes', () => {
  it('lets you type a per-text size digit by digit, keeps focus, and resizes the rendered text on blur', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    // Admin editor opens (mocked session is a signed-in admin).
    const label = await screen.findByText('Business name')
    const field = label.closest('.field')
    expect(field).not.toBeNull()
    const sizeBox = within(field as HTMLElement).getByTitle(SIZE_TITLE) as HTMLInputElement
    const brand = document.querySelector('.brand-name') as HTMLElement
    expect(brand).not.toBeNull()

    // No per-text size yet: the box is empty (placeholder 26) and the
    // business name renders at its 26px fallback.
    expect(sizeBox.value).toBe('')
    expect(brand.style.fontSize).toBe('26px')

    // Type digit by digit, exactly as on a phone keyboard. Typing must
    // NOT commit yet and must NOT lose focus.
    await user.click(sizeBox)
    await user.type(sizeBox, '2')
    expect(sizeBox.value).toBe('2')
    expect(document.activeElement).toBe(sizeBox)
    expect(brand.style.fontSize).toBe('26px')
    await user.type(sizeBox, '4')
    expect(sizeBox.value).toBe('24')
    expect(document.activeElement).toBe(sizeBox)
    expect(brand.style.fontSize).toBe('26px')

    // Leaving the box commits: the box keeps 24 and the rendered
    // business name really becomes 24px.
    fireEvent.blur(sizeBox)
    await waitFor(() => expect(sizeBox.value).toBe('24'))
    await waitFor(() => expect(brand.style.fontSize).toBe('24px'))

    // Clearing the box falls back to the general 26px size.
    await user.clear(sizeBox)
    fireEvent.blur(sizeBox)
    await waitFor(() => expect(brand.style.fontSize).toBe('26px'))
    expect(container.firstChild).not.toBeNull()
  })

  it('lets you type the general Heading size digit by digit and applies it on blur', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const label = await screen.findByText('Heading size (px)')
    const field = label.closest('.field')
    expect(field).not.toBeNull()
    const input = within(field as HTMLElement).getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('38')

    await user.click(input)
    await user.clear(input)
    await user.type(input, '5')
    expect(input.value).toBe('5')
    expect(document.activeElement).toBe(input)
    await user.type(input, '0')
    expect(input.value).toBe('50')
    expect(document.activeElement).toBe(input)

    fireEvent.blur(input)
    await waitFor(() => expect(input.value).toBe('50'))
    const root = container.firstChild as HTMLElement
    expect(root.style.getPropertyValue('--heading-size')).toBe('50px')
  })
})

/** The shipped stylesheet, read from disk: Vitest stubs CSS imports to
    an empty string, and jsdom has no layout engine, so the stylesheet
    text itself is what the suite can check for the grid/spacing rules. */
const cssText = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf-8')

/** Helpers for the audit tests below. */
const SETTINGS_KEY = 'ras-site-settings-v1'

function seedSettings(images: Record<string, unknown[]>) {
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, images: { home: [], services: [], about: [], contact: [], ...images } }),
  )
}

function goToAdmin() {
  // replaceState applies synchronously; assigning location.hash is queued
  // by jsdom, so a test that renders right after could still see #admin.
  window.history.replaceState(null, '', '/admin')
  window.dispatchEvent(new Event('hashchange'))
}

function goToHome() {
  window.history.replaceState(null, '', '/')
}

function imagesSection(name: string) {
  const heading = screen.getByText(name)
  const section = heading.closest('section')
  expect(section).not.toBeNull()
  return section as HTMLElement
}

/** A nav button in the header — the footer has buttons with the same
    labels, so an unscoped query would match two buttons. */
function navButton(name: string) {
  const nav = document.querySelector('.nav-row')
  expect(nav).not.toBeNull()
  return within(nav as HTMLElement).getByRole('button', { name })
}

describe('Image placement — images anywhere on every page', () => {
  it('renders an image added at the new after-why slot exactly between Why Rigor and How We Work', async () => {
    goToHome()
    seedSettings({
      home: [
        { id: 'img-why', url: 'https://example.com/why.jpg', alt: 'Why photo', caption: 'Why caption', position: 'after-why', size: 'medium' },
      ],
    })
    render(<App />)
    await screen.findByText('Why Rigor')
    const img = document.querySelector('img[src="https://example.com/why.jpg"]') as HTMLImageElement
    expect(img).not.toBeNull()
    const why = screen.getByText('Why Rigor')
    const process = screen.getByText('How We Work')
    // Document order: Why Rigor heading, then the image, then How We Work.
    expect(why.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(img.compareDocumentPosition(process) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers every section boundary in the Add picker and adds an image at the chosen slot', async () => {
    render(<App />)
    await screen.findByText('Business name')
    const homeSection = imagesSection('Home page images')
    const addSelect = homeSection.querySelector('.img-add select') as HTMLSelectElement
    expect(addSelect).not.toBeNull()
    const options = Array.from(addSelect.options).map((o) => o.value)
    expect(options).toContain('after-why')
    const servicesSection = imagesSection('Services page images')
    const svcAddSelect = servicesSection.querySelector('.img-add select') as HTMLSelectElement
    expect(Array.from(svcAddSelect.options).map((o) => o.value)).toEqual(
      expect.arrayContaining(['after-intro', 'after-service-1', 'after-service-2', 'after-service-3', 'after-details']),
    )
    const aboutAddSelect = imagesSection('About page images').querySelector('.img-add select') as HTMLSelectElement
    expect(Array.from(aboutAddSelect.options).map((o) => o.value)).toContain('after-intro')
    const contactAddSelect = imagesSection('Contact page images').querySelector('.img-add select') as HTMLSelectElement
    expect(Array.from(contactAddSelect.options).map((o) => o.value)).toContain('after-intro')

    // Add an image at After Why Rigor, by URL.
    fireEvent.change(addSelect, { target: { value: 'after-why' } })
    const urlInput = within(homeSection).getByPlaceholderText('Or paste an image link, then press Add') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(urlInput, 'https://example.com/a.jpg')
    const addBtn = within(homeSection.querySelector('.img-add') as HTMLElement).getByRole('button', { name: 'Add' })
    await user.click(addBtn)
    await waitFor(() => {
      const row = (document.querySelector('img[src="https://example.com/a.jpg"]') as HTMLElement)?.closest('.img-row')
      expect(row).not.toBeNull()
      expect(within(row as HTMLElement).getByDisplayValue('After Why Rigor')).not.toBeNull()
    })
    // The confirmation note shows under the Home editor only, not the others.
    expect(within(homeSection).getByText('Image added. Press Save Changes to make it live.')).not.toBeNull()
    expect(within(servicesSection).queryByText('Image added. Press Save Changes to make it live.')).toBeNull()
  })

  it('moves an image up, resizes it, floats it, and renders it floated at its slot', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    const homeSection = imagesSection('Home page images')
    const addSelect = homeSection.querySelector('.img-add select') as HTMLSelectElement
    fireEvent.change(addSelect, { target: { value: 'after-why' } })
    const urlInput = within(homeSection).getByPlaceholderText('Or paste an image link, then press Add') as HTMLInputElement
    const addBtn = within(homeSection.querySelector('.img-add') as HTMLElement).getByRole('button', { name: 'Add' })
    for (const url of ['https://example.com/a.jpg', 'https://example.com/b.jpg']) {
      await user.clear(urlInput)
      await user.type(urlInput, url)
      await user.click(addBtn)
      await waitFor(() => expect(document.querySelector(`img[src="${url}"]`)).not.toBeNull())
    }
    const thumbs = () => Array.from(homeSection.querySelectorAll('.img-thumb')).map((t) => (t as HTMLImageElement).src)
    expect(thumbs()).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg'])

    // Move the second image up — the touch-friendly fallback, no dragging.
    const rowB = (document.querySelector('img[src="https://example.com/b.jpg"]') as HTMLElement).closest('.img-row') as HTMLElement
    await user.click(within(rowB).getByRole('button', { name: /Move up/ }))
    await waitFor(() => expect(thumbs()).toEqual(['https://example.com/b.jpg', 'https://example.com/a.jpg']))

    // Resize the (now first) image to Large and float it left.
    // The row's labels are plain <label>s (no htmlFor), so the three
    // dropdowns are reached by role+order: Where, Size, Text wrap.
    const rowBNow = (document.querySelector('img[src="https://example.com/b.jpg"]') as HTMLElement).closest('.img-row') as HTMLElement
    const selects = within(rowBNow).getAllByRole('combobox')
    fireEvent.change(selects[1], { target: { value: 'large' } })
    fireEvent.change(selects[2], { target: { value: 'left' } })

    // Preview the site: B renders floated left, large, at the after-why slot.
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const figure = document.querySelector('figure.wrap-left.size-large') as HTMLElement
    expect(figure).not.toBeNull()
    expect(figure.querySelector('img[src="https://example.com/b.jpg"]')).not.toBeNull()
  })

  it('deletes an image when confirmed', async () => {
    const user = userEvent.setup()
    seedSettings({
      home: [{ id: 'img-del', url: 'https://example.com/del.jpg', alt: '', position: 'top', size: 'medium' }],
    })
    render(<App />)
    await screen.findByText('Business name')
    const thumb = document.querySelector('img[src="https://example.com/del.jpg"]') as HTMLElement
    expect(thumb).not.toBeNull()
    const row = thumb.closest('.img-row') as HTMLElement
    const origConfirm = window.confirm
    window.confirm = () => true
    try {
      await user.click(within(row).getByRole('button', { name: 'Delete image' }))
    } finally {
      window.confirm = origConfirm
    }
    await waitFor(() => expect(document.querySelector('img[src="https://example.com/del.jpg"]')).toBeNull())
  })
})

describe('Audit fixes — controls that did not work', () => {
  it('lets the service includes list hold more than one item', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    const label = screen.getByText('Service 1, includes (comma separated)')
    const field = label.closest('.field') as HTMLElement
    // Two textboxes live in this field: the text itself and its Size box.
    const input = within(field).getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Chatbots, Workflow Optimization')
    fireEvent.blur(input)
    // The list updates only after leaving the box (draft + commit).
    await user.click(navButton('Services'))
    await screen.findByText('Services That Move Your Business Forward')
    // Scope to Service 1's detail: Service 4 also lists Chatbots by default.
    const heading = screen.getByText('AI Consultation and Strategy')
    const article = heading.closest('article') as HTMLElement
    expect(within(article).getByText('Chatbots')).not.toBeNull()
    expect(within(article).getByText('Workflow Optimization')).not.toBeNull()
    expect(within(article).getAllByRole('listitem')).toHaveLength(2)
  })

  it('lets corner roundness and divider thickness be typed and applied on blur', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByText('Business name')
    const radiusLabel = screen.getByText('Corner roundness (px)')
    const radiusInput = within(radiusLabel.closest('.field') as HTMLElement).getByRole('textbox') as HTMLInputElement
    await user.clear(radiusInput)
    await user.type(radiusInput, '12')
    fireEvent.blur(radiusInput)
    const root = container.firstChild as HTMLElement
    await waitFor(() => expect(root.style.getPropertyValue('--radius')).toBe('12px'))
    const thickLabel = screen.getByText('Divider line thickness (px)')
    const thickInput = within(thickLabel.closest('.field') as HTMLElement).getByRole('textbox') as HTMLInputElement
    await user.clear(thickInput)
    await user.type(thickInput, '3')
    fireEvent.blur(thickInput)
    await waitFor(() => expect(root.style.getPropertyValue('--breaker-thickness')).toBe('3px'))
  })

  it('lets the See full details text, the logo letters and the step number size be changed', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    const detailsLabel = screen.getByText('See full details button')
    const detailsInput = within(detailsLabel.closest('.field') as HTMLElement).getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(detailsInput)
    await user.type(detailsInput, 'Learn more')
    const logoLabel = screen.getByText('Logo letters (the badge in the header)')
    const logoInput = within(logoLabel.closest('.field') as HTMLElement).getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(logoInput)
    await user.type(logoInput, 'RG')
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    // One button per service card, all four showing the new text.
    expect(screen.getAllByText('Learn more')).toHaveLength(4)
    expect(document.querySelector('.logo-mark')?.textContent).toBe('RG')
    goToAdmin()
    await screen.findByText('Business name')
    const stepLabel = screen.getByText('Step number size (px)')
    const stepInput = within(stepLabel.closest('.field') as HTMLElement).getByTitle(SIZE_TITLE) as HTMLInputElement
    await user.click(stepInput)
    await user.type(stepInput, '30')
    fireEvent.blur(stepInput)
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const stepNum = document.querySelector('.step-num') as HTMLElement
    expect(stepNum).not.toBeNull()
    await waitFor(() => expect(stepNum.style.fontSize).toBe('30px'))
  })

  it('lets the image caption size be changed and applies it to captions', async () => {
    const user = userEvent.setup()
    goToHome()
    seedSettings({
      home: [{ id: 'img-cap', url: 'https://example.com/cap.jpg', alt: 'Cap photo', caption: 'Caption here', position: 'after-how-we-work', size: 'medium' }],
    })
    render(<App />)
    await screen.findByText('Why Rigor')
    const caption = screen.getByText('Caption here') as HTMLElement
    expect(caption.style.fontSize).toBe('14px')
    goToAdmin()
    await screen.findByText('Business name')
    const capLabel = screen.getByText('Image caption size (px)')
    const capInput = within(capLabel.closest('.field') as HTMLElement).getByTitle(SIZE_TITLE) as HTMLInputElement
    await user.click(capInput)
    await user.type(capInput, '20')
    fireEvent.blur(capInput)
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    await waitFor(() => expect(screen.getByText('Caption here').style.fontSize).toBe('20px'))
  })

  it('sends the forgotten-PIN sign-in link back to /admin', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    // Sign out to reach the sign-in screen.
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    goToAdmin()
    await screen.findByText('Admin sign in')
    await user.click(screen.getByRole('button', { name: 'Forgot PIN? Send a sign-in link' }))
    await user.click(screen.getByRole('button', { name: 'Send me a sign-in link' }))
    const signInWithOtp = vi.mocked(supabase!.auth.signInWithOtp)
    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: 'kebraphotography@gmail.com',
        options: { emailRedirectTo: expect.stringContaining('/admin') },
      }),
    )
  })
})

describe('Redesign — hero buttons, stats strip, clean copy', () => {
  const COPYRIGHT = '© 2026 Rigor Advanced Solutions. All rights reserved.'

  it('renders the footer ONLY on Contact — Home, Services and About end after their last section, with no footer and no closing band', async () => {
    const user = userEvent.setup()
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')
    expect(document.querySelector('.site-footer')).toBeNull()
    expect(document.querySelector('.closing')).toBeNull()
    expect(screen.queryByText(COPYRIGHT)).toBeNull()

    await user.click(navButton('Services'))
    await screen.findByText('Services That Move Your Business Forward')
    expect(document.querySelector('.site-footer')).toBeNull()
    expect(document.querySelector('.closing')).toBeNull()
    expect(screen.queryByText(COPYRIGHT)).toBeNull()

    await user.click(navButton('About'))
    await screen.findByText('Our Values')
    expect(document.querySelector('.site-footer')).toBeNull()
    expect(document.querySelector('.closing')).toBeNull()
    expect(screen.queryByText(COPYRIGHT)).toBeNull()

    await user.click(navButton('Contact'))
    await screen.findByText('Book a Consultation')
    expect(document.querySelector('.site-footer')).not.toBeNull()
    expect(screen.getByText(COPYRIGHT)).not.toBeNull()
    expect(document.querySelector('.closing')).not.toBeNull()
    // Phone and location are blank by her order: the footer must not
    // show an empty tap-to-call link or an empty location line.
    expect(document.querySelector('.site-footer a[href^="tel:"]')).toBeNull()
  })

  it('renders the hero buttons and header button, and each one navigates where it should', async () => {
    const user = userEvent.setup()
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')

    await user.click(screen.getByRole('button', { name: 'Get Started' }))
    await screen.findByText('Services That Move Your Business Forward')

    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    await user.click(screen.getByRole('button', { name: 'Book a Demo' }))
    await screen.findByText('Book a Consultation')

    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    await user.click(screen.getByRole('button', { name: 'Talk to Us' }))
    await screen.findByText('Book a Consultation')
  })

  it('shows the real stats strip and clean copy with no stray commas', async () => {
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')

    const strip = document.querySelector('.stats-strip') as HTMLElement
    expect(strip).not.toBeNull()
    expect(strip.querySelectorAll('.stat')).toHaveLength(4)
    expect(within(strip).getByText('50+')).not.toBeNull()
    expect(within(strip).getByText('Projects Delivered')).not.toBeNull()
    expect(within(strip).getByText('98%')).not.toBeNull()
    expect(within(strip).getByText('Client Satisfaction')).not.toBeNull()
    expect(within(strip).getByText('10+')).not.toBeNull()
    expect(within(strip).getByText('Years of Experience')).not.toBeNull()
    expect(within(strip).getByText('24/7')).not.toBeNull()
    expect(within(strip).getByText('Support Available')).not.toBeNull()

    // The old dash rule's stray commas are gone everywhere.
    expect(screen.getByText('Unlock Growth. Automate. Innovate. Future Proof.')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Future, Proof')
    expect(document.body.textContent).not.toContain('AI, Powered')
    expect(document.body.textContent).not.toContain('four, step')
    await userEvent.setup().click(navButton('Services'))
    await screen.findByText('Services That Move Your Business Forward')
    expect(screen.getByText('AI Powered Automation')).not.toBeNull()
  })

  it('fixes the stray commas in a saved row, not just in the defaults', async () => {
    goToHome()
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        home: {
          ...DEFAULT_SETTINGS.home,
          subhead: 'Unlock Growth. Automate. Innovate. Future, Proof.',
          processIntro: 'A simple, four, step path from first conversation to a working AI system.',
        },
        services: {
          ...DEFAULT_SETTINGS.services,
          items: DEFAULT_SETTINGS.services.items.map((it) =>
            it.name === 'AI Powered Automation' ? { ...it, name: 'AI, Powered Automation' } : it,
          ),
        },
      }),
    )
    render(<App />)
    await screen.findByText('Why Rigor')
    expect(screen.getByText('Unlock Growth. Automate. Innovate. Future Proof.')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Future, Proof')
  })

  it('has Admin fields for the hero buttons, the header button and every stat — and editing a stat shows on the site', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    expect(screen.getByText('Hero button, main (Get Started)')).not.toBeNull()
    expect(screen.getByText('Hero button, second (Book a Demo)')).not.toBeNull()
    expect(screen.getByText('Header button (Talk to Us)')).not.toBeNull()
    expect(screen.getByText('Stat 1, number')).not.toBeNull()
    expect(screen.getByText('Stat 1, label')).not.toBeNull()
    expect(screen.getByText('Stat 4, number')).not.toBeNull()

    const statLabel = screen.getByText('Stat 1, number')
    const statInput = within(statLabel.closest('.field') as HTMLElement).getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(statInput)
    await user.type(statInput, '75+')
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const strip = document.querySelector('.stats-strip') as HTMLElement
    await waitFor(() => expect(within(strip).getByText('75+')).not.toBeNull())
  })
})

describe('Follow-up fixes — business email and card spacing', () => {
  const EMAIL = 'info@rigoradvancedsolutions.com'

  it('shows the business email on the Contact Email Us card and in the footer', async () => {
    const user = userEvent.setup()
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')
    await user.click(navButton('Contact'))
    await screen.findByText('Book a Consultation')

    // One mailto link on the Email Us card, one in the footer.
    const links = screen.getAllByText(EMAIL)
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.closest('a')?.getAttribute('href')).toBe(`mailto:${EMAIL}`)
    }
    // The Email Us card sits between the Call Us and Location cards.
    const emailHeading = screen.getByText('Email Us')
    const card = emailHeading.closest('.info-card') as HTMLElement
    expect(within(card).getByText(EMAIL)).not.toBeNull()
    const footer = document.querySelector('.site-footer') as HTMLElement
    expect(within(footer).getByText(EMAIL)).not.toBeNull()
    // Phone and location stay blank by her order: still no tel: link.
    expect(document.querySelector('.site-footer a[href^="tel:"]')).toBeNull()
  })

  it('shows no email line anywhere when the business email is blanked', async () => {
    const user = userEvent.setup()
    goToHome()
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, businessEmail: '' }))
    render(<App />)
    await screen.findByText('Why Rigor')
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(document.body.textContent).not.toContain(EMAIL)

    // The Email Us card itself still renders (title + note), like the
    // phone card does while the phone is blank — only the email line hides.
    await user.click(navButton('Contact'))
    await screen.findByText('Book a Consultation')
    expect(screen.getByText('Email Us')).not.toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('has an editable Business email field in Admin and the new address shows on the site', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    const label = screen.getByText('Business email')
    const input = within(label.closest('.field') as HTMLElement).getAllByRole('textbox')[0] as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'hello@rigoradvancedsolutions.com')
    await user.click(navButton('Contact'))
    await screen.findByText('Book a Consultation')
    const links = screen.getAllByText('hello@rigoradvancedsolutions.com')
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const link of links) {
      expect(link.closest('a')?.getAttribute('href')).toBe('mailto:hello@rigoradvancedsolutions.com')
    }
  })

  it('does not stretch the card grids and keeps the footer close to the last content', async () => {
    const user = userEvent.setup()
    // jsdom has no layout engine, so the shipped stylesheet itself is
    // what the suite can check: read it as text and assert the rules.
    const rules = (selector: string) => {
      const re = new RegExp(`\\${selector}\\s*\\{[^}]*\\}`, 'g')
      return Array.from(cssText.matchAll(re)).map((m) => m[0])
    }
    const has = (selector: string, decl: string) => rules(selector).some((r) => r.includes(decl))
    expect(has('.cards', 'align-items: start')).toBe(true)
    expect(has('.steps', 'align-items: start')).toBe(true)
    expect(has('.two-col', 'align-items: start')).toBe(true)
    expect(has('.info-cards', 'repeat(3, 1fr)')).toBe(true)
    expect(has('.info-cards', 'align-items: start')).toBe(true)
    expect(has('.site-footer', 'margin-top: 28px')).toBe(true)
    expect(has('.closing', 'margin: 28px 0 0')).toBe(true)

    // The Services page no longer carries the extra 84px bottom padding.
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')
    await user.click(navButton('Services'))
    await screen.findByText('Services That Move Your Business Forward')
    const section = document.querySelector('section.section') as HTMLElement
    expect(section).not.toBeNull()
    expect(section.style.paddingBottom).toBe('')
  })
})

describe('Footer only on Contact + adjustable image box size', () => {
  const WIDTH_TITLE = 'Exact box width in pixels — leave blank to use the Size preset above'
  const HEIGHT_TITLE = "Exact box height in pixels — leave blank to keep the photo's own height"

  it('has Width and Height boxes for every image on every page, beside the Size preset, plus all the other editor controls', async () => {
    seedSettings({
      home: [{ id: 'img-h', url: 'https://example.com/h.jpg', alt: 'Home', position: 'after-why', size: 'medium' }],
      services: [{ id: 'img-s', url: 'https://example.com/s.jpg', alt: 'Services', position: 'after-intro', size: 'medium' }],
      about: [{ id: 'img-a', url: 'https://example.com/a.jpg', alt: 'About', position: 'after-intro', size: 'medium' }],
      contact: [{ id: 'img-c', url: 'https://example.com/c.jpg', alt: 'Contact', position: 'after-intro', size: 'medium' }],
    })
    render(<App />)
    await screen.findByText('Business name')

    for (const [sectionName, url] of [
      ['Home page images', 'https://example.com/h.jpg'],
      ['Services page images', 'https://example.com/s.jpg'],
      ['About page images', 'https://example.com/a.jpg'],
      ['Contact page images', 'https://example.com/c.jpg'],
    ] as const) {
      const section = imagesSection(sectionName)
      const row = (document.querySelector(`img[src="${url}"]`) as HTMLElement).closest('.img-row') as HTMLElement
      expect(row).not.toBeNull()
      // The three dropdowns: Where on the page, Size, Text wrap.
      expect(within(row).getAllByRole('combobox')).toHaveLength(3)
      // Width and Height boxes, right beside the Size preset.
      expect(within(row).getByTitle(WIDTH_TITLE)).not.toBeNull()
      expect(within(row).getByTitle(HEIGHT_TITLE)).not.toBeNull()
      // Move up / Move down (the touch way to reorder), Replace, Delete.
      expect(within(row).getByRole('button', { name: /Move up/ })).not.toBeNull()
      expect(within(row).getByRole('button', { name: /Move down/ })).not.toBeNull()
      expect(within(row).getByText('Replace photo')).not.toBeNull()
      expect(within(row).getByRole('button', { name: 'Delete image' })).not.toBeNull()
      expect(section).not.toBeNull()
    }
  })

  it('typing a Width and Height in Admin changes the rendered image box, and clearing them falls back to the preset', async () => {
    const user = userEvent.setup()
    seedSettings({
      home: [{ id: 'img-box', url: 'https://example.com/box.jpg', alt: 'Box photo', position: 'after-why', size: 'medium' }],
    })
    render(<App />)
    await screen.findByText('Business name')
    const row = (document.querySelector('img[src="https://example.com/box.jpg"]') as HTMLElement).closest('.img-row') as HTMLElement
    const widthInput = within(row).getByTitle(WIDTH_TITLE) as HTMLInputElement
    const heightInput = within(row).getByTitle(HEIGHT_TITLE) as HTMLInputElement
    // The Width box hints at the preset size (medium = 480) while empty.
    expect(widthInput.value).toBe('')
    expect(widthInput.placeholder).toBe('480')

    // Type digit by digit like on a phone: nothing commits until blur.
    await user.click(widthInput)
    await user.type(widthInput, '300')
    expect(widthInput.value).toBe('300')
    expect(document.activeElement).toBe(widthInput)
    fireEvent.blur(widthInput)
    await waitFor(() => expect(widthInput.value).toBe('300'))
    await user.click(heightInput)
    await user.type(heightInput, '200')
    fireEvent.blur(heightInput)
    await waitFor(() => expect(heightInput.value).toBe('200'))

    // Preview the site: the image box is now exactly 300 x 200.
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const img = document.querySelector('img[src="https://example.com/box.jpg"]') as HTMLImageElement
    expect(img).not.toBeNull()
    const figure = img.closest('figure') as HTMLElement
    expect(figure.style.maxWidth).toBe('min(300px, 100%)')
    expect(img.style.height).toBe('200px')
    expect(img.style.objectFit).toBe('cover')

    // Clearing both boxes falls back to the Size preset (medium = 480).
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    // Go back to Admin via the URL, then clear the boxes.
    goToAdmin()
    render(<App />)
    await screen.findByText('Business name')
    const row2 = (document.querySelector('img[src="https://example.com/box.jpg"]') as HTMLElement).closest('.img-row') as HTMLElement
    const widthInput2 = within(row2).getByTitle(WIDTH_TITLE) as HTMLInputElement
    await user.clear(widthInput2)
    fireEvent.blur(widthInput2)
    await waitFor(() => expect(widthInput2.value).toBe(''))
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const img2 = document.querySelector('img[src="https://example.com/box.jpg"]') as HTMLImageElement
    const figure2 = img2.closest('figure') as HTMLElement
    expect(figure2.style.maxWidth).toBe('')
    expect(figure2.className).toContain('size-medium')
  })

  it('Move up swaps two images on the public page itself', async () => {
    const user = userEvent.setup()
    seedSettings({
      home: [
        { id: 'img-1', url: 'https://example.com/one.jpg', alt: 'One', position: 'after-why', size: 'medium' },
        { id: 'img-2', url: 'https://example.com/two.jpg', alt: 'Two', position: 'after-why', size: 'medium' },
      ],
    })
    render(<App />)
    await screen.findByText('Business name')
    const row2 = (document.querySelector('img[src="https://example.com/two.jpg"]') as HTMLElement).closest('.img-row') as HTMLElement
    await user.click(within(row2).getByRole('button', { name: /Move up/ }))
    await waitFor(() => {
      const thumbs = Array.from(document.querySelectorAll('.img-thumb')).map((t) => (t as HTMLImageElement).src)
      expect(thumbs).toEqual(['https://example.com/two.jpg', 'https://example.com/one.jpg'])
    })

    // The swap shows on the live page too, not just in the Admin list.
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    const shown = Array.from(document.querySelectorAll('.slot-images img')).map((i) => (i as HTMLImageElement).src)
    expect(shown).toEqual(['https://example.com/two.jpg', 'https://example.com/one.jpg'])
  })
})

describe('Mobile / Desktop view switcher', () => {
  const VIEW_MODE_KEY = 'ras-view-mode'
  const htmlText = readFileSync(join(process.cwd(), 'index.html'), 'utf-8')

  it('has the viewport meta tag in index.html, so a phone gets the responsive layout, not a scaled desktop page', () => {
    expect(htmlText).toContain('<meta name="viewport" content="width=device-width, initial-scale=1')
  })

  it('renders the Mobile / Desktop switcher in the header, and choosing Desktop sets the desktop viewport and remembers it', async () => {
    const user = userEvent.setup()
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')

    const mobileBtn = screen.getByRole('button', { name: 'Mobile' })
    const desktopBtn = screen.getByRole('button', { name: 'Desktop' })
    expect(mobileBtn).not.toBeNull()
    expect(desktopBtn).not.toBeNull()
    // Default (nothing saved) is Auto: normal viewport, no forced mode.
    expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBeNull()
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=device-width, initial-scale=1')
    expect(document.querySelector('.app-root')?.className).toContain('view-auto')

    await user.click(desktopBtn)
    await waitFor(() => expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('desktop'))
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=1024')
    expect(document.querySelector('.app-root')?.className).toContain('view-desktop')
    expect(desktopBtn.getAttribute('aria-pressed')).toBe('true')

    // Tapping the active button again goes back to the automatic view.
    await user.click(desktopBtn)
    await waitFor(() => expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBeNull())
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=device-width, initial-scale=1')
    expect(document.querySelector('.app-root')?.className).toContain('view-auto')
  })

  it('choosing Mobile constrains the site to a phone-width column and remembers it', async () => {
    const user = userEvent.setup()
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')

    await user.click(screen.getByRole('button', { name: 'Mobile' }))
    await waitFor(() => expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('mobile'))
    expect(document.querySelector('.app-root')?.className).toContain('view-mobile')
    // The forced phone layout is in the shipped stylesheet: a centred
    // 480px column with the same single-column grids a real phone gets.
    expect(cssText).toContain('.app-root.view-mobile .wrap { max-width: 480px; }')
    expect(cssText).toContain('.app-root.view-mobile .cards, .app-root.view-mobile .steps { grid-template-columns: 1fr; }')
    expect(cssText).toContain('.app-root.view-mobile .two-col, .app-root.view-mobile .info-cards, .app-root.view-mobile .site-footer .cols { grid-template-columns: 1fr; }')
  })

  it('remembers a saved choice across a fresh load', async () => {
    window.localStorage.setItem(VIEW_MODE_KEY, 'desktop')
    goToHome()
    render(<App />)
    await screen.findByText('Why Rigor')
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=1024')
    expect(document.querySelector('.app-root')?.className).toContain('view-desktop')
    expect(screen.getByRole('button', { name: 'Desktop' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('has Admin fields for the switcher labels, and editing one renames the header button', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Business name')
    expect(screen.getByText('View switcher: Mobile button')).not.toBeNull()
    expect(screen.getByText('View switcher: Desktop button')).not.toBeNull()

    const label = screen.getByText('View switcher: Desktop button')
    const input = within(label.closest('.field') as HTMLElement).getByRole('textbox') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'PC view')
    await user.click(navButton('Home'))
    await screen.findByText('Why Rigor')
    expect(screen.getByRole('button', { name: 'PC view' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Desktop' })).toBeNull()
  })

  it('keeps the 390px phone layout to one column with 44px tap targets and no horizontal scroll', () => {
    // jsdom has no layout engine, so the shipped stylesheet is what the
    // suite can check: every multi-column grid collapses at phone widths.
    expect(cssText).toContain('@media (max-width: 560px) { .cards { grid-template-columns: 1fr; } }')
    expect(cssText).toContain('@media (max-width: 560px) { .steps { grid-template-columns: 1fr; } }')
    expect(cssText).toContain('@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }')
    expect(cssText).toContain('@media (max-width: 700px) { .info-cards { grid-template-columns: 1fr; } }')
    expect(cssText).toContain('@media (max-width: 700px) { .site-footer .cols { grid-template-columns: 1fr; } }')
    expect(cssText).toContain('@media (max-width: 700px) {')
    expect(cssText).toContain('html, body { margin: 0; padding: 0; overflow-x: clip; }')
    // Tap targets: nav buttons 44px, main buttons 52px, switcher 44px,
    // footer links 44px.
    expect(cssText).toContain('.nav-row button { background: transparent; border: 1px solid transparent; color: var(--body); font-size: 16px; font-weight: 600; padding: 10px 16px; min-height: 44px;')
    expect(cssText).toContain('.view-switch button { background: transparent; border: none; color: var(--body); font-size: 13px; font-weight: 700; padding: 10px 14px; min-height: 44px;')
    expect(cssText).toContain('.site-footer .linklike { padding: 12px 0; min-height: 44px; }')
  })
})
