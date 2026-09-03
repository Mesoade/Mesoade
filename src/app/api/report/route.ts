import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { env } from '@/lib/env'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { hashIp } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

/**
 * "Report this square", open to any visitor with no login.
 *
 * Under a post-moderation model this is how the moderator finds problems --
 * nobody is going to manually scan a million-square wall.
 */
const REASONS = new Set([
  'sexual',
  'illegal',
  'hate',
  'scam',
  'private_info',
  'copyright',
  'other',
])

export async function POST(request: Request) {
  const ip = clientIp(request.headers)
  const limit = rateLimit(`report:${ip}`, 8, 10 * 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many reports from here. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  let body: { squareIndex?: unknown; reason?: unknown; details?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const squareIndex = Number(body.squareIndex)
  if (!Number.isInteger(squareIndex) || squareIndex < 0) {
    return NextResponse.json({ error: 'Unknown square.' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason : ''
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: 'Choose a reason.' }, { status: 400 })
  }

  const exists = await queryOne<{ index: number }>(
    `SELECT index FROM squares WHERE index = $1`,
    [squareIndex],
  )
  if (!exists) {
    return NextResponse.json({ error: 'Unknown square.' }, { status: 404 })
  }

  const details =
    typeof body.details === 'string' ? body.details.trim().slice(0, 1000) || null : null

  await query(
    `INSERT INTO reports (square_index, reason, details, reporter_ip_hash)
     VALUES ($1, $2, $3, $4)`,
    // Reporter IPs are only ever stored hashed, purely to spot report-bombing.
    [squareIndex, reason, details, hashIp(ip, env.sessionSecret)],
  )

  return NextResponse.json({ ok: true })
}
