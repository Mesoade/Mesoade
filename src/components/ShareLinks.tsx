'use client'

import { useEffect, useState } from 'react'

/**
 * Sharing points at the square's permanent URL, whose link preview is the
 * generated card. The goal is that what someone posts looks like a thing in
 * its own right rather than a screenshot of a website.
 *
 * On a phone the whole row collapses to the system share sheet, which already
 * holds every app the person actually uses and puts them one tap from the one
 * they want. The explicit buttons are for pointers that have no such sheet.
 */
export default function ShareLinks({
  url,
  label,
  brand,
  total,
}: {
  url: string
  /** The square's number, e.g. "#4". */
  label: string
  brand: string
  total: string
}) {
  const [copied, setCopied] = useState(false)
  const [native, setNative] = useState(false)

  const text = `I just claimed square ${label} of ${total} on ${brand}. One per person, forever. Which photo would you choose?`

  useEffect(() => {
    // Both conditions: desktop Safari and Edge have a share sheet too, and
    // replacing a visible row of choices with one button is only an
    // improvement where tapping through apps is how sharing is done.
    setNative(
      typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    )
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ text, url })
    } catch {
      // Dismissing the sheet rejects, and is not a failure worth reporting.
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {native ? (
        <button className="btn btn-ghost" type="button" onClick={shareNative}>
          Share
        </button>
      ) : (
        <>
          <a
            className="btn btn-ghost"
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Share on X
          </a>
          <a
            className="btn btn-ghost"
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Share on WhatsApp
          </a>
          {/* Facebook strips any prefilled text, so it gets the link alone and
              relies on the Open Graph tags for everything else. */}
          <a
            className="btn btn-ghost"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Share on Facebook
          </a>
        </>
      )}
      <button className="btn btn-ghost" type="button" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
