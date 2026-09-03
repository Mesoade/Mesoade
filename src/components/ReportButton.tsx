'use client'

import { useState } from 'react'

const REASONS = [
  { id: 'sexual', label: 'Sexually explicit' },
  { id: 'illegal', label: 'Illegal content' },
  { id: 'hate', label: 'Hate speech or harassment' },
  { id: 'scam', label: 'Scam or fraudulent claim' },
  { id: 'private_info', label: "Someone's private information" },
  { id: 'copyright', label: 'Copyright or trademark infringement' },
  { id: 'other', label: 'Something else' },
]

/** Visible to any visitor, on every square. No login required to report. */
export default function ReportButton({ squareIndex }: { squareIndex: number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (done) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        Thanks — a moderator will review this square.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-faint)',
          fontSize: 13,
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Report this square
      </button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squareIndex, reason, details }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? 'Could not submit that report.')
        setBusy(false)
        return
      }
      setDone(true)
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 20, marginTop: 12 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Report this square</h3>
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>What&apos;s wrong with it?</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Choose a reason</option>
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Anything else we should know? <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
        </span>
        <textarea
          value={details}
          maxLength={1000}
          onChange={(e) => setDetails(e.target.value)}
        />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" type="submit" disabled={busy || !reason}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
