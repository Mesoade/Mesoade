import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keeping the moderation tools and one-time upload links out of indexes.
      // The admin path has a password; this simply avoids advertising it.
      disallow: ['/admin', '/admin/', '/upload/', '/claim/success', '/api/'],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  }
}
