'use client'

import { useRef, useState } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { MAX_CAPTION_LENGTH, MAX_UPLOAD_BYTES } from '@/lib/image'
import { shrinkForUpload } from '@/lib/shrink-image'

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
  const [category, setCategory] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [shrunk, setShrunk] = useState(false)
  /** What actually gets uploaded: the original, or a smaller redraw of it. */
  const uploadRef = useRef<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    setError(null)
    setShrunk(false)
    uploadRef.current = null
    if (!picked) {
      setPreview(null)
      setFileName(null)
      return
    }

    // Shrink first, then judge the size: an iPhone hands over a JPEG two or
    // three times the size of the HEIC its owner saw, so the file as picked is
    // not the file worth refusing.
    setPreparing(true)
    let file = picked
    try {
      file = await shrinkForUpload(picked)
    } catch {
      // Undecodable here is not necessarily undecodable on the server, and the
      // server gives a better message about formats than we can.
      file = picked
    }
    setPreparing(false)

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That photo is too large to upload, even after resizing. Try a smaller one.`,
      )
      setPreview(null)
      setFileName(null)
      return
    }

    uploadRef.current = file
    setShrunk(file !== picked)
    setFileName(picked.name)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const file = uploadRef.current ?? fileRef.current?.files?.[0]
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
    form.set('category', category)
    if (token) form.set('token', token)
    if (sessionId) form.set('sessionId', sessionId)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      // A rejection by the platform rather than by this app -- a body over the
      // size limit, say -- comes back as HTML, and parsing it as JSON used to
      // throw into the catch below. That reported a perfectly healthy server
      // as unreachable, and hid a real 413 for as long as it took to read the
      // request log.
      let body: { ok?: boolean; error?: string; squareUrl?: string } = {}
      try {
        body = (await res.json()) as typeof body
      } catch {
        body = {}
      }
      if (!res.ok || !body.ok) {
        setError(
          body.error ??
            (res.status === 413
              ? 'That photo is too large to upload. Try a smaller one.'
              : `Upload failed (${res.status}). Please try again.`),
        )
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
      {error && <div className="error enter-soft">{error}</div>}

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
        JPEG, PNG, WebP, or GIF. Large photos are resized automatically.
        {preparing && ' Preparing your photo…'}
        {shrunk && !preparing && ' Resized to upload.'}
      </p>

      {preview && (
        <div className="enter-photo" style={{ marginBottom: 22 }}>
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
              // Matches how the wall draws it: the whole photo, fitted, never
              // cropped. A preview that crops would misrepresent the one
              // irreversible decision this form exists to take.
              objectFit: 'contain',
              background: 'var(--paper-sunk)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'block',
            }}
          />
        </div>
      )}

      <label className="field">
        <span>
          What is your story
        </span>
        <textarea
          value={caption}
          maxLength={MAX_CAPTION_LENGTH}
          onChange={(e) => setCaption(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {caption.length}/{MAX_CAPTION_LENGTH}
        </span>
      </label>

      <label className="field">
        <span>
          Category <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
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
          This photo and my story behind it can never be changed or removed by
          me, and I have the right to publish this image.
        </span>
      </label>

      <button className="btn" type="submit" disabled={busy || preparing || !confirmed}>
        {busy ? 'Uploading…' : preparing ? 'Preparing…' : 'Lock it in, forever'}
      </button>
    </form>
  )
}
