'use client'

import { useEffect, useState } from 'react'
import { formatSquareLabel } from '@/lib/wall/geometry'

type State = 'processing' | 'assigned' | 'duplicate' | 'unpaid' | 'unknown'

/**
 * Bridges the gap between Stripe redirecting the buyer back and the webhook
 * finishing assignment. Usually a fraction of a second; occasionally longer.
 */
export default function ClaimSuccess({ sessionId }: { sessionId: string | null }) {
  const [state, setState] = useState<State>(sessionId ? 'processing' : 'unknown')
  const [squareIndex, setSquareIndex] = useState<number | null>(null)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let attempts = 0

    async function poll() {
      attempts++
      try {
        const res = await fetch(
          `/api/claim-status?session_id=${encodeURIComponent(sessionId!)}`,
          { cache: 'no-store' },
        )
        const body = (await res.json()) as { state?: State; squareIndex?: number }
        if (cancelled) return
        if (body.state === 'assigned' && typeof body.squareIndex === 'number') {
          setSquareIndex(body.squareIndex)
          setState('assigned')
          return
        }
        if (body.state && body.state !== 'processing') setState(body.state)
      } catch {
        // Keep waiting; the webhook is the source of truth either way.
      }
      if (cancelled) return
      if (attempts > 8) setSlow(true)
      // Back off gently rather than hammering.
      setTimeout(poll, Math.min(1000 + attempts * 400, 4000))
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (state === 'assigned' && squareIndex !== null) {
    /*
     * This swap happens once in a person's life, after a wait they have been
     * watching. Letting the answer fade up rather than replacing the "assigning
     * your square" text between two frames is the whole delight budget for this
     * flow, and it is spent here rather than on the marketing page.
     */
    return (
      <div className="enter-photo">
        <h1 style={{ fontSize: 34, letterSpacing: '-.025em', margin: '0 0 12px' }}>
          Square {formatSquareLabel(squareIndex)} is yours.
        </h1>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, fontSize: 17 }}>
          Permanently. It will never be resold or reassigned, whatever you do
          next.
        </p>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
          Now the part that matters. You have 7 days to upload one photo, and
          once you do, it is locked forever — there is no edit, no replace, no
          undo. Take your time.
        </p>
        <p style={{ margin: '28px 0' }}>
          <a
            className="btn"
            href={`/upload/${squareIndex}?session_id=${encodeURIComponent(sessionId ?? '')}`}
          >
            Upload your photo
          </a>
        </p>
        <p className="hint">
          We&apos;ve emailed you this link too, so you can close this tab and
          come back when you&apos;ve decided.
        </p>
      </div>
    )
  }

  if (state === 'duplicate') {
    return (
      <>
        <h1 style={{ fontSize: 30, letterSpacing: '-.02em', margin: '0 0 12px' }}>
          You already have a square.
        </h1>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
          Everyone gets exactly one, so this payment did not get a second one.
          We&apos;ve flagged it for review — reply to your receipt email and
          we&apos;ll sort it out with you.
        </p>
      </>
    )
  }

  if (state === 'unpaid' || state === 'unknown') {
    return (
      <>
        <h1 style={{ fontSize: 30, letterSpacing: '-.02em', margin: '0 0 12px' }}>
          We couldn&apos;t confirm that payment.
        </h1>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
          If you were charged, your square is safe and the confirmation email is
          on its way. If nothing arrives, reply to your Stripe receipt.
        </p>
        <p style={{ marginTop: 24 }}>
          <a className="btn btn-ghost" href="/">
            Back to the wall
          </a>
        </p>
      </>
    )
  }

  return (
    <>
      <h1 style={{ fontSize: 30, letterSpacing: '-.02em', margin: '0 0 12px' }}>
        Payment received. Assigning your square…
      </h1>
      <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
        This normally takes a second or two.
      </p>
      {slow && (
        <p className="hint" style={{ marginTop: 20 }}>
          Still working. Your square is reserved either way — the confirmation
          email will have the link, so it is safe to close this tab.
        </p>
      )}
    </>
  )
}
