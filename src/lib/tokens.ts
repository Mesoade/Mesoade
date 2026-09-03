import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * There are no accounts anywhere in this product, so a buyer's only handle on
 * their square is a token they receive after paying: in the success redirect
 * and in their confirmation email. It is stored hashed, never in plaintext.
 */

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Reporter IPs are only ever kept as a salted hash, for abuse rate limiting. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}
