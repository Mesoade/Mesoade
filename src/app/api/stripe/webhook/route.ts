import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { query, queryOne } from '@/lib/db'
import { UPLOAD_WINDOW_DAYS, env } from '@/lib/env'
import { cardFingerprintFor, stripe } from '@/lib/stripe'
import { generateToken, hashToken } from '@/lib/tokens'
import { dispatchNow, scheduleClaimEmails } from '@/lib/scheduler'
import { WallSoldOutError, assignSquare, emailHasSquare } from '@/lib/wall/queries'

export const dynamic = 'force-dynamic'
// The signature is computed over the exact bytes Stripe sent, so this route
// must never see a parsed or re-encoded body.
export const runtime = 'nodejs'

/**
 * Stripe webhook. This is the only place a square is ever assigned.
 *
 * Payment confirmation happens here rather than on the success redirect,
 * because the browser may never come back -- and a square must exist for every
 * payment that succeeded, whether or not the buyer stuck around to see it.
 *
 * Stripe delivers at least once, so every event id is recorded and replays are
 * dropped before any work happens.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const raw = await request.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(raw, signature, env.stripeWebhookSecret)
  } catch (err) {
    console.error('stripe signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  // Idempotency gate. The insert succeeding is what grants the right to run.
  const claimed = await queryOne<{ event_id: string }>(
    `INSERT INTO processed_webhooks (event_id, type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [event.id, event.type],
  )
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCompleted(event.data.object)
        break
      case 'checkout.session.expired':
        await query(
          `UPDATE orders SET status = 'expired'
            WHERE stripe_checkout_session_id = $1 AND status = 'pending'`,
          [event.data.object.id],
        )
        break
      default:
        break
    }
  } catch (err) {
    // Release the idempotency claim so Stripe's retry can actually retry.
    await query(`DELETE FROM processed_webhooks WHERE event_id = $1`, [event.id])
    console.error(`webhook ${event.type} failed`, err)
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return

  const email = (session.customer_details?.email ?? session.customer_email ?? '')
    .trim()
    .toLowerCase()
  if (!email) throw new Error(`checkout session ${session.id} has no email`)

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  const fingerprint = await cardFingerprintFor(paymentIntentId)

  // The order row normally exists already (created alongside the session), but
  // this makes the webhook self-sufficient if it does not.
  const order = await queryOne<{ id: string; square_index: number | null; time_capsule_note: string | null }>(
    `INSERT INTO orders (
       stripe_checkout_session_id, stripe_payment_intent_id, email,
       amount_cents, status, card_fingerprint, time_capsule_note, paid_at
     )
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, now())
     ON CONFLICT (stripe_checkout_session_id) DO UPDATE
       SET stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
           card_fingerprint = COALESCE(EXCLUDED.card_fingerprint, orders.card_fingerprint),
           paid_at = COALESCE(orders.paid_at, now())
     RETURNING id, square_index, time_capsule_note`,
    [
      session.id,
      paymentIntentId,
      email,
      session.amount_total ?? 0,
      fingerprint,
      session.metadata?.time_capsule_note || null,
    ],
  )
  if (!order) throw new Error(`could not upsert order for session ${session.id}`)

  // Already assigned -- a retry that got past the idempotency gate somehow.
  if (order.square_index !== null) return

  /*
   * Soft one-per-person enforcement, second pass.
   *
   * The brief is explicit that this is best-effort: real identity verification
   * would be absurd friction on a $10 sale. What matters is that the product
   * never offers a way to buy two, and that a duplicate is flagged for a human
   * rather than silently given a second square. Recorded as 'duplicate' and
   * surfaced in /admin; refunds are the owner's call, since the stated policy
   * is that there are none.
   */
  const alreadyOwned = await emailHasSquare(email)
  if (alreadyOwned !== null) {
    await query(`UPDATE orders SET status = 'duplicate' WHERE id = $1`, [order.id])
    console.warn(
      `duplicate purchase by ${email} (already holds square ${alreadyOwned}); order ${order.id} flagged for review`,
    )
    return
  }

  const uploadToken = generateToken()
  let assigned: { index: number }
  try {
    assigned = await assignSquare({
      orderId: order.id,
      uploadTokenHash: hashToken(uploadToken),
    })
  } catch (err) {
    if (err instanceof WallSoldOutError) {
      // Should be unreachable: checkout refuses once the wall is full. If it
      // ever happens, leave the order visible rather than losing the payment.
      await query(`UPDATE orders SET status = 'duplicate' WHERE id = $1`, [order.id])
      console.error(`payment received for a sold-out wall; order ${order.id} needs attention`)
      return
    }
    throw err
  }

  const paidAt = new Date()
  await query(
    `UPDATE orders
        SET status = 'paid',
            paid_at = COALESCE(paid_at, $2),
            upload_deadline = $2::timestamptz + ($3 || ' days')::interval
      WHERE id = $1`,
    [order.id, paidAt, String(UPLOAD_WINDOW_DAYS)],
  )

  await scheduleClaimEmails({
    orderId: order.id,
    email,
    squareIndex: assigned.index,
    uploadToken,
    claimedAt: paidAt,
    timeCapsuleNote: order.time_capsule_note,
  })

  // The reminders and capsules can wait for the daily cron -- a few hours
  // either way means nothing to them. The confirmation cannot: it carries the
  // only link the buyer will ever have to their square. Sent here, and never
  // allowed to throw, so a mail outage leaves the row pending for the cron
  // rather than failing the webhook and making Stripe redeliver it.
  await dispatchNow(`claim:${order.id}`)
}
