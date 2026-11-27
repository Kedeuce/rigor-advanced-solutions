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
    await user.click(screen.getByRole('button', { name: 'Home' }))
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
    await user.click(screen.getByRole('button', { name: 'Services' }))
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
    await user.click(screen.getByRole('button', { name: 'Home' }))
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
    await user.click(screen.getByRole('button', { name: 'Home' }))
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
    await user.click(screen.getByRole('button', { name: 'Home' }))
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
