import { queryOne } from './db.ts'
import { stripe } from './stripe.ts'
import { tokenMatches } from './tokens.ts'
import { getSquare, type SquareRow } from './wall/queries.ts'

/**
 * Who is allowed to upload to a square.
 *
 * There are no accounts, so access rests on two unguessable, server-verified
 * paths, both of which only a buyer can hold:
 *
 *   1. `session_id` -- the Stripe Checkout session in the success redirect.
 *      Verified live against Stripe (must be paid) and matched to the order
 *      that owns this square. This is the path the browser takes straight
 *      after paying.
 *   2. `t` -- a random token generated at assignment. Only its SHA-256 lives
 *      in the database; the plaintext exists solely in the confirmation and
 *      reminder emails. This is the path back in later.
 *
 * Both are single-use in effect: the moment a square is filled it is locked,
 * and no credential opens it again.
 */

export type AccessDenial =
  | 'not_found'
  | 'bad_credential'
  | 'already_filled'
  | 'removed'
  | 'window_closed'

export interface AccessGrant {
  square: SquareRow
  orderId: string
  email: string
  deadline: Date | null
}

export type AccessResult =
  | { ok: true; grant: AccessGrant }
  | { ok: false; reason: AccessDenial }

export async function checkUploadAccess(args: {
  squareIndex: number
  token?: string | null
  sessionId?: string | null
}): Promise<AccessResult> {
  const square = await getSquare(args.squareIndex)
  if (!square) return { ok: false, reason: 'not_found' }

  // Content is locked forever once uploaded. There is no edit path, so a valid
  // credential on a filled square is still refused.
  if (square.state === 'filled') return { ok: false, reason: 'already_filled' }
  // A removed square keeps the neutral treatment permanently; it is never
  // re-openable for a second attempt.
  if (square.state === 'removed') return { ok: false, reason: 'removed' }

  const order = await queryOne<{
    id: string
    email: string
    upload_deadline: Date | null
    stripe_checkout_session_id: string
    status: string
  }>(
    `SELECT id, email, upload_deadline, stripe_checkout_session_id, status
       FROM orders WHERE id = $1`,
    [square.order_id],
  )
  if (!order) return { ok: false, reason: 'not_found' }

  const authorised =
    (args.token ? tokenMatches(args.token, square.upload_token_hash) : false) ||
    (args.sessionId ? await sessionAuthorises(args.sessionId, order.stripe_checkout_session_id) : false)

  if (!authorised) return { ok: false, reason: 'bad_credential' }

  if (order.upload_deadline && order.upload_deadline.getTime() < Date.now()) {
    return { ok: false, reason: 'window_closed' }
  }

  return {
    ok: true,
    grant: {
      square,
      orderId: order.id,
      email: order.email,
      deadline: order.upload_deadline,
    },
  }
}

async function sessionAuthorises(
  provided: string,
  expected: string,
): Promise<boolean> {
  if (provided !== expected) return false
  try {
    const session = await stripe().checkout.sessions.retrieve(provided)
    return session.payment_status === 'paid'
  } catch {
    return false
  }
}

export const DENIAL_MESSAGES: Record<AccessDenial, string> = {
  not_found: 'That square has not been claimed yet.',
  bad_credential:
    'This link is not valid for that square. Use the link in your confirmation email.',
  already_filled:
    'This square already has its photo, and content is locked permanently once uploaded.',
  removed:
    'The content on this square was removed under the content policy. The square remains permanently yours, but it cannot be uploaded to again.',
  window_closed:
    'The 7-day upload window for this square has closed. The square is still permanently yours — it simply stays blank.',
}
