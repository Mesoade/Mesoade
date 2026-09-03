/**
 * Small in-memory rate limiter for the abuse-prone public endpoints (reports,
 * checkout creation). Per-instance and best-effort by design: it exists to stop
 * casual hammering, not a determined attacker. If the site ever runs on many
 * instances and this matters, move it to Postgres or Redis.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) sweep(now)
    return { ok: true, retryAfterSeconds: 0 }
  }

  existing.count++
  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfterSeconds: 0 }
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? '0.0.0.0'
}
