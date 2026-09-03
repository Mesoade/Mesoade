import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * Where is my square?
 *
 * Assignment happens in the Stripe webhook, not on the redirect, so that a
 * payment always produces a square even if the buyer closes the tab. That means
 * the success page can briefly arrive before the square exists; it polls here
 * until it does.
 */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Unknown checkout session.' }, { status: 400 })
  }

  const order = await queryOne<{ square_index: number | null; status: string }>(
    `SELECT square_index, status FROM orders WHERE stripe_checkout_session_id = $1`,
    [sessionId],
  )

  if (order?.square_index !== null && order?.square_index !== undefined) {
    return NextResponse.json({ state: 'assigned', squareIndex: order.square_index })
  }

  if (order?.status === 'duplicate') {
    return NextResponse.json({ state: 'duplicate' })
  }

  // Confirm with Stripe so a webhook that is merely slow is distinguishable
  // from a payment that never completed.
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    if (session.payment_status === 'paid') {
      return NextResponse.json({ state: 'processing' })
    }
    return NextResponse.json({ state: 'unpaid' })
  } catch {
    return NextResponse.json({ state: 'unknown' })
  }
}
