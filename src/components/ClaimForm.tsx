'use client'

import { useState } from 'react'
import { SQUARE_PRICE_DISPLAY } from '@/lib/env'

const MAX_NOTE = 480

export default function ClaimForm() {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExisting(null)
    setBusy(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, timeCapsuleNote: note || null, agreed }),
      })
      const body = (await res.json()) as {
        url?: string
        error?: string
        existingSquare?: number
      }
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong.')
        if (typeof body.existingSquare === 'number') setExisting(body.existingSquare)
        setBusy(false)
        return
      }
      if (body.url) window.location.href = body.url
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="error enter-soft">
          {error}
          {existing !== null && (
            <>
              {' '}
              <a href={`/s/${existing}`} style={{ color: 'inherit', fontWeight: 600 }}>
                Go to your square →
              </a>
            </>
          )}
        </div>
      )}

      <label className="field">
        <span>Your email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>
      <p className="hint" style={{ marginTop: -10, marginBottom: 18 }}>
        Used for your receipt and for the link back to your square. There are no
        accounts, so this email is the only way to find your square again.
      </p>

      <label className="field">
        <span>
          Leave a note for your future self <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
        </span>
        <textarea
          value={note}
          maxLength={MAX_NOTE}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Something you want to hear again in 25 years."
        />
      </label>
      <p className="hint" style={{ marginTop: -10, marginBottom: 22 }}>
        We&apos;ll email it back to you in 1, 5, 10, and 25 years. We&apos;ll do
        our best to reach you — but a quarter of a century is a long time for an
        email address to survive, so treat it as a nice intention rather than a
        promise.
      </p>

      <label
        style={{
          display: 'flex',
          gap: 11,
          alignItems: 'flex-start',
          marginBottom: 22,
          fontSize: 14,
          color: 'var(--text-dim)',
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3 }}
          required
        />
        <span>
          I&apos;m 18 or over, and I understand that my photo is{' '}
          <strong style={{ color: 'var(--text)' }}>locked forever</strong> once
          uploaded, that I get{' '}
          <strong style={{ color: 'var(--text)' }}>exactly one square</strong>,
          and that there are{' '}
          <strong style={{ color: 'var(--text)' }}>no refunds</strong> for any
          reason. I agree to the <a href="/terms">Terms</a> and{' '}
          <a href="/content-policy">content policy</a>.
        </span>
      </label>

      <button className="btn" type="submit" disabled={busy || !agreed}>
        {busy ? 'Taking you to checkout…' : `Continue to payment — ${SQUARE_PRICE_DISPLAY}`}
      </button>
    </form>
  )
}
