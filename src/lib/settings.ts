export interface ServiceItem {
  name: string
  short: string
  detail: string
  whoFor: string
  includes: string[]
}

export interface WhyItem {
  title: string
  text: string
}

export interface ProcessStep {
  title: string
  text: string
}

export type ImageSize = 'small' | 'medium' | 'large' | 'full'

export const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'full', label: 'Full width' },
]

/** How the page text flows around an image: not at all, or floated to one side. */
export type ImageWrap = 'none' | 'left' | 'right'

export const IMAGE_WRAPS: { value: ImageWrap; label: string }[] = [
  { value: 'none', label: 'None — text above and below' },
  { value: 'left', label: 'Float left — text flows on the right' },
  { value: 'right', label: 'Float right — text flows on the left' },
]

export interface SiteImage {
  id: string
  url: string
  alt: string
  caption?: string
  /** Placement slot on the page. Images with no position render at the page's previous fixed spot. */
  position?: string
  size?: ImageSize
  /** Text wrap: 'none' (default), or float the image left/right so text flows around it. */
  wrap?: ImageWrap
}

/** The divider lines that break up the page. */
export interface BreakerSettings {
  /** Colour of the divider lines under the header, above the footer, and between sections. */
  color: string
  /** Thickness of those divider lines, in px. */
  thickness: number
  /** Show the line under the header. */
  showHeader: boolean
  /** Show the line above the footer. */
  showFooter: boolean
  /** Show the gold line under the Home intro. */
  showGoldLine: boolean
  /** Show divider lines between the sections on the Home page. */
  homeSections: boolean
  /** Show divider lines between the service details on the Services page. */
  servicesSections: boolean
  /** Show divider lines between the blocks on the About page. */
  aboutSections: boolean
  /** Show divider lines between the blocks on the Contact page. */
  contactSections: boolean
}

export type PageKey = 'home' | 'services' | 'about' | 'contact'

/** Where an image can sit on each page. `defaultSlot` is the page's previous fixed gallery spot. */
export const PLACEMENT_SLOTS: Record<PageKey, { value: string; label: string }[]> = {
  home: [
    { value: 'top', label: 'Top of the page, above the hero' },
    { value: 'hero', label: 'Beside the hero text (only when the globe is blank)' },
    { value: 'after-services', label: 'After the services' },
    { value: 'after-how-we-work', label: 'After How We Work' },
    { value: 'bottom', label: 'Bottom of the page' },
  ],
  services: [
    { value: 'top', label: 'Top of the page' },
    { value: 'after-details', label: 'After the service details' },
    { value: 'bottom', label: 'Bottom of the page' },
  ],
  about: [
    { value: 'top', label: 'Top of the page' },
    { value: 'after-story', label: 'After Our Mission and Our Promise' },
    { value: 'after-values', label: 'After Our Values' },
    { value: 'bottom', label: 'Bottom of the page' },
  ],
  contact: [
    { value: 'top', label: 'Top of the page' },
    { value: 'after-info', label: 'After the phone and location cards' },
    { value: 'after-form', label: 'After the booking form' },
    { value: 'bottom', label: 'Bottom of the page, after the closing band' },
  ],
}

export const DEFAULT_SLOT: Record<PageKey, string> = {
  home: 'after-how-we-work',
  services: 'after-details',
  about: 'after-values',
  contact: 'after-form',
}

export interface SiteSettings {
  businessName: string
  tagline: string
  phoneDisplay: string
  phoneTel: string
  location: string
  colors: {
    background: string
    surface: string
    accent: string
    heading: string
    body: string
    muted: string
    border: string
    buttonText: string
    gold: string
  }
  fonts: { headingFont: string; bodyFont: string; radius: number; headingSize: number; bodySize: number }
  /** Per-text sizes in px, keyed like 'home.headline' or 'services.items.0.name'.
      A key set here overrides the general heading/body size for that one text only;
      texts with no entry fall back to the general sizes. */
  fontSizes: Record<string, number>
  nav: { home: string; services: string; about: string; contact: string; admin: string }
  home: {
    eyebrow: string
    headline: string
    subhead: string
    intro: string
    goldLine: string
    servicesLabel: string
    whyTitle: string
    whyIntro: string
    whyItems: WhyItem[]
    processTitle: string
    processIntro: string
    processSteps: ProcessStep[]
  }
  services: { label: string; title: string; intro: string; whoHeading: string; includesHeading: string; items: ServiceItem[] }
  about: {
    label: string
    title: string
    intro: string
    missionTitle: string
    missionText: string
    promiseTitle: string
    promiseText: string
    valuesTitle: string
    values: WhyItem[]
  }
  contact: {
    label: string
    title: string
    intro: string
    phoneCardTitle: string
    phoneCardNote: string
    locationCardTitle: string
    locationCardNote: string
    formTitle: string
    nameLabel: string
    emailLabel: string
    phoneLabel: string
    messageLabel: string
    submitLabel: string
    thankYou: string
    closingTitle: string
    closingText: string
    callButtonLabel: string
  }
  footer: { exploreTitle: string; contactTitle: string; copyright: string }
  heroImage: string
  images: Record<PageKey, SiteImage[]>
  breakers: BreakerSettings
  /** Admin sign-in. Only a flag — the PIN itself is never stored here. */
  admin: { pinSet: boolean }
}

export const FONT_CHOICES = [
  'Outfit',
  'Plus Jakarta Sans',
  'Inter',
  'Manrope',
  'Sora',
  'Poppins',
  'Montserrat',
  'Nunito Sans',
  'Work Sans',
  'DM Sans',
]

export const DEFAULT_SETTINGS: SiteSettings = {
  businessName: 'Rigor Advanced Solutions',
  tagline: "Empowering Tomorrow's Leaders With AI Technology",
  phoneDisplay: '',
  phoneTel: '',
  location: '',
  colors: {
    background: '#040b18',
    surface: '#08182e',
    accent: '#93e3fd',
    heading: '#00a1d8',
    body: '#00a1d8',
    muted: '#93e3fd',
    border: '#0e5f8f',
    buttonText: '#04101f',
    gold: '#669d34',
  },
  fonts: { headingFont: 'Montserrat', bodyFont: 'Plus Jakarta Sans', radius: 9, headingSize: 38, bodySize: 16 },
  fontSizes: {},
  nav: { home: 'Home', services: 'Services', about: 'About', contact: 'Contact', admin: 'Admin' },
  home: {
    eyebrow: 'RIGOR ADVANCED SOLUTIONS',
    headline: 'Revolutionize Your Business With Intelligent Solutions',
    subhead: 'Unlock Growth. Automate. Innovate. Future, Proof.',
    intro:
      'Rigor Advanced Solutions helps ambitious businesses work smarter with artificial intelligence. We design practical AI systems that save time, cut busywork, and turn your data into decisions you can act on, today, not someday.',
    goldLine: 'Practical AI, built for real businesses, delivered with care.',
    servicesLabel: 'What We Do',
    whyTitle: 'Why Rigor',
    whyIntro: 'We build AI that fits your business, not the other way around.',
    whyItems: [
      { title: 'Built Around You', text: 'Every solution starts with how your team actually works, so the technology fits your workflow, your data, and your goals.' },
      { title: 'Practical, Not Theoretical', text: 'No jargon, no science projects. We ship working systems that save hours, reduce errors, and pay for themselves.' },
      { title: 'Clear, Honest Guidance', text: 'We explain what AI can and cannot do for you, in plain language, and we only recommend what will genuinely help.' },
      { title: 'Support That Stays', text: 'We stay with you after launch, tuning, improving, and supporting the systems we build, as your business grows.' },
    ],
    processTitle: 'How We Work',
    processIntro: 'A simple, four, step path from first conversation to a working AI system.',
    processSteps: [
      { title: 'Discover', text: 'We listen first. We map your goals, your processes, and where AI can make the biggest difference.' },
      { title: 'Design', text: 'We design a tailored roadmap, with clear scope, clear pricing, and clear outcomes before any building starts.' },
      { title: 'Build', text: 'We build, test, and refine your solution with you, in small steps, so you always see progress.' },
      { title: 'Launch and Support', text: 'We launch, train your team, and keep improving the system as your business changes.' },
    ],
  },
  services: {
    label: 'Our Services',
    title: 'Services That Move Your Business Forward',
    intro: 'Four focused services, one goal: intelligent systems that help your business grow, work faster, and serve customers better.',
    whoHeading: "Who it's for",
    includesHeading: 'What it includes',
    items: [
      {
        name: 'AI Consultation and Strategy',
        short: 'Tailored AI roadmaps to align AI with your business goals and drive results.',
        detail:
          'We start with your business, not with technology. Together we find the highest value places for AI in your work, then build a clear, practical roadmap to get there, with honest advice on cost, timing, and expected return.',
        whoFor: 'Business owners and leaders who know AI matters, and want a clear plan before they invest.',
        includes: ['Tailored Roadmaps', 'Innovation Consulting', 'AI Readiness Review', 'Return on Investment Planning'],
      },
      {
        name: 'Custom AI Development',
        short: 'Bespoke AI solutions engineered for your unique workflows and data.',
        detail:
          'Off the shelf tools rarely fit perfectly. We design and build custom AI systems around your exact processes, your data, and your customers, so the solution works the way you work.',
        whoFor: 'Teams with specific workflows, data, or customer needs that generic software does not solve.',
        includes: ['Predictive Models', 'Automation Systems', 'Bespoke Solutions', 'Custom Integrations'],
      },
      {
        name: 'Data Analytics and Insights',
        short: 'Transform raw data into actionable insights with advanced analytics.',
        detail:
          'Your business already holds the answers, in sales, operations, and customer data. We clean, connect, and analyse that data, then present it as clear insights and dashboards you can actually use to decide.',
        whoFor: 'Businesses sitting on data they cannot easily read, and leaders who want decisions backed by evidence.',
        includes: ['Big Data Processing', 'Actionable Intelligence', 'Machine Learning', 'Clear Dashboards and Reports'],
      },
      {
        name: 'AI, Powered Automation',
        short: 'Automate repetitive processes and boost efficiency with intelligent automation.',
        detail:
          'Repetitive tasks eat your team’s time and energy. We automate the routine work, from intake and follow ups to reporting and customer replies, so your people can focus on the work only people can do.',
        whoFor: 'Busy teams drowning in manual, repetitive work, and businesses ready to scale without adding headcount.',
        includes: ['Workflow Optimization', 'Chatbots', 'Enhanced Efficiency', 'Smart Document Handling'],
      },
    ],
  },
  about: {
    label: 'About Us',
    title: 'Intelligent Solutions, Built With Purpose',
    intro:
      'Rigor Advanced Solutions was founded on a simple belief: powerful AI should be practical, honest, and within reach for real businesses, not only for big tech companies.',
    missionTitle: 'Our Mission',
    missionText:
      'To help tomorrow’s leaders use AI with confidence. We make intelligent technology understandable, affordable, and genuinely useful, so the businesses we work with can grow faster, serve customers better, and stay ahead of change.',
    promiseTitle: 'Our Promise',
    promiseText:
      'We will always be clear about what we can do, what it will cost, and what you will get. No hype, no hidden complexity, no solution you do not need. If AI is not the right answer for a problem, we will tell you, and help you find the right one.',
    valuesTitle: 'Our Values',
    values: [
      { title: 'Clarity', text: 'Plain language, honest timelines, and no surprises.' },
      { title: 'Craft', text: 'Careful, well tested work we are proud to put our name on.' },
      { title: 'Partnership', text: 'We succeed when our clients succeed, and we act like it.' },
    ],
  },
  contact: {
    label: 'Contact Us',
    title: 'Start a Conversation',
    intro: 'Tell us what you are working on, or book a consultation to explore what AI could do for your business. We reply personally, usually within one business day.',
    phoneCardTitle: 'Call Us',
    phoneCardNote: 'Prefer to talk? Call, and we will walk through your idea together.',
    locationCardTitle: 'Location',
    locationCardNote: 'Serving businesses in Denver, Colorado, and beyond.',
    formTitle: 'Book a Consultation',
    nameLabel: 'Your Name',
    emailLabel: 'Email Address',
    phoneLabel: 'Phone Number',
    messageLabel: 'How can we help?',
    submitLabel: 'Submit and Call Us',
    thankYou: 'Thank you, your message is ready. Tap the call button to reach us now, and we will reply to your message as well.',
    closingTitle: "Empowering Tomorrow's Leaders With AI Technology",
    closingText: 'Ready to see what intelligent solutions could do for your business? Get in touch, and let us build something great together.',
    callButtonLabel: 'Call Us',
  },
  footer: {
    exploreTitle: 'Explore',
    contactTitle: 'Contact',
    copyright: '© 2026 Rigor Advanced Solutions. All rights reserved.',
  },
  heroImage: '/globe.png',
  images: { home: [], services: [], about: [], contact: [] },
  breakers: { color: '#0e5f8f', thickness: 1, showHeader: true, showFooter: true, showGoldLine: true, homeSections: false, servicesSections: false, aboutSections: false, contactSections: false },
  admin: { pinSet: false },
}
