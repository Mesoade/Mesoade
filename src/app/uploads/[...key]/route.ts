import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Serves images written by the local storage driver, for development only.
 * In production STORAGE_DRIVER=s3 and images are served straight from the
 * bucket or its CDN, never through the app.
 */
const ROOT = resolve(process.cwd(), 'storage-dev')

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (env.storageDriver !== 'local') {
    return new Response('Not found', { status: 404 })
  }

  const { key } = await params
  const path = resolve(ROOT, key.join('/'))
  // Path traversal guard: the joined key must stay inside the storage root.
  if (path !== ROOT && !path.startsWith(ROOT + '/')) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const info = await stat(path)
    if (!info.isFile()) return new Response('Not found', { status: 404 })

    const extension = path.split('.').pop()?.toLowerCase() ?? ''
    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream

    return new Response(stream, {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Content-Length': String(info.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
