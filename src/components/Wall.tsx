'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GRID_SIZE,
  TOTAL_SQUARES,
  cellToIndex,
  formatSquareLabel,
  ringBounds,
} from '@/lib/wall/geometry'
import { CATEGORIES } from '@/lib/categories'

/**
 * The wall.
 *
 * A million DOM elements is not survivable, so this is a canvas that draws only
 * what is currently on screen. Three layers, back to front:
 *
 *   1. The locked remainder -- the full 1,000,000-cell boundary, always drawn,
 *      and textured with a fine dot pattern rather than left flat, so it reads
 *      as "not open yet" instead of as empty or broken. Nothing in it is
 *      claimed or claimable, and showing it is the honest way to convey the
 *      scale of "one million" without implying the wall is fuller than it is.
 *   2. The active ring -- the region currently being sold. Drawn as a plain,
 *      untextured field inside an ember frontier line, so the boundary between
 *      "you can buy here" and "not yet" is visible at a glance.
 *   3. Claimed cells -- images where a photo exists, the neutral treatment for
 *      squares that are blank or whose content was removed. Cell edges are
 *      snapped to whole device pixels and drawn edge to edge, with no lattice
 *      over them, so a filled area reads as one continuous photo mosaic rather
 *      than as a grid of tiles.
 *
 * Images are only requested once a cell is large enough on screen to be worth
 * seeing, and are cached with a hard cap so a long pan cannot exhaust memory.
 */

interface Cell {
  i: number
  x: number
  y: number
  s: 0 | 1
  k: string | null
  c: string | null
}

interface WallProps {
  storageBaseUrl: string
  activeRing: number
  initialCells: Cell[]
}

const MIN_SCALE = 0.35 // whole wall fits comfortably
const MAX_SCALE = 40 // a single square fills a good chunk of the viewport
const IMAGE_SCALE_THRESHOLD = 7 // px per cell before images are worth loading
const IMAGE_CACHE_CAP = 900
const DOT_SPACING = 6 // px between locked-region dots, in screen space

export default function Wall({ storageBaseUrl, activeRing, initialCells }: WallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const cellsRef = useRef<Map<number, Cell>>(
    new Map(initialCells.map((c) => [c.i, c])),
  )
  const imagesRef = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(new Map())
  const dotsRef = useRef<{ pattern: CanvasPattern | null; dpr: number } | null>(null)
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 })
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef<{
    dragging: boolean
    moved: boolean
    lastX: number
    lastY: number
  }>({ dragging: false, moved: false, lastX: 0, lastY: 0 })

  const [category, setCategory] = useState<string>('')
  const [hovered, setHovered] = useState<Cell | null>(null)
  const [ready, setReady] = useState(false)

  // ---- drawing ------------------------------------------------------------

  const draw = useCallback(() => {
    frameRef.current = null
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
    }

    const { scale, offsetX, offsetY } = viewRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const styles = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback
    const colBg = read('--wall-bg', '#1b1511')
    const colLocked = read('--wall-locked', '#28201a')
    const colOpen = read('--wall-open', '#322820')
    const colDot = read('--wall-dot', '#46372a')
    const colBlank = read('--wall-blank', '#544639')
    const colTile = read('--wall-tile', '#c9a98c')
    const colRing = read('--wall-ring', '#c2542b')

    ctx.fillStyle = colBg
    ctx.fillRect(0, 0, cssW, cssH)

    const gridX = offsetX
    const gridY = offsetY
    const gridW = GRID_SIZE * scale
    const gridH = GRID_SIZE * scale

    // Layer 1: the full million-cell field, locked.
    ctx.fillStyle = colLocked
    ctx.fillRect(gridX, gridY, gridW, gridH)

    // The locked region's texture. Fixed in screen space at DOT_SPACING so the
    // density stays legible from "whole wall" out to "one square", and offset
    // by the pan so it travels with the wall instead of sitting on the glass.
    if (!dotsRef.current || dotsRef.current.dpr !== dpr) {
      dotsRef.current = { pattern: buildDotPattern(ctx, colDot, dpr), dpr }
    }
    const dots = dotsRef.current.pattern
    if (dots) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(gridX, gridY, gridW, gridH)
      ctx.clip()
      ctx.translate(offsetX % DOT_SPACING, offsetY % DOT_SPACING)
      ctx.fillStyle = dots
      ctx.fillRect(-DOT_SPACING, -DOT_SPACING, cssW + DOT_SPACING * 2, cssH + DOT_SPACING * 2)
      ctx.restore()
    }

    // Layer 2: the ring currently being sold. Left untextured so the dotted
    // remainder beyond it reads as a different state, not merely a darker one,
    // and outlined in ember because it is the one live edge on the wall.
    const b = ringBounds(activeRing)
    const ringX = offsetX + b.minX * scale
    const ringY = offsetY + b.minY * scale
    const ringW = (b.maxX - b.minX + 1) * scale
    const ringH = (b.maxY - b.minY + 1) * scale
    ctx.fillStyle = colOpen
    ctx.fillRect(ringX, ringY, ringW, ringH)
    ctx.strokeStyle = colRing
    ctx.lineWidth = 1.5
    ctx.strokeRect(ringX - 0.75, ringY - 0.75, ringW + 1.5, ringH + 1.5)

    // Layer 3: claimed cells inside the viewport.
    const showImages = scale >= IMAGE_SCALE_THRESHOLD
    const filtering = category !== ''

    for (const cell of cellsRef.current.values()) {
      /*
       * Snap each cell to whole pixels and derive its size from the *next*
       * cell's snapped edge. Drawing at fractional coordinates leaves a
       * half-transparent seam between neighbours, which turns a dense block of
       * photographs into a visible grid of tiles -- exactly what the wall
       * should not look like. Sharing edges this way tiles with no gaps and no
       * overlap at any zoom level.
       */
      const px = Math.round(offsetX + cell.x * scale)
      const py = Math.round(offsetY + cell.y * scale)
      const w = Math.max(1, Math.round(offsetX + (cell.x + 1) * scale) - px)
      const h = Math.max(1, Math.round(offsetY + (cell.y + 1) * scale) - py)
      if (px + w < 0 || py + h < 0 || px > cssW || py > cssH) continue

      const dimmed = filtering && cell.c !== category
      ctx.globalAlpha = dimmed ? 0.14 : 1

      if (cell.s === 1 && cell.k && showImages) {
        const img = getImage(imagesRef.current, storageBaseUrl, cell.k, scheduleDraw)
        if (img) {
          ctx.drawImage(img, px, py, w, h)
        } else {
          ctx.fillStyle = colBlank
          ctx.fillRect(px, py, w, h)
        }
      } else if (cell.s === 1) {
        // Zoomed out: a filled square reads as a warm lit tile. Loading tens of
        // thousands of images at this scale would be pointless and ruinous.
        ctx.fillStyle = colTile
        ctx.fillRect(px, py, w, h)
      } else {
        // Neutral default treatment: paid for, never filled, or removed.
        ctx.fillStyle = colBlank
        ctx.fillRect(px, py, w, h)
      }
    }
    ctx.globalAlpha = 1
  }, [activeRing, category, storageBaseUrl])

  const scheduleDraw = useCallback(() => {
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(draw)
    }
  }, [draw])

  // ---- data ---------------------------------------------------------------

  const loadCells = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { scale, offsetX, offsetY } = viewRef.current
    const minX = clampCoord(Math.floor((0 - offsetX) / scale) - 2)
    const maxX = clampCoord(Math.ceil((canvas.clientWidth - offsetX) / scale) + 2)
    const minY = clampCoord(Math.floor((0 - offsetY) / scale) - 2)
    const maxY = clampCoord(Math.ceil((canvas.clientHeight - offsetY) / scale) + 2)

    try {
      const res = await fetch(
        `/api/wall?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const body = (await res.json()) as { cells: Cell[] }
      for (const cell of body.cells) cellsRef.current.set(cell.i, cell)
      scheduleDraw()
    } catch {
      // A failed viewport fetch just means the wall stays as it was.
    }
  }, [scheduleDraw])

  // ---- interaction --------------------------------------------------------

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      const v = viewRef.current
      const next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      if (next === v.scale) return
      // Keep the point under the cursor fixed while zooming.
      v.offsetX = px - ((px - v.offsetX) / v.scale) * next
      v.offsetY = py - ((py - v.offsetY) / v.scale) * next
      v.scale = next
      clampOffsets(canvas, viewRef.current)
      scheduleDraw()
    },
    [scheduleDraw],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    // Start centred, showing the whole field.
    const fit = Math.min(canvas.clientWidth, canvas.clientHeight) / GRID_SIZE
    const v = viewRef.current
    v.scale = clamp(fit * 0.92, MIN_SCALE, MAX_SCALE)
    v.offsetX = (canvas.clientWidth - GRID_SIZE * v.scale) / 2
    v.offsetY = (canvas.clientHeight - GRID_SIZE * v.scale) / 2
    setReady(true)
    scheduleDraw()
    void loadCells()

    const onResize = () => {
      clampOffsets(canvas, viewRef.current)
      scheduleDraw()
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(wrap)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016))
      debouncedLoad()
    }
    // Passive: false so preventDefault actually stops the page scrolling.
    canvas.addEventListener('wheel', onWheel, { passive: false })

    let loadTimer: ReturnType<typeof setTimeout> | null = null
    function debouncedLoad() {
      if (loadTimer) clearTimeout(loadTimer)
      loadTimer = setTimeout(() => void loadCells(), 220)
    }

    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current = {
        dragging: true,
        moved: false,
        lastX: e.clientX,
        lastY: e.clientY,
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current
      if (p.dragging) {
        const dx = e.clientX - p.lastX
        const dy = e.clientY - p.lastY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) p.moved = true
        viewRef.current.offsetX += dx
        viewRef.current.offsetY += dy
        p.lastX = e.clientX
        p.lastY = e.clientY
        clampOffsets(canvas, viewRef.current)
        scheduleDraw()
        debouncedLoad()
        return
      }
      const cell = cellAtPointer(canvas, viewRef.current, e, cellsRef.current)
      setHovered(cell)
    }

    const onPointerUp = (e: PointerEvent) => {
      const p = pointerRef.current
      p.dragging = false
      canvas.releasePointerCapture?.(e.pointerId)
      if (p.moved) return
      const cell = cellAtPointer(canvas, viewRef.current, e, cellsRef.current)
      if (cell) window.location.href = `/s/${cell.i}`
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', () => setHovered(null))

    return () => {
      observer.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      if (loadTimer) clearTimeout(loadTimer)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [loadCells, scheduleDraw, zoomAt])

  useEffect(() => {
    scheduleDraw()
  }, [category, scheduleDraw])

  return (
    <div ref={wrapRef}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <label className="field" style={{ margin: 0 }}>
          <span style={{ marginBottom: 4 }}>Browse by theme</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ minWidth: 190 }}
          >
            <option value="">Everything</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint" style={{ margin: 0, flex: '1 1 260px' }}>
          Drag to pan, scroll to zoom, click a square to open it. The dotted
          field is the part of the million that has not opened yet — nothing
          there is claimed or for sale.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--vault-rule)',
          background: 'var(--wall-bg)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.045), 0 18px 40px -24px rgba(0,0,0,.8)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: 'min(68vh, 640px)',
            cursor: hovered ? 'pointer' : 'grab',
            touchAction: 'none',
            opacity: ready ? 1 : 0,
            transition: 'opacity 300ms var(--ease-out)',
          }}
          aria-label={`Interactive wall of ${TOTAL_SQUARES.toLocaleString('en-US')} squares`}
        />
        {hovered && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              background: 'rgba(33,26,21,.94)',
              color: 'var(--vault-ink)',
              border: '1px solid var(--vault-rule)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              pointerEvents: 'none',
              boxShadow: '0 8px 20px -10px rgba(0,0,0,.7)',
            }}
          >
            <strong className="num">{formatSquareLabel(hovered.i)}</strong>
            <span style={{ color: 'var(--vault-dim)' }}>
              {' — '}
              {hovered.s === 1 ? 'claimed & filled' : 'claimed, blank'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- helpers --------------------------------------------------------------

/**
 * The locked region's texture: one small dot per DOT_SPACING square.
 *
 * Built once per device-pixel-ratio and cached, because a repeating pattern is
 * a single fill no matter how much of the million-cell field is on screen --
 * stroking a lattice across it would cost thousands of path operations a frame
 * and, worse, would draw a grid over the part of the wall that is meant to
 * read as untouched.
 */
function buildDotPattern(
  ctx: CanvasRenderingContext2D,
  color: string,
  dpr: number,
): CanvasPattern | null {
  const tile = document.createElement('canvas')
  tile.width = Math.max(1, Math.round(DOT_SPACING * dpr))
  tile.height = Math.max(1, Math.round(DOT_SPACING * dpr))
  const tctx = tile.getContext('2d')
  if (!tctx) return null

  tctx.scale(dpr, dpr)
  tctx.fillStyle = color
  tctx.beginPath()
  tctx.arc(DOT_SPACING / 2, DOT_SPACING / 2, 1, 0, Math.PI * 2)
  tctx.fill()

  const pattern = ctx.createPattern(tile, 'repeat')
  // The tile is in device pixels but the context draws in CSS pixels, so scale
  // the pattern back down or the dots space out on high-density screens.
  if (pattern && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]))
  }
  return pattern
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function clampCoord(v: number): number {
  return clamp(v, 0, GRID_SIZE - 1)
}

interface View {
  scale: number
  offsetX: number
  offsetY: number
}

/** Keeps the wall from being dragged entirely off screen. */
function clampOffsets(canvas: HTMLCanvasElement, v: View): void {
  const w = GRID_SIZE * v.scale
  const h = GRID_SIZE * v.scale
  const marginX = canvas.clientWidth * 0.5
  const marginY = canvas.clientHeight * 0.5
  v.offsetX = clamp(v.offsetX, canvas.clientWidth - w - marginX, marginX)
  v.offsetY = clamp(v.offsetY, canvas.clientHeight - h - marginY, marginY)
}

function cellAtPointer(
  canvas: HTMLCanvasElement,
  v: View,
  e: PointerEvent,
  cells: Map<number, Cell>,
): Cell | null {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left - v.offsetX) / v.scale)
  const y = Math.floor((e.clientY - rect.top - v.offsetY) / v.scale)
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null
  return cells.get(cellToIndex(x, y)) ?? null
}

function getImage(
  cache: Map<string, HTMLImageElement | 'loading' | 'error'>,
  baseUrl: string,
  key: string,
  onLoad: () => void,
): HTMLImageElement | null {
  const existing = cache.get(key)
  if (existing instanceof HTMLImageElement) return existing
  if (existing === 'loading' || existing === 'error') return null

  if (cache.size > IMAGE_CACHE_CAP) {
    // Cheap eviction: drop the oldest quarter. Insertion order is iteration
    // order for a Map, so this sheds whatever was fetched longest ago.
    let dropped = 0
    const target = Math.floor(IMAGE_CACHE_CAP / 4)
    for (const k of cache.keys()) {
      cache.delete(k)
      if (++dropped >= target) break
    }
  }

  cache.set(key, 'loading')
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    cache.set(key, img)
    onLoad()
  }
  img.onerror = () => cache.set(key, 'error')
  img.src = `${baseUrl}/${key}`
  return null
}
