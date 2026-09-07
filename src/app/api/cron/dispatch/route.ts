import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { dispatchDueEmails } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/*
 * Deliberately no `maxDuration` export. The ceiling a plan allows differs
 * between Vercel tiers, and a value above it is rejected at build time -- a
 * deploy-breaking setting is a bad thing to hard-code. The job keeps itself
 * inside whatever limit applies instead, by stopping on a time budget and
 * leaving the rest of the queue for the next run.
 */
const BUDGET_MS = 8_000

/**
 * Drains the scheduled-send queue: upload reminders and time capsules alike.
 * Triggered on a schedule (see vercel.json) and guarded by a shared secret.
 *
 * This runs once a day, so the batch has to cover a full day of claims rather
 * than an hour of them. It drains up to 150, stopping early if it runs out of
 * time budget; whatever is left stays pending and goes out on the next run.
 * The response reports `remaining`, so a queue that is not keeping up is
 * visible rather than silent.
 *
 * Nothing time-critical is in here: the claim confirmation is sent immediately
 * by the Stripe webhook, not by this job.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${env.cronSecret}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const result = await dispatchDueEmails(150, BUDGET_MS)
  return NextResponse.json({ ok: true, ...result })
}

export const GET = handle
export const POST = handle
