import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { dispatchDueEmails } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Sends are sequential network calls, and the daily schedule means a whole
// day's reminders arrive in one batch. The default 10s ceiling would cut that
// batch short and leave the remainder for tomorrow.
export const maxDuration = 60

/**
 * Drains the scheduled-send queue: upload reminders and time capsules alike.
 * Triggered on a schedule (see vercel.json) and guarded by a shared secret.
 *
 * This runs once a day, so the batch has to cover a full day of claims rather
 * than an hour of them. 150 is what fits inside maxDuration at realistic
 * per-send latency; beyond roughly 150 claims a day the queue would start
 * carrying a backlog into the next run, and the schedule needs revisiting --
 * which on Vercel means a paid plan, since the free tier only allows daily
 * crons. Nothing time-critical is in here: the claim confirmation is sent
 * immediately by the Stripe webhook, not by this job.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${env.cronSecret}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const result = await dispatchDueEmails(150)
  return NextResponse.json({ ok: true, ...result })
}

export const GET = handle
export const POST = handle
