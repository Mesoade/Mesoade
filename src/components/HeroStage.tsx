'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { HeroPhoto } from '@/lib/hero-photos'

/**
 * The hero.
 *
 * Three beats, in order, each waiting on the one before it:
 *
 *   1. the headline types in against a near-empty ground;
 *   2. the photo grid arrives as a single group, fading and settling out of a
 *      slight overscale rather than tile by tile -- eighty staggered tiles
 *      would read as a loading screen, not an entrance;
 *   3. the grid becomes draggable.
 *
 * The ordering is the point. The sentence is what somebody is meant to read,
 * so nothing moves behind it until it has been read, and nothing invites a
 * cursor until the sentence is done.
 *
 * All of it collapses to the final state under prefers-reduced-motion: the
 * headline is already typed, the grid is already there, and dragging still
 * works, because dragging is a thing you do rather than a thing done at you.
 */

const LINES = [
  { text: 'You get one.', accent: false },
  { text: 'Forever.', accent: true },
  { text: 'Make it count.', accent: false },
] as const

const CHAR_MS = 42
const LINE_PAUSE_MS = 250
const GRID_DELAY_MS = 220
const GRID_SETTLE_MS = 850

/** Target width of a tile. Drives how many columns the grid uses. */
const TILE_PX = 118
const MIN_COLS = 3
const MAX_COLS = 14

type Phase = 'typing' | 'grid' | 'live'

interface Props {
  photos: HeroPhoto[]
  claimed: number
  total: number
  priceDisplay: string
  brand: string
}

/**
 * A stable warm tone for a tile with no photograph behind it. Deterministic
 * from the id, so the field does not reshuffle its colours on every render.
 */
function toneFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const hue = 18 + (h % 26) // a narrow band of browns and ambers
  const sat = 12 + (h % 17)
  const light = 9 + (h % 13)
  return `hsl(${hue} ${sat}% ${light}%)`
}

function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/** Framer hands back whichever event type the pointer produced. */
function pointerPoint(e: MouseEvent | TouchEvent | PointerEvent) {
  if ('touches' in e) {
    const t = e.touches[0] ?? e.changedTouches[0]
    return t ? { x: t.clientX, y: t.clientY } : null
  }
  return { x: e.clientX, y: e.clientY }
}

export default function HeroStage({
  photos,
  claimed,
  total,
  priceDisplay,
  brand,
}: Props) {
  const reduced = useReducedMotion()

  // ---- the headline ------------------------------------------------------

  const { chars, offsets } = useMemo(() => {
    const offs: number[] = []
    let n = 0
    for (const line of LINES) {
      offs.push(n)
      n += line.text.length
    }
    return { chars: n, offsets: offs }
  }, [])

  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')

  useEffect(() => {
    if (reduced) {
      setTyped(chars)
      setPhase('live')
      return
    }

    let typing: ReturnType<typeof setTimeout>
    let toGrid: ReturnType<typeof setTimeout>
    let toLive: ReturnType<typeof setTimeout>

    const step = (i: number) => {
      if (i >= chars) {
        toGrid = setTimeout(() => {
          setPhase('grid')
          toLive = setTimeout(() => setPhase('live'), GRID_SETTLE_MS)
        }, GRID_DELAY_MS)
        return
      }
      setTyped(i + 1)
      // A beat at each line break, so the three sentences land as three
      // sentences rather than one long run of characters.
      const endsLine = offsets.includes(i + 1)
      typing = setTimeout(() => step(i + 1), endsLine ? LINE_PAUSE_MS : CHAR_MS)
    }

    typing = setTimeout(() => step(0), 320)
    return () => {
      clearTimeout(typing)
      clearTimeout(toGrid)
      clearTimeout(toLive)
    }
  }, [chars, offsets, reduced])

  const typingDone = typed >= chars

  // ---- the grid ----------------------------------------------------------

  const pool = useMemo(() => {
    if (photos.length > 0) return photos
    /*
     * No photos: a tonal field rather than an empty hero. The grid is behind a
     * dark veil and carries no information, so losing the images costs the
     * page texture, not meaning.
     */
    return Array.from({ length: 72 }, (_, i) => ({
      id: `tone-${i}`,
      src: '',
      alt: '',
      credit: '',
      creditUrl: '',
    }))
  }, [photos])

  const [order, setOrder] = useState<string[]>(() => pool.map((p) => p.id))
  const orderRef = useRef(order)
  orderRef.current = order

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool])

  const gridRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(8)
  const colsRef = useRef(cols)
  colsRef.current = cols

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (!w) return
      setCols(Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(w / TILE_PX))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [dragging, setDragging] = useState<string | null>(null)

  /**
   * Which slot the pointer is over.
   *
   * The grid is uniform, so this is arithmetic on the container's box rather
   * than a hit test against eighty elements -- and it stays correct while the
   * tiles are mid-flight, which hit-testing moving targets would not.
   */
  const slotAt = useCallback((x: number, y: number): number | null => {
    const el = gridRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const c = colsRef.current
    const cell = r.width / c
    if (cell <= 0) return null
    const col = Math.floor((x - r.left) / cell)
    const row = Math.floor((y - r.top) / cell)
    if (col < 0 || col >= c || row < 0) return null
    const index = row * c + col
    if (index < 0 || index >= orderRef.current.length) return null
    return index
  }, [])

  const onDrag = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, id: string) => {
      const pt = pointerPoint(e)
      if (!pt) return
      const target = slotAt(pt.x, pt.y)
      if (target === null) return
      const from = orderRef.current.indexOf(id)
      if (from === -1 || from === target) return
      setOrder(arrayMove(orderRef.current, from, target))
    },
    [slotAt],
  )

  const gridVisible = phase !== 'typing'
  const interactive = phase === 'live'

  return (
    <section className="stage">
      {/* Decorative throughout: no claim, no square, no live data. */}
      <div className="stage-field" aria-hidden="true">
        <motion.div
          ref={gridRef}
          className="stage-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          initial={false}
          animate={{
            opacity: gridVisible ? 1 : 0,
            // No overscale to settle out of when motion is unwelcome: the
            // grid simply is there.
            scale: gridVisible || reduced ? 1 : 1.06,
          }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.95, ease: [0.23, 1, 0.32, 1] }
          }
        >
          {order.map((id) => {
            const photo = byId.get(id)
            if (!photo) return null
            return (
              <motion.div
                key={id}
                layout
                className="stage-tile"
                data-dragging={dragging === id}
                data-live={interactive}
                drag={interactive}
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0.1}
                onDragStart={() => setDragging(id)}
                onDrag={(e) => onDrag(e, id)}
                onDragEnd={() => setDragging(null)}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', duration: 0.42, bounce: 0.16 }
                }
                style={{ zIndex: dragging === id ? 30 : 1 }}
              >
                {photo.src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={photo.src} alt="" draggable={false} loading="eager" />
                ) : (
                  <span
                    className="stage-tone"
                    style={{ background: toneFor(id) }}
                  />
                )}
              </motion.div>
            )
          })}
        </motion.div>
        {/* One veil over the whole grid rather than per-image processing, and
            transparent to the pointer so it cannot swallow a drag. */}
        <div className="stage-veil" />
      </div>

      <header className="stage-nav">
        <a className="stage-mark" href="/">
          <span className="stage-mark-glyph" aria-hidden="true" />
          {brand}
        </a>
        <nav className="stage-links">
          <a href="#rules">The rules</a>
          <a href="#how">How it works</a>
          <a href="#wall">The wall</a>
        </nav>
        <a className="stage-nav-cta" href="/claim">
          Claim — {priceDisplay}
        </a>
      </header>

      <div className="stage-inner">
        <p className="stage-eyebrow" data-on={typed > 0}>
          {total.toLocaleString('en-US')} squares
        </p>

        <h1
          className="stage-title"
          aria-label={LINES.map((l) => l.text).join(' ')}
        >
          {LINES.map((line, li) => (
            <span
              key={line.text}
              className="stage-line"
              data-accent={line.accent}
            >
              {Array.from(line.text).map((ch, ci) => {
                const at = offsets[li]! + ci
                return (
                  <span
                    key={ci}
                    className="stage-char"
                    data-on={at < typed}
                    aria-hidden="true"
                  >
                    {ch === ' ' ? ' ' : ch}
                  </span>
                )
              })}
              {!typingDone &&
                typed > offsets[li]! &&
                typed <= offsets[li]! + line.text.length && (
                  <span className="stage-caret" aria-hidden="true" />
                )}
            </span>
          ))}
        </h1>

        <div className="stage-actions" data-on={typingDone}>
          <a className="stage-cta" href="/claim">
            Claim your square — {priceDisplay}
          </a>
          <a className="stage-quiet" href="#how">
            How it works <span aria-hidden="true">↓</span>
          </a>
        </div>

        {/* A real count of real rows -- see getStats(). */}
        <p className="stage-stat" data-on={typingDone}>
          <span className="stage-dot" aria-hidden="true" />
          <span className="stage-count">{claimed.toLocaleString('en-US')}</span>
          {' of '}
          {total.toLocaleString('en-US')} claimed
        </p>
      </div>
    </section>
  )
}
