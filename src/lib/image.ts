/**
 * Image validation, done from the bytes rather than the declared MIME type or
 * file extension -- both of which a client controls.
 *
 * Limits are enforced here because this step only exists after payment: the
 * brief is explicit that nobody should be blocked from paying by not having
 * their photo ready.
 */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // 12 MB
export const MIN_DIMENSION = 200
export const MAX_DIMENSION = 8000

export interface ImageInfo {
  format: 'jpeg' | 'png' | 'webp' | 'gif'
  contentType: string
  extension: string
  width: number
  height: number
}

export class InvalidImageError extends Error {}

/** Identifies the format and reads dimensions from the file header. */
export function inspectImage(buffer: Buffer): ImageInfo {
  if (buffer.length === 0) throw new InvalidImageError('The file is empty.')
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError(
      `Images must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    )
  }

  const info =
    readPng(buffer) ?? readJpeg(buffer) ?? readGif(buffer) ?? readWebp(buffer)

  if (!info) {
    throw new InvalidImageError('That file is not a JPEG, PNG, WebP, or GIF image.')
  }
  if (info.width < MIN_DIMENSION || info.height < MIN_DIMENSION) {
    throw new InvalidImageError(
      `Images must be at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`,
    )
  }
  if (info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) {
    throw new InvalidImageError(
      `Images must be at most ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`,
    )
  }
  return info
}

function readPng(b: Buffer): ImageInfo | null {
  if (b.length < 24) return null
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null
  if (b.toString('ascii', 12, 16) !== 'IHDR') return null
  return {
    format: 'png',
    contentType: 'image/png',
    extension: 'png',
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
  }
}

function readJpeg(b: Buffer): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = b[offset + 1]!
    // SOF0-SOF15, excluding the non-frame markers DHT/JPG/DAC.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        format: 'jpeg',
        contentType: 'image/jpeg',
        extension: 'jpg',
        height: b.readUInt16BE(offset + 5),
        width: b.readUInt16BE(offset + 7),
      }
    }
    const length = b.readUInt16BE(offset + 2)
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

function readGif(b: Buffer): ImageInfo | null {
  if (b.length < 10) return null
  const magic = b.toString('ascii', 0, 6)
  if (magic !== 'GIF87a' && magic !== 'GIF89a') return null
  return {
    format: 'gif',
    contentType: 'image/gif',
    extension: 'gif',
    width: b.readUInt16LE(6),
    height: b.readUInt16LE(8),
  }
}

function readWebp(b: Buffer): ImageInfo | null {
  if (b.length < 30) return null
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    return null
  }
  const chunk = b.toString('ascii', 12, 16)
  const base = { format: 'webp', contentType: 'image/webp', extension: 'webp' } as const

  if (chunk === 'VP8 ') {
    // Lossy: dimensions follow the 3-byte start code in the frame header.
    return { ...base, width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    // Lossless: 14 bits each, packed little-endian after the signature byte.
    const bits = b.readUInt32LE(21)
    return { ...base, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    // Extended: 24-bit minus-one canvas dimensions.
    const width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16))
    const height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16))
    return { ...base, width, height }
  }
  return null
}

/**
 * Optional caption and link limits, enforced server-side as well as in the
 * form. The caption is the buyer's story about their photograph, so it has
 * room for a few sentences rather than a line.
 */
export const MAX_CAPTION_LENGTH = 500
export const MAX_LINK_LENGTH = 300

export function normaliseLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new InvalidImageError('That link is not a valid web address.')
  }
  // http/https only: no javascript:, data:, or mailto: making it onto the page.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidImageError('Links must start with http:// or https://')
  }
  const href = url.toString()
  if (href.length > MAX_LINK_LENGTH) {
    throw new InvalidImageError('That link is too long.')
  }
  return href
}
