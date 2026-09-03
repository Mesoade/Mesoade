import { query } from '../db.ts'
import { env } from '../env.ts'

/**
 * Automated CSAM scanning backstop.
 *
 * This is deliberately separate from, and in addition to, human moderation.
 * Everything else -- spam, low-effort junk, harassment, scams -- is handled
 * post-hoc by a human moderator, which is a fine and deliberate choice. CSAM is
 * not, because 18 U.S.C. 2258A creates a reporting obligation the moment you
 * become aware of it, and a once-a-day manual sweep leaves a window where
 * illegal content is live and public.
 *
 * Two supported paths:
 *
 * 1. `cloudflare` -- Cloudflare's free CSAM Scanning Tool. This is NOT an API
 *    you call: it is enabled per-zone in the Cloudflare dashboard and scans
 *    images as they are served through Cloudflare. Selecting it here records
 *    that the zone-level scanner is the active backstop and writes an audit
 *    row per upload; the actual scanning and NCMEC reporting is done by
 *    Cloudflare. Requires serving uploads through a Cloudflare-proxied
 *    hostname. See docs/moderation.md.
 *
 * 2. `webhook` -- POST the image to a scanning service of your own
 *    (PhotoDNA, Thorn Safer, or similar) and act on its verdict inline.
 *
 * `none` is the default so the app runs locally without credentials. It writes
 * a 'skipped' audit row rather than silently pretending the image was checked.
 * Do not launch on `none`.
 */

export type ScanVerdict = 'clear' | 'flagged' | 'error' | 'skipped'

export interface ScanResult {
  provider: string
  verdict: ScanVerdict
  detail: Record<string, unknown>
}

export async function scanUpload(args: {
  squareIndex: number
  bytes: Buffer
  contentType: string
  publicUrl: string
}): Promise<ScanResult> {
  const provider = env.csamScanner
  let result: ScanResult

  try {
    switch (provider) {
      case 'cloudflare':
        // Scanning happens at the edge as the image is served. Nothing to call
        // inline; we record that the backstop is active for this upload.
        result = {
          provider,
          verdict: 'clear',
          detail: {
            note: 'Scanned at the Cloudflare edge on delivery; see zone settings.',
            url: args.publicUrl,
          },
        }
        break

      case 'webhook':
        result = await scanViaWebhook(args)
        break

      default:
        result = {
          provider: 'none',
          verdict: 'skipped',
          detail: { note: 'No CSAM scanner configured. Do not run this way in production.' },
        }
    }
  } catch (err) {
    result = {
      provider,
      verdict: 'error',
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }

  await recordScan(args.squareIndex, result)
  return result
}

async function scanViaWebhook(args: {
  bytes: Buffer
  contentType: string
  publicUrl: string
}): Promise<ScanResult> {
  const endpoint = process.env.CSAM_WEBHOOK_URL
  if (!endpoint) throw new Error('CSAM_SCANNER=webhook requires CSAM_WEBHOOK_URL')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': args.contentType,
      ...(process.env.CSAM_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.CSAM_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: new Uint8Array(args.bytes),
  })

  if (!res.ok) throw new Error(`scanner returned ${res.status}`)

  const body = (await res.json()) as { match?: boolean; [k: string]: unknown }
  return {
    provider: 'webhook',
    verdict: body.match ? 'flagged' : 'clear',
    detail: body,
  }
}

async function recordScan(squareIndex: number, result: ScanResult): Promise<void> {
  await query(
    `INSERT INTO moderation_scans (square_index, provider, verdict, detail)
     VALUES ($1, $2, $3, $4)`,
    [squareIndex, result.provider, result.verdict, JSON.stringify(result.detail)],
  )
}
