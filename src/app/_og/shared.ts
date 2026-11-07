import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Shared pieces for the generated link-preview cards.
 *
 * The cards are drawn in the paper palette rather than the hero's dark one:
 * a link preview sits on someone else's timeline, next to other people's
 * posts, and the cream reads as a printed thing among them instead of as one
 * more dark software screenshot.
 *
 * The fonts are the site's own, carried as Latin-subset TTFs because Satori
 * cannot read the woff2 that next/font emits. They are read from disk rather
 * than fetched: the homepage card is prerendered at build time, where there is
 * no server to fetch a relative URL from. next.config.ts lists them under
 * outputFileTracingIncludes so they are bundled into the functions that need
 * them.
 */

export const OG = {
  paper: '#faf6ef',
  paperRaised: '#f4ede2',
  rule: '#e0d5c4',
  ink: '#1c1714',
  ink2: '#57493d',
  ink3: '#7a6a59',
  ember: '#9c3d1b',
} as const

export const OG_SIZE = { width: 1200, height: 630 }

const DIR = join(process.cwd(), 'src', 'app', '_og')

let cached: Promise<{ display: Buffer; ui: Buffer }> | null = null

export function ogFonts() {
  cached ??= Promise.all([
    readFile(join(DIR, 'Fraunces-SemiBold.ttf')),
    readFile(join(DIR, 'WorkSans-Medium.ttf')),
  ]).then(([display, ui]) => ({ display, ui }))
  return cached
}

/** The `fonts` option for ImageResponse, in the shape it expects. */
export async function ogFontConfig() {
  const { display, ui } = await ogFonts()
  return [
    { name: 'Display', data: display, style: 'normal' as const, weight: 600 as const },
    { name: 'UI', data: ui, style: 'normal' as const, weight: 500 as const },
  ]
}
