'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { PoolClient } from 'pg'
import { query, queryOne, transaction } from '@/lib/db'
import { checkPassword, endAdminSession, isAdmin, startAdminSession } from '@/lib/admin-auth'
import { mailer } from '@/lib/email/index'
import { contentRemoved } from '@/lib/email/templates'
import { storage } from '@/lib/storage'
import { UPLOAD_WINDOW_DAYS } from '@/lib/env'
import { generateToken, hashToken } from '@/lib/tokens'
import { dispatchNow, scheduleClaimEmails } from '@/lib/scheduler'
import { WallSoldOutError, assignSquare } from '@/lib/wall/queries'

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const password = String(form.get('password') ?? '')
  if (!checkPassword(password)) return 'Incorrect password.'
  await startAdminSession()
  redirect('/admin')
}

export async function logout(): Promise<void> {
  await endAdminSession()
  redirect('/admin/login')
}

/**
 * Removes a square's content.
 *
 * A removed square follows exactly the same rule as one that was never filled
 * in: permanently locked to the original buyer, no refund, never resold, shown
 * with the neutral default treatment. The image is deleted from storage; the
 * row stays so the square keeps its owner and its history.
 */
export async function removeContent(form: FormData): Promise<void> {
  if (!(await isAdmin())) throw new Error('Not authorised.')

  const squareIndex = Number(form.get('squareIndex'))
  const reason = String(form.get('reason') ?? '').trim() || 'Content policy violation'
  if (!Number.isInteger(squareIndex)) throw new Error('Unknown square.')

  const square = await queryOne<{ image_key: string | null; order_id: string }>(
    `SELECT image_key, order_id FROM squares WHERE index = $1 AND state = 'filled'`,
    [squareIndex],
  )
  if (!square) return

  await query(
    `UPDATE squares
        SET state = 'removed',
            removed_at = now(),
            removed_reason = $2,
            removed_by = 'moderator',
            image_key = NULL
      WHERE index = $1`,
    [squareIndex, reason],
  )

  if (square.image_key) {
    const store = await storage()
    await store.delete(square.image_key).catch((err) => {
      console.error(`could not delete blob for square ${squareIndex}`, err)
    })
  }

  await query(
    `UPDATE reports SET status = 'actioned', resolved_at = now()
      WHERE square_index = $1 AND status = 'open'`,
    [squareIndex],
  )

  // Tell the buyer what happened and, importantly, that they keep the square.
  const owner = await queryOne<{ email: string }>(`SELECT email FROM orders WHERE id = $1`, [
    square.order_id,
  ])
  if (owner) {
    try {
      const send = await mailer()
      await send.send(contentRemoved({ to: owner.email, squareIndex, reason }))
    } catch (err) {
      console.error('could not send removal notice', err)
    }
  }

  revalidatePath('/admin')
  revalidatePath(`/s/${squareIndex}`)
}

export async function resolveReport(form: FormData): Promise<void> {
  if (!(await isAdmin())) throw new Error('Not authorised.')
  const id = String(form.get('reportId') ?? '')
  if (!id) return
  await query(
    `UPDATE reports SET status = 'dismissed', resolved_at = now() WHERE id = $1 AND status = 'open'`,
    [id],
  )
  revalidatePath('/admin/reports')
}


/**
 * Reports an admin action back to the panel.
 *
 * Server actions that throw render as "Application error: a server-side
 * exception has occurred" plus a digest in production -- Next.js masks the
 * message deliberately, so a mistyped confirmation is indistinguishable from a
 * crash and neither one tells you what to do next. Anything a person can cause
 * and correct therefore comes back as a banner on /admin instead of an
 * exception. Genuine faults are still logged server-side for the Vercel log.
 */
function finish(params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString()
  redirect(`/admin${q ? `?${q}` : ''}`)
}

/**
 * Deletes a square outright and returns its index to the pool.
 *
 * This is the one override of "a square is permanently theirs". Nothing the
 * public can do reaches it; it exists so the owner can undo a claim by hand.
 * Refunds are deliberately not touched -- those are issued in Stripe, where
 * the money actually is.
 *
 * What makes this more than a DELETE:
 *
 *  - reports and moderation_scans both carry a foreign key to squares(index),
 *    so they have to go first or the delete fails. moderation_scans is not
 *    disposable -- 0001 keeps it as an auditable record of what was scanned,
 *    which matters under 18 U.S.C. 2258A -- so the verdicts are copied into
 *    deleted_squares before the rows are dropped.
 *  - the order row is kept. A payment happened; destroying the record of it
 *    would make the Stripe side impossible to reconcile. Only its link to the
 *    square is cut, which also releases the buyer's email from the
 *    one-per-person cap, as it must if the square never happened.
 *  - queued emails are cancelled. Otherwise the former owner keeps getting
 *    "you have N days left to upload" for a square that no longer exists.
 *  - the index goes onto the free list, so the next claim reuses it.
 *
 * The image is deleted after the transaction commits: an orphaned object costs
 * a fraction of a cent, whereas deleting it before a rollback would destroy a
 * photo that is still live.
 */
export async function deleteSquare(form: FormData): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login')

  const squareIndex = Number(form.get('squareIndex'))
  const confirm = String(form.get('confirmIndex') ?? '').trim()
  const reason = String(form.get('reason') ?? '').trim() || 'Deleted by admin'

  if (!Number.isInteger(squareIndex) || squareIndex < 0) {
    finish({ error: 'That is not a square number.' })
  }
  // Typing the number back is the only guard against deleting the wrong row;
  // there is no undo for the photo.
  if (confirm !== String(squareIndex)) {
    finish({
      error: `Type ${squareIndex} in the box next to "Delete square" to confirm. Nothing was deleted.`,
    })
  }

  /*
   * The transaction reports found-ness separately from the image key. Returning
   * the key alone cannot work: a square with no photo has a null key, which is
   * exactly what "no such square" would return, so every successful deletion of
   * an unfilled square reported itself as a failure while having already
   * committed.
   */
  let outcome: { found: boolean; imageKey: string | null }
  try {
    outcome = await transaction(async (client: PoolClient) => {
      const rows = await client.query<{
        index: number
        order_id: string
        image_key: string | null
      }>(`SELECT index, order_id, image_key FROM squares WHERE index = $1 FOR UPDATE`, [
        squareIndex,
      ])
      const square = rows.rows[0]
      if (!square) return { found: false, imageKey: null }

      const owner = await client.query<{ email: string; is_admin_grant: boolean }>(
        `SELECT email, is_admin_grant FROM orders WHERE id = $1`,
        [square.order_id],
      )

      await client.query(
        `INSERT INTO deleted_squares (
           square_index, order_id, email, claimed_at, state, image_key, caption,
           link_url, category, filled_at, was_admin_grant, scan_history,
           reports_removed, deleted_reason)
         SELECT s.index, s.order_id, $2, s.claimed_at, s.state, s.image_key,
                s.caption, s.link_url, s.category, s.filled_at, $3,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'provider', m.provider, 'verdict', m.verdict,
                            'detail', m.detail, 'created_at', m.created_at))
                            FROM moderation_scans m WHERE m.square_index = s.index),
                         '[]'::jsonb),
                (SELECT count(*) FROM reports r WHERE r.square_index = s.index),
                $4
           FROM squares s WHERE s.index = $1`,
        [
          squareIndex,
          owner.rows[0]?.email ?? null,
          owner.rows[0]?.is_admin_grant ?? false,
          reason,
        ],
      )

      await client.query(`DELETE FROM reports WHERE square_index = $1`, [squareIndex])
      await client.query(`DELETE FROM moderation_scans WHERE square_index = $1`, [squareIndex])
      await client.query(`DELETE FROM squares WHERE index = $1`, [squareIndex])

      // Cuts the order loose from the square without losing the payment record,
      // and frees the email for the one-per-person cap.
      await client.query(
        `UPDATE orders SET square_index = NULL, milestone = NULL WHERE id = $1`,
        [square.order_id],
      )

      await client.query(
        `UPDATE scheduled_emails
            SET status = 'cancelled', last_error = 'square deleted by admin'
          WHERE status = 'pending'
            AND (dedupe_key IN ('claim:' || $1, 'reminder1:' || $1, 'reminder5:' || $1)
                 OR dedupe_key LIKE 'capsule:' || $1 || ':%')`,
        [square.order_id],
      )

      await client.query(
        `INSERT INTO released_squares (index, reason) VALUES ($1, $2)
         ON CONFLICT (index) DO NOTHING`,
        [squareIndex, reason],
      )

      return { found: true, imageKey: square.image_key }
    })
  } catch (err) {
    console.error(`deleteSquare(${squareIndex}) failed`, err)
    finish({
      error: `Could not delete ${squareIndex}: ${err instanceof Error ? err.message : 'unknown error'}. Nothing was changed.`,
    })
  }

  if (!outcome.found) finish({ error: `Square ${squareIndex} does not exist.` })

  /*
   * Best effort, and never allowed to fail the request. The row is already
   * gone and committed; constructing the storage driver can throw on its own
   * if its configuration is incomplete, and an error here would report a
   * deletion that actually succeeded as a crash.
   */
  let orphaned = false
  if (outcome.imageKey) {
    try {
      const store = await storage()
      await store.delete(outcome.imageKey)
    } catch (err) {
      orphaned = true
      console.error(`square ${squareIndex} deleted but its blob remains`, err)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath(`/s/${squareIndex}`)
  finish({
    notice: orphaned
      ? `Square ${squareIndex} deleted and its number released. The stored image could not be removed — delete it from the bucket by hand.`
      : `Square ${squareIndex} deleted. Its number is back in the pool and will go to the next claim.`,
  })
}

/**
 * Assigns a square without a payment.
 *
 * Identical to a bought square in every respect that matters: it comes from the
 * same pool via the same assignSquare(), gets the same permanent URL, the same
 * upload token, the same upload window, and the same locked-forever rule once a
 * photo is on it. The only differences are that amount_cents is 0, there is no
 * Stripe session, and is_admin_grant exempts it from the one-per-person cap --
 * which is what lets the owner issue one of these a day for months to the same
 * address without tripping a rule meant to stop somebody buying two.
 *
 * The upload link is handed straight back to the caller rather than relying on
 * the email, because the confirmation is queued like any other and the mail
 * driver may not be sending yet.
 */
export async function grantSquare(form: FormData): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login')

  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const note = String(form.get('note') ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    finish({ error: 'Enter a valid email address for the grant.' })
  }

  const grantedAt = new Date()
  let assignedIndex: number
  let uploadToken: string
  try {
    const order = await queryOne<{ id: string }>(
      `INSERT INTO orders (stripe_checkout_session_id, email, amount_cents, status,
                           is_admin_grant, time_capsule_note, paid_at, upload_deadline)
       VALUES ($1, $2, 0, 'paid', true, $3, $4, $4::timestamptz + ($5 || ' days')::interval)
       RETURNING id`,
      [
        `admin_grant_${grantedAt.getTime()}_${Math.random().toString(36).slice(2, 10)}`,
        email,
        note || null,
        grantedAt,
        String(UPLOAD_WINDOW_DAYS),
      ],
    )
    if (!order) throw new Error('the grant order could not be created')

    uploadToken = generateToken()
    try {
      const assigned = await assignSquare({
        orderId: order.id,
        uploadTokenHash: hashToken(uploadToken),
      })
      assignedIndex = assigned.index
    } catch (err) {
      // Leave no dangling order behind if there was nothing left to assign.
      await query(`DELETE FROM orders WHERE id = $1`, [order.id])
      throw err instanceof WallSoldOutError ? new Error('every square is claimed') : err
    }

    await scheduleClaimEmails({
      orderId: order.id,
      email,
      squareIndex: assignedIndex,
      uploadToken,
      claimedAt: grantedAt,
      timeCapsuleNote: note || null,
    })
    await dispatchNow(`claim:${order.id}`)
  } catch (err) {
    console.error('grantSquare failed', err)
    finish({
      error: `Could not assign a square: ${err instanceof Error ? err.message : 'unknown error'}.`,
    })
  }

  revalidatePath('/admin')
  revalidatePath('/')
  finish({ granted: String(assignedIndex), t: uploadToken })
}
