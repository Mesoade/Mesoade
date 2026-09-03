import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * The static pages plus the most recently claimed squares. Not all million --
 * only squares that actually exist, newest first, capped at the practical
 * sitemap limit.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/claim`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/content-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/dmca`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const rows = await query<{ index: number; claimed_at: Date }>(
      `SELECT index, claimed_at FROM squares ORDER BY claimed_at DESC LIMIT 45000`,
    )
    return [
      ...staticPages,
      ...rows.map((r) => ({
        url: `${base}/s/${r.index}`,
        lastModified: r.claimed_at,
        changeFrequency: 'yearly' as const,
        priority: 0.5,
      })),
    ]
  } catch {
    // A sitemap is not worth failing a deploy over.
    return staticPages
  }
}
