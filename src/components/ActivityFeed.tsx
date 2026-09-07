'use client'

import { useEffect, useState } from 'react'
import { formatSquareLabel } from '@/lib/wall/geometry'
import { categoryLabel } from '@/lib/categories'

interface Item {
  index: number
  claimedAt: string
  state: 'claimed' | 'filled' | 'removed'
  category: string | null
}

/**
 * Real claims only. There is no seeded, simulated, or padded activity here --
 * an empty feed means nobody has claimed a square yet, and it says so.
 */
export default function ActivityFeed({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial)
  const [, forceTick] = useState(0)
  /*
   * "3 seconds ago" is computed from the clock, so the server's render and the
   * client's first render disagree by however long the response took -- a
   * hydration mismatch. Render an absolute date on the server, then swap to
   * relative time once mounted, when there is only one clock in play.
   */
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/activity', { cache: 'no-store' })
        if (res.ok) setItems(((await res.json()) as { items: Item[] }).items)
      } catch {
        // Keep showing what we have.
      }
    }, 20_000)
    // Re-render for the relative timestamps without refetching.
    const tick = setInterval(() => forceTick((n) => n + 1), 10_000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [])

  if (items.length === 0) {
    return (
      <p className="hint">
        No squares claimed yet. The first one is still available.
      </p>
    )
  }

  /*
   * Colours come from classes, not inline styles: this feed renders on the
   * dark wall band, where an inline `color: var(--text)` would win over the
   * band's overrides and paint dark ink on a dark ground.
   */
  return (
    <ul className="feed">
      {items.map((item) => (
        <li key={item.index} className="feed-row">
          <span>
            Someone claimed square{' '}
            <a href={`/s/${item.index}`} className="feed-link num">
              {formatSquareLabel(item.index)}
            </a>
            {item.category && (
              <span className="feed-meta">
                {' · '}
                {categoryLabel(item.category)}
              </span>
            )}
          </span>
          <span className="feed-meta num" suppressHydrationWarning>
            {mounted ? relativeTime(item.claimedAt) : absoluteDate(item.claimedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
