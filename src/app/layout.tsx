import type { Metadata, Viewport } from 'next'
import { BRAND_NAME, BRAND_TAGLINE, env } from '@/lib/env'
import './globals.css'

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
  themeColor: '#0f0f10',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
