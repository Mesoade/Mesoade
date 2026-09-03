import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { StorageDriver } from './index.ts'
import { publicUrl } from './index.ts'

/**
 * S3-compatible driver. Works with AWS S3, Cloudflare R2, or Backblaze B2 --
 * set S3_ENDPOINT for the non-AWS ones.
 *
 * If you serve these images through Cloudflare, this is also where the free
 * CSAM Scanning Tool applies: it is enabled per-zone in the Cloudflare
 * dashboard and scans images as they are served. See src/lib/moderation/csam.ts.
 */
export function s3Driver(): StorageDriver {
  const bucket = process.env.S3_BUCKET
  if (!bucket) throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET')

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  })

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Content is immutable once uploaded -- there is no edit path.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
      return { key, url: publicUrl(key) }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    urlFor(key) {
      return publicUrl(key)
    },
  }
}
