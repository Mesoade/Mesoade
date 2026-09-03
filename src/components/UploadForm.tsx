'use client'

import { useRef, useState } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { MAX_CAPTION_LENGTH, MAX_UPLOAD_BYTES } from '@/lib/image'
import { formatSquareLabel } from '@/lib/wall/geometry'

interface Props {
  squareIndex: number
  token: string | null
  sessionId: string | null
}

export default function UploadForm({ squareIndex, token, sessionId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setError(null)
    if (!file) {
      setPreview(null)
      setFileName(null)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is over ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`)
      setPreview(null)
      setFileName(null)
      return
    }
    setFileName(file.name)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose a photo first.')
      return
    }
    setError(null)
    setBusy(true)

    const form = new FormData()
    form.set('squareIndex', String(squareIndex))
    form.set('image', file)
    form.set('caption', caption)
    form.set('link', link)
    form.set('category', category)
    if (token) form.set('token', token)
    if (sessionId) form.set('sessionId', sessionId)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const body = (await res.json()) as { ok?: boolean; error?: string; squareUrl?: string }
      if (!res.ok || !body.ok) {
        setError(body.error ?? 'Upload failed. Please try again.')
        setBusy(false)
        return
      }
      window.location.href = body.squareUrl ?? `/s/${squareIndex}`
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="error">{error}</div>}

      {/*
        The prompt at the moment of upload shapes what people submit far more
        than any ad they saw first. This is why it sits directly above the box.
      */}
      <div
        style={{
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          padding: '20px 22px',
          marginBottom: 22,
          background: 'var(--bg-input)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 19,
            lineHeight: 1.5,
            letterSpacing: '-.01em',
          }}
        >
          If you could only ever post one photo online, permanently, which would
          it be?
        </p>
        <p style={{ margin: '10px 0 0', color: 'var(--text-faint)', fontSize: 14, lineHeight: 1.6 }}>
          This is square {formatSquareLabel(squareIndex)}, and this is the only
          time you will ever choose. There is no edit button afterwards.
        </p>
      </div>

      <label className="field">
        <span>Your one photo</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPick}
          required
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 8,
            color: 'var(--text-dim)',
            padding: '22px 16px',
            fontSize: 14,
          }}
        />
      </label>
      <p className="hint" style={{ marginTop: -8, marginBottom: 18 }}>
        JPEG, PNG, WebP, or GIF. Up to{' '}
        {Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Squares are square, so
        it will be shown cropped to a square.
      </p>

      {preview && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 8 }}>
            {fileName}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Your selected photo"
            style={{
              width: 190,
              height: 190,
              objectFit: 'cover',
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'block',
            }}
          />
        </div>
      )}

      <label className="field">
        <span>
          Caption <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
        </span>
        <textarea
          value={caption}
          maxLength={MAX_CAPTION_LENGTH}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A line about what this is, or why it's this one."
        />
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {caption.length}/{MAX_CAPTION_LENGTH}
        </span>
      </label>

      <label className="field">
        <span>
          What is this? <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
        </span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Prefer not to say</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Lets people browse the wall by theme.
        </span>
      </label>

      <label className="field">
        <span>
          Link <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
        </span>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://"
        />
      </label>

      <label
        style={{
          display: 'flex',
          gap: 11,
          alignItems: 'flex-start',
          margin: '24px 0',
          fontSize: 14,
          color: 'var(--text-dim)',
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ marginTop: 3 }}
          required
        />
        <span>
          I understand this is{' '}
          <strong style={{ color: 'var(--text)' }}>permanent and final</strong>.
          This photo, caption, and link can never be changed or removed by me,
          and I have the right to publish this image.
        </span>
      </label>

      <button className="btn" type="submit" disabled={busy || !confirmed}>
        {busy ? 'Uploading…' : 'Lock it in, forever'}
      </button>
    </form>
  )
}
