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

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li
          key={item.index}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            padding: '11px 0',
            borderBottom: '1px solid var(--border)',
            fontSize: 15,
          }}
        >
          <span>
            Someone claimed square{' '}
            <a href={`/s/${item.index}`} style={{ color: 'var(--text)' }}>
              {formatSquareLabel(item.index)}
            </a>
            {item.category && (
              <span style={{ color: 'var(--text-faint)' }}>
                {' · '}
                {categoryLabel(item.category)}
              </span>
            )}
          </span>
          <span style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {relativeTime(item.claimedAt)}
          </span>
        </li>
      ))}
    </ul>
  )
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
