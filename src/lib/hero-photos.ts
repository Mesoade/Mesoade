/**
 * The decorative photo grid behind the hero.
 *
 * These are not squares. Nothing here touches the wall, the database, or a
 * single real claim -- they are stock photographs chosen to suggest the kind of
 * thing somebody might put on their one square, and they are deliberately
 * unconnected to live data so that an empty wall never produces an empty hero.
 *
 * They are fetched from Unsplash on the server rather than committed, because
 * the image URLs are only obtainable through its API. The result is memoised
 * for a week: the grid should look the same to somebody who comes back
 * tomorrow, and the API has a modest hourly rate limit that a popular landing
 * page would otherwise burn through in minutes.
 *
 * Everything degrades: no key, a rate limit, or an outage leaves `photos`
 * empty, and the grid falls back to tonal tiles. The hero is built so that
 * reads as a design rather than as a failure.
 */

export interface HeroPhoto {
  id: string
  src: string
  alt: string
  /** Photographer, kept so the credit can be made per-photo later. */
  credit: string
  creditUrl: string
}

/** The feeling the grid is meant to carry: ordinary life worth keeping. */
const THEMES = [
  'birthday celebration',
  'wedding day',
  'pet dog cat',
  'holding hands',
  'travel landscape',
  'people laughing',
  'quiet home morning',
  'family portrait',
] as const

const PER_THEME = 12
const TARGET = 88
const TTL_MS = 7 * 24 * 60 * 60 * 1000

let cache: { at: number; photos: HeroPhoto[] } | null = null
let inflight: Promise<HeroPhoto[]> | null = null

interface UnsplashPhoto {
  id: string
  urls: { raw: string }
  alt_description: string | null
  user: { name: string; links: { html: string } }
}

/**
 * Unsplash serves through imgix, so the sizing is a query string rather than a
 * separate API call. These tiles are small and sit under a dark overlay, so
 * they are requested small and lossy -- eighty full-size photographs would be
 * tens of megabytes for something nobody is meant to look at directly.
 */
function tileUrl(raw: string): string {
  return `${raw}&w=360&h=360&fit=crop&crop=faces,entropy&q=60&fm=webp`
}

async function fetchTheme(theme: string, key: string): Promise<HeroPhoto[]> {
  const url =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(theme)}&per_page=${PER_THEME}` +
    `&orientation=squarish&content_filter=high`

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
    // The route this renders in is force-dynamic, which would otherwise opt
    // every fetch out of the data cache and hit Unsplash on every page view.
    cache: 'force-cache',
    next: { revalidate: 604_800 },
  })
  if (!res.ok) throw new Error(`Unsplash ${res.status} for "${theme}"`)

  const body = (await res.json()) as { results: UnsplashPhoto[] }
  return body.results.map((p) => ({
    id: p.id,
    src: tileUrl(p.urls.raw),
    alt: p.alt_description ?? '',
    credit: p.user.name,
    creditUrl: p.user.links.html,
  }))
}

async function load(): Promise<HeroPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return []

  const settled = await Promise.allSettled(THEMES.map((t) => fetchTheme(t, key)))

  const seen = new Set<string>()
  const photos: HeroPhoto[] = []
  // Round-robin across themes rather than concatenating them, so the grid is a
  // mix throughout instead of twelve weddings followed by twelve dogs.
  for (let i = 0; i < PER_THEME; i++) {
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue
      const photo = result.value[i]
      if (!photo || seen.has(photo.id)) continue
      seen.add(photo.id)
      photos.push(photo)
      if (photos.length >= TARGET) return photos
    }
  }
  return photos
}

export async function getHeroPhotos(): Promise<HeroPhoto[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.photos
  if (inflight) return inflight

  inflight = load()
    .then((photos) => {
      // Only cache a usable result, so a transient failure retries rather than
      // pinning an empty grid in place for a week.
      if (photos.length > 0) cache = { at: Date.now(), photos }
      return photos
    })
    .catch((err) => {
      console.error('hero photos unavailable', err)
      return [] as HeroPhoto[]
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
