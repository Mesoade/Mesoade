'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { checkPassword, endAdminSession, isAdmin, startAdminSession } from '@/lib/admin-auth'
import { mailer } from '@/lib/email/index'
import { contentRemoved } from '@/lib/email/templates'
import { storage } from '@/lib/storage'

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
