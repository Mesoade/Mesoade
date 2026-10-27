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
 *   2. the photographs are thrown at the wall -- each one falls in on its own,
 *      tumbled out of the plane and off its cell, overlapping its neighbours,
 *      and then straightens into the grid;
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
const GRID_DELAY_MS = 170

/**
 * The scatter. Each tile falls for FLIGHT_MS; the starts are spread evenly
 * across STAGGER_MS in a scrambled order, so the field arrives everywhere at
 * once rather than sweeping in from a side. The last tile lands at the sum of
 * the two, which is when the grid becomes draggable.
 */
const STAGGER_MS = 1000
const FLIGHT_MS = 820
const GRID_SETTLE_MS = STAGGER_MS + FLIGHT_MS + 60

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

/**
 * A stable number in [0, 1) from an id and a salt. Deterministic, so a tile's
 * fall is the same on the server and the client and does not change when the
 * component re-renders mid-flight.
 */
function rand(seed: string, salt: number): number {
  const s = `${seed}:${salt}`
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return (h >>> 8) / 16777216
}

interface Flight {
  /** Offset from the tile's own cell, as a percentage of its own size. */
  dx: number
  dy: number
  /** In the plane, and out of it. */
  rot: number
  rx: number
  ry: number
  scale: number
  /** Seconds. */
  delay: number
  z: number
}

/**
 * Whether this device drives a real cursor.
 *
 * Framer's pan listeners are passive and it never calls preventDefault, so the
 * only thing that can stop a drag from eating a scroll is CSS `touch-action`
 * -- and on a phone the field covers the whole first screen, so any setting
 * that lets the tile have the gesture takes the page's scroll with it. A thumb
 * swipe arcs rather than running straight up, so even `pan-y` hands a good
 * share of ordinary scrolls to the drag.
 *
 * So the rearranging is for pointers that can hover and click precisely. It is
 * the same test the hover outline uses, which means a touchscreen was never
 * told the tiles could be moved in the first place.
 */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setFine(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return fine
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

  const gridRef = useRef<HTMLDivElement>(null)
  const [{ cols, count }, setLayout] = useState({ cols: 8, count: 64 })
  const colsRef = useRef(cols)
  colsRef.current = cols

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w) return
      const c = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(w / TILE_PX)))
      // One row past the bottom edge, so the field runs out after the stage
      // does rather than leaving a bare strip under the headline.
      const rows = Math.max(1, Math.ceil(h / (w / c)) + 1)
      setLayout((prev) =>
        prev.cols === c && prev.count === c * rows
          ? prev
          : { cols: c, count: c * rows },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /*
   * The field is sized to the stage, not to the photo list, so the photographs
   * repeat to fill it. Each repeat gets its own id: two copies of one
   * photograph are two independent tiles, and dragging one must not move the
   * other.
   */
  const slots = useMemo(() => {
    const n = pool.length
    if (n === 0 || count === 0) return []
    return Array.from({ length: count }, (_, i) => {
      const photo = pool[i % n]!
      return { id: `${photo.id}#${Math.floor(i / n)}`, photo }
    })
  }, [pool, count])

  const byId = useMemo(() => new Map(slots.map((s) => [s.id, s.photo])), [slots])

  const [order, setOrder] = useState<string[]>(() => slots.map((s) => s.id))
  const orderRef = useRef(order)
  orderRef.current = order

  // Only when the field's shape actually changes: a resize that leaves the
  // tile count alone must not undo somebody's rearranging.
  const shape = `${pool.length}:${count}`
  const shapeRef = useRef(shape)
  useEffect(() => {
    if (shapeRef.current === shape) return
    shapeRef.current = shape
    setOrder(slots.map((s) => s.id))
  }, [shape, slots])

  /*
   * Where each tile falls from.
   *
   * The displacements are a percentage of a tile rather than a pixel count, so
   * the scatter is the same shape at any column width. The delays are spread
   * evenly over the stagger but handed out in a scrambled order: evenly spaced
   * so the arrival rate is steady, scrambled so neighbours do not land
   * together and give the eye a direction to follow.
   */
  const flights = useMemo(() => {
    const ids = slots.map((s) => s.id)
    const rank = new Map<string, number>()
    ids
      .slice()
      .sort((a, b) => rand(a, 7) - rand(b, 7))
      .forEach((id, i) => rank.set(id, i))

    const span = Math.max(1, ids.length - 1)
    const out = new Map<string, Flight>()
    for (const id of ids) {
      out.set(id, {
        dx: (rand(id, 1) - 0.5) * 90,
        dy: (rand(id, 2) - 0.5) * 90,
        rot: (rand(id, 3) - 0.5) * 52,
        rx: (rand(id, 4) - 0.5) * 76,
        ry: (rand(id, 5) - 0.5) * 76,
        scale: 1.03 + rand(id, 6) * 0.09,
        delay: ((rank.get(id) ?? 0) / span) * (STAGGER_MS / 1000),
        // Arbitrary, stable depth so the overlaps during the fall do not all
        // stack the same way down the page.
        z: 1 + Math.floor(rand(id, 8) * 12),
      })
    }
    return out
  }, [slots])

  const finePointer = useFinePointer()
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
  // Settled, and on a device where taking the gesture costs nothing.
  const interactive = phase === 'live' && finePointer

  return (
    <section className="stage">
      {/* Decorative throughout: no claim, no square, no live data. */}
      <div className="stage-field" aria-hidden="true">
        <div
          ref={gridRef}
          className="stage-grid"
          data-phase={phase}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {order.map((id) => {
            const photo = byId.get(id)
            const flight = flights.get(id)
            if (!photo || !flight) return null
            return (
              /*
               * Two elements, because two different things move this tile and
               * they each want the transform to themselves. The outer one is
               * the cell: it holds the drag and the layout animation that
               * slides neighbours aside. The inner one is the photograph, and
               * all it ever does is fall into place.
               */
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
                style={{ zIndex: dragging === id ? 30 : flight.z }}
              >
                <motion.div
                  className="stage-tile-fly"
                  initial={false}
                  animate={gridVisible ? 'landed' : 'falling'}
                  variants={{
                    falling: {
                      opacity: 0,
                      x: `${flight.dx}%`,
                      y: `${flight.dy}%`,
                      rotate: flight.rot,
                      rotateX: flight.rx,
                      rotateY: flight.ry,
                      scale: flight.scale,
                    },
                    landed: {
                      opacity: 1,
                      x: '0%',
                      y: '0%',
                      rotate: 0,
                      rotateX: 0,
                      rotateY: 0,
                      scale: 1,
                    },
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: FLIGHT_MS / 1000,
                          delay: flight.delay,
                          // Decelerating, no overshoot: these are settling,
                          // not bouncing. Gentle enough that the tumble is
                          // still visible once the tile has faded up -- a
                          // sharper curve spends the whole rotation before
                          // there is anything on screen to rotate.
                          ease: [0.33, 1, 0.68, 1],
                          // Visible almost at once, for the same reason.
                          opacity: {
                            duration: 0.14,
                            delay: flight.delay,
                            ease: 'linear',
                          },
                        }
                  }
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
              </motion.div>
            )
          })}
        </div>
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
