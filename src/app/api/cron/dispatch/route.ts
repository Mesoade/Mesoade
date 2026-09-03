import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { dispatchDueEmails } from '@/lib/scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Drains the scheduled-send queue: upload reminders and time capsules alike.
 * Triggered on a schedule (see vercel.json) and guarded by a shared secret.
 */
async function handle(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${env.cronSecret}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const result = await dispatchDueEmails(100)
  return NextResponse.json({ ok: true, ...result })
}

export const GET = handle
export const POST = handle
