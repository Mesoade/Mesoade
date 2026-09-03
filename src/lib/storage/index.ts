/**
 * Object storage for uploaded images.
 *
 * Images live in blob storage, never in the database -- the database holds
 * buyer and square records only and must stay small, cheap to back up, and
 * fully separate from application concerns.
 *
 * Two drivers: `local` writes to ./storage-dev for development, `s3` talks to
 * any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2).
 */
import { env } from '../env.ts'

export interface StoredObject {
  key: string
  url: string
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>
  delete(key: string): Promise<void>
  urlFor(key: string): string
}

let cached: StorageDriver | null = null

export async function storage(): Promise<StorageDriver> {
  if (cached) return cached
  cached =
    env.storageDriver === 's3'
      ? (await import('./s3.ts')).s3Driver()
      : (await import('./local.ts')).localDriver()
  return cached
}

/** Deterministic key so an upload cannot be confused with another square's. */
export function imageKeyFor(squareIndex: number, extension: string): string {
  const padded = String(squareIndex).padStart(7, '0')
  const shard = padded.slice(0, 3)
  return `squares/${shard}/${padded}.${extension}`
}

export function publicUrl(key: string): string {
  return `${env.storagePublicBaseUrl}/${key}`
}

/** Absolute form of `publicUrl`, needed anywhere a relative path won't do
 *  (OG image generation, emails, share cards). */
export function absoluteUrl(key: string): string {
  const url = publicUrl(key)
  return url.startsWith('http') ? url : `${env.siteUrl}${url}`
}
