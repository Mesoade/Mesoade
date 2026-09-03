import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { SQUARE_PRICE_CENTS } from '@/lib/env'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { createCheckoutSession } from '@/lib/stripe'
import { emailHasSquare } from '@/lib/wall/queries'
import { TOTAL_SQUARES } from '@/lib/wall/geometry'
import { queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_NOTE_LENGTH = 480

/**
 * Creates the Stripe Checkout Session for one square.
 *
 * The one-per-person cap is checked here, before any money moves, so the
 * overwhelmingly common case -- someone who already bought a square coming
 * back -- is a friendly redirect rather than a charge we then have to refuse.
 * The webhook re-checks, because someone can always reach Stripe with a
 * different address than the one they typed here.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`checkout:${clientIp(request.headers)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  let body: { email?: unknown; timeCapsuleNote?: unknown; agreed?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  if (body.agreed !== true) {
    return NextResponse.json(
      { error: 'You need to accept the terms before paying.' },
      { status: 400 },
    )
  }

  const note =
    typeof body.timeCapsuleNote === 'string' && body.timeCapsuleNote.trim()
      ? body.timeCapsuleNote.trim().slice(0, MAX_NOTE_LENGTH)
      : null

  // Sold out is a real state, not a hypothetical -- fail before charging.
  const cursor = await queryOne<{ next_index: number }>(
    `SELECT next_index FROM wall_state WHERE id = 1`,
  )
  if ((cursor?.next_index ?? 0) >= TOTAL_SQUARES) {
    return NextResponse.json(
      { error: 'Every square has been claimed.', soldOut: true },
      { status: 409 },
    )
  }

  const existing = await emailHasSquare(email)
  if (existing !== null) {
    return NextResponse.json(
      {
        error: 'This email already has a square. Everyone gets exactly one.',
        existingSquare: existing,
      },
      { status: 409 },
    )
  }

  try {
    const session = await createCheckoutSession({ email, timeCapsuleNote: note })

    // Recorded as pending now so a webhook that lands before the browser
    // returns still has a row to attach to.
    await query(
      `INSERT INTO orders (stripe_checkout_session_id, email, amount_cents, status, time_capsule_note)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (stripe_checkout_session_id) DO NOTHING`,
      [session.id, email, SQUARE_PRICE_CENTS, note],
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('checkout session failed', err)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 502 },
    )
  }
}

function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value)
}
