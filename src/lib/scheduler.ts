import { TIME_CAPSULE_YEARS, UPLOAD_WINDOW_DAYS } from './env.ts'
import { query, queryOne } from './db.ts'
import { mailer } from './email/index.ts'
import {
  claimConfirmation,
  timeCapsule,
  uploadReminder,
} from './email/templates.ts'

/**
 * One general-purpose scheduled-send queue, not two one-off systems.
 *
 * It carries both the day-1/day-5 upload reminders and the 1/5/10/25-year time
 * capsule, and anything added later slots in as another `kind`. Rows are
 * enqueued with a dedupe key so re-running an enqueue is harmless, and drained
 * by /api/cron/dispatch.
 *
 * A 25-year scheduled send is a promise no email system can truly keep, which
 * is why the buyer is told we will *do our best* to reach them rather than
 * being given a guarantee.
 */

export type ScheduledEmailKind =
  | 'claim_confirmation'
  | 'upload_reminder_day1'
  | 'upload_reminder_day5'
  | 'time_capsule'

export interface ScheduleInput {
  kind: ScheduledEmailKind
  dedupeKey: string
  recipient: string
  sendAt: Date
  payload: Record<string, unknown>
}

export async function schedule(input: ScheduleInput): Promise<void> {
  await query(
    `INSERT INTO scheduled_emails (kind, dedupe_key, recipient, send_at, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [input.kind, input.dedupeKey, input.recipient, input.sendAt, JSON.stringify(input.payload)],
  )
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000)
}

function addYears(from: Date, years: number): Date {
  const d = new Date(from)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d
}

/**
 * Everything a buyer should ever receive, queued in one place at claim time.
 * The confirmation goes out immediately; reminders are cancelled the moment
 * they upload.
 */
export async function scheduleClaimEmails(args: {
  orderId: string
  email: string
  squareIndex: number
  uploadToken: string
  claimedAt: Date
  timeCapsuleNote: string | null
}): Promise<void> {
  const base = { squareIndex: args.squareIndex, uploadToken: args.uploadToken }

  await schedule({
    kind: 'claim_confirmation',
    dedupeKey: `claim:${args.orderId}`,
    recipient: args.email,
    sendAt: args.claimedAt,
    payload: base,
  })

  await schedule({
    kind: 'upload_reminder_day1',
    dedupeKey: `reminder1:${args.orderId}`,
    recipient: args.email,
    sendAt: addDays(args.claimedAt, 1),
    payload: { ...base, daysLeft: UPLOAD_WINDOW_DAYS - 1 },
  })

  await schedule({
    kind: 'upload_reminder_day5',
    dedupeKey: `reminder5:${args.orderId}`,
    recipient: args.email,
    sendAt: addDays(args.claimedAt, 5),
    payload: { ...base, daysLeft: UPLOAD_WINDOW_DAYS - 5 },
  })

  if (args.timeCapsuleNote?.trim()) {
    const claimedOn = args.claimedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
    for (const years of TIME_CAPSULE_YEARS) {
      await schedule({
        kind: 'time_capsule',
        dedupeKey: `capsule:${args.orderId}:${years}`,
        recipient: args.email,
        sendAt: addYears(args.claimedAt, years),
        payload: {
          // No upload token here: a capsule is delivered years after the
          // upload window closed, and the token would be dead weight sitting
          // in the queue for a quarter century.
          squareIndex: args.squareIndex,
          years,
          note: args.timeCapsuleNote,
          claimedAt: claimedOn,
        },
      })
    }
  }
}

/**
 * Once a square is filled, its pending reminders are pointless -- and the
 * upload token they carry is spent. Cancel the sends and strip the token from
 * every queued payload for this order so no live credential lingers in the
 * queue.
 */
export async function cancelUploadReminders(orderId: string): Promise<void> {
  await query(
    `UPDATE scheduled_emails
        SET status = 'cancelled'
      WHERE status = 'pending'
        AND dedupe_key IN ($1, $2)`,
    [`reminder1:${orderId}`, `reminder5:${orderId}`],
  )
  await query(
    `UPDATE scheduled_emails
        SET payload = payload - 'uploadToken'
      WHERE dedupe_key LIKE $1 AND payload ? 'uploadToken'`,
    [`%:${orderId}%`],
  )
}

interface DueRow {
  id: string
  kind: string
  recipient: string
  payload: Record<string, unknown>
  attempts: number
}

const MAX_ATTEMPTS = 5

type Mailer = Awaited<ReturnType<typeof mailer>>

/**
 * Sends one queued row. The row is claimed with a conditional UPDATE first, so
 * two overlapping runs -- the cron and an immediate flush, say -- can never
 * send the same message twice. Returns false if it was already claimed, sent,
 * or failed to send; the row keeps its state either way, so a failure stays
 * pending and the next cron run retries it.
 */
async function dispatchRow(row: DueRow, send: Mailer): Promise<boolean> {
  const claimed = await queryOne<{ id: string }>(
    `UPDATE scheduled_emails
        SET attempts = attempts + 1
      WHERE id = $1 AND status = 'pending'
      RETURNING id`,
    [row.id],
  )
  if (!claimed) return false

  try {
    const message = buildMessage(row)
    if (!message) {
      await query(
        `UPDATE scheduled_emails SET status = 'cancelled', last_error = $2 WHERE id = $1`,
        [row.id, `unknown kind: ${row.kind}`],
      )
      return false
    }
    await send.send(message)
    await query(
      `UPDATE scheduled_emails SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`,
      [row.id],
    )
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const exhausted = row.attempts + 1 >= MAX_ATTEMPTS
    await query(
      `UPDATE scheduled_emails
          SET last_error = $2, status = CASE WHEN $3 THEN 'failed' ELSE status END
        WHERE id = $1`,
      [row.id, message, exhausted],
    )
    return false
  }
}

/**
 * Drains due emails, oldest first, stopping when the time budget runs out.
 *
 * Each send is a sequential network call, and the caller is a serverless
 * function with a hard execution ceiling that varies by hosting plan. Stopping
 * on our own budget means the function returns a truthful result and leaves
 * the rest pending, rather than being killed mid-batch with no idea how far it
 * got. `remaining` is what the run did not reach: a number that stays above
 * zero day after day means the queue is not keeping up.
 */
export async function dispatchDueEmails(
  limit = 50,
  budgetMs = 8_000,
): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  const startedAt = Date.now()
  const due = await query<DueRow>(
    `SELECT id, kind, recipient, payload, attempts
       FROM scheduled_emails
      WHERE status = 'pending' AND send_at <= now() AND attempts < $2
      ORDER BY send_at ASC
      LIMIT $1`,
    [limit, MAX_ATTEMPTS],
  )

  const send = await mailer()
  let sent = 0
  let failed = 0
  let processed = 0

  for (const row of due) {
    // Checked before the send, not after: stopping once already over budget
    // would still allow one more full send past the ceiling.
    if (processed > 0 && Date.now() - startedAt >= budgetMs) break
    processed++
    if (await dispatchRow(row, send)) sent++
    else failed++
  }

  return { sent, failed, remaining: due.length - processed }
}

/**
 * Sends one specific queued email immediately, by dedupe key.
 *
 * The queue is drained by a once-daily cron, which is the right cadence for
 * reminders and time capsules but far too slow for a receipt: the claim
 * confirmation carries the buyer's permanent link to their square, and with no
 * accounts on this site that link is the only way they can find it again.
 * Making somebody wait up to a day for it after paying is not acceptable, and
 * it would silently eat a seventh of their upload window too.
 *
 * Addressed by dedupe key rather than draining the queue, so a backlog of
 * older due rows can never push this one out of the batch.
 *
 * Never throws: the caller is a Stripe webhook, and a mail provider being down
 * must not fail the webhook and trigger a redelivery. A row that does not send
 * here simply stays pending for the next cron run.
 */
export async function dispatchNow(dedupeKey: string): Promise<boolean> {
  try {
    const row = await queryOne<DueRow>(
      `SELECT id, kind, recipient, payload, attempts
         FROM scheduled_emails
        WHERE dedupe_key = $1 AND status = 'pending' AND attempts < $2`,
      [dedupeKey, MAX_ATTEMPTS],
    )
    if (!row) return false
    return await dispatchRow(row, await mailer())
  } catch {
    return false
  }
}

function buildMessage(row: DueRow) {
  const p = row.payload as {
    squareIndex: number
    uploadToken?: string
    daysLeft?: number
    years?: number
    note?: string
    claimedAt?: string
  }
  const ctx = {
    to: row.recipient,
    squareIndex: p.squareIndex,
    uploadToken: p.uploadToken,
  }

  switch (row.kind) {
    case 'claim_confirmation':
      return claimConfirmation(ctx)
    case 'upload_reminder_day1':
      return uploadReminder(ctx, p.daysLeft ?? 6)
    case 'upload_reminder_day5':
      return uploadReminder(ctx, p.daysLeft ?? 2)
    case 'time_capsule':
      return timeCapsule({
        ...ctx,
        note: p.note ?? '',
        years: p.years ?? 1,
        claimedAt: p.claimedAt ?? '',
      })
    default:
      return null
  }
}
