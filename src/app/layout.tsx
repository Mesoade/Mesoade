import type { Metadata, Viewport } from 'next'
import {
  DM_Mono,
  Fraunces,
  Inter,
  Playfair_Display,
  Work_Sans,
} from 'next/font/google'
import { BRAND_NAME, BRAND_TAGLINE, env } from '@/lib/env'
import './globals.css'

/**
 * Typography carries the entire visual identity here -- there is no
 * photography or illustration anywhere on the marketing sections -- so the
 * families are chosen rather than defaulted, and all three are self-hosted at
 * build time: no runtime request to Google, no layout shift.
 *
 *   Fraunces  -- an old-style serif with SOFT and WONK axes drawn expressly to
 *                feel handmade rather than neutral. At a high optical size it
 *                gets the carved weight the hero needs.
 *   Work Sans -- humanist proportions and open apertures, sharing a
 *                calligraphic skeleton with Fraunces so the pair harmonises.
 *                Chosen over Inter, which is the sound of every SaaS product.
 *   DM Mono   -- a ledger voice for anything that is a *record*: the live
 *                count, square indexes, timestamps.
 */

const display = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
})

const sans = Work_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

/*
 * The hero band uses its own pair, per its design: a high-contrast serif for
 * the sentence and a neutral grotesque for the chrome around it. They are
 * scoped to that band -- the paper sections below still run on Fraunces and
 * Work Sans -- which is why five families are loaded rather than three.
 */
const stageDisplay = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-stage',
})

const stageUi = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui',
})

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    template: `%s — ${BRAND_NAME}`,
  },
  description:
    'One million squares. $10 each. One per person, ever. Upload one photo and it is locked forever.',
  openGraph: {
    siteName: BRAND_NAME,
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  // The hero is what loads first, so the browser chrome matches it rather
  // than the paper sections further down.
  themeColor: '#1a1510',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${stageDisplay.variable} ${stageUi.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
