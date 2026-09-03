'use client'

import { useState } from 'react'

/**
 * Sharing points at the square's permanent URL, whose OG image is the branded
 * card. The goal is that what someone posts looks good on its own rather than
 * reading as a screenshot of a website.
 */
export default function ShareLinks({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const text = `${label} of 1,000,000. Mine, permanently.`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        Share on Facebook
      </a>
      <button className="btn btn-ghost" type="button" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  )
}
