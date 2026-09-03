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
 *      greyed out. Nothing in it is claimed or claimable yet, and showing it is
 *      the honest way to convey the scale of "one million" without implying the
 *      wall is fuller than it is.
 *   2. The active ring -- the region currently being sold, outlined.
 *   3. Claimed cells -- images where a photo exists, the neutral treatment for
 *      squares that are blank or whose content was removed.
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

export default function Wall({ storageBaseUrl, activeRing, initialCells }: WallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const cellsRef = useRef<Map<number, Cell>>(
    new Map(initialCells.map((c) => [c.i, c])),
  )
  const imagesRef = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(new Map())
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
    const colBg = styles.getPropertyValue('--bg').trim() || '#0f0f10'
    const colLocked = styles.getPropertyValue('--square-locked').trim() || '#191920'
    const colBlank = styles.getPropertyValue('--square-blank').trim() || '#2e2e35'
    const colBorder = styles.getPropertyValue('--border-strong').trim() || '#3a3a42'

    ctx.fillStyle = colBg
    ctx.fillRect(0, 0, cssW, cssH)

    // Layer 1: the full million-cell field, locked.
    ctx.fillStyle = colLocked
    ctx.fillRect(offsetX, offsetY, GRID_SIZE * scale, GRID_SIZE * scale)

    // Grid lines, only once cells are big enough for them to mean anything.
    if (scale >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const x0 = Math.max(0, Math.floor((0 - offsetX) / scale))
      const x1 = Math.min(GRID_SIZE, Math.ceil((cssW - offsetX) / scale))
      const y0 = Math.max(0, Math.floor((0 - offsetY) / scale))
      const y1 = Math.min(GRID_SIZE, Math.ceil((cssH - offsetY) / scale))
      for (let x = x0; x <= x1; x++) {
        ctx.moveTo(Math.round(offsetX + x * scale) + 0.5, offsetY + y0 * scale)
        ctx.lineTo(Math.round(offsetX + x * scale) + 0.5, offsetY + y1 * scale)
      }
      for (let y = y0; y <= y1; y++) {
        ctx.moveTo(offsetX + x0 * scale, Math.round(offsetY + y * scale) + 0.5)
        ctx.lineTo(offsetX + x1 * scale, Math.round(offsetY + y * scale) + 0.5)
      }
      ctx.stroke()
    }

    // Layer 2: the ring currently being sold.
    const b = ringBounds(activeRing)
    ctx.strokeStyle = colBorder
    ctx.lineWidth = 1.5
    ctx.strokeRect(
      offsetX + b.minX * scale,
      offsetY + b.minY * scale,
      (b.maxX - b.minX + 1) * scale,
      (b.maxY - b.minY + 1) * scale,
    )

    // Layer 3: claimed cells inside the viewport.
    const showImages = scale >= IMAGE_SCALE_THRESHOLD
    const size = Math.max(1, scale)
    const filtering = category !== ''

    for (const cell of cellsRef.current.values()) {
      const px = offsetX + cell.x * scale
      const py = offsetY + cell.y * scale
      if (px + size < 0 || py + size < 0 || px > cssW || py > cssH) continue

      const dimmed = filtering && cell.c !== category
      ctx.globalAlpha = dimmed ? 0.14 : 1

      if (cell.s === 1 && cell.k && showImages) {
        const img = getImage(imagesRef.current, storageBaseUrl, cell.k, scheduleDraw)
        if (img) {
          ctx.drawImage(img, px, py, size, size)
        } else {
          ctx.fillStyle = colBlank
          ctx.fillRect(px, py, size, size)
        }
      } else if (cell.s === 1) {
        // Zoomed out: a filled square reads as a lighter tile. Loading tens of
        // thousands of images at this scale would be pointless and ruinous.
        ctx.fillStyle = '#6a6a78'
        ctx.fillRect(px, py, size, size)
      } else {
        // Neutral default treatment: paid for, never filled, or removed.
        ctx.fillStyle = colBlank
        ctx.fillRect(px, py, size, size)
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
        <p className="hint" style={{ margin: 0, flex: '1 1 240px' }}>
          Drag to pan, scroll to zoom, click a square to open it. Grey cells are
          the part of the million that has not opened yet — nothing there is
          claimed or for sale.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
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
            transition: 'opacity .3s ease',
          }}
          aria-label={`Interactive wall of ${TOTAL_SQUARES.toLocaleString('en-US')} squares`}
        />
        {hovered && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              background: 'rgba(15,15,16,.92)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            <strong>{formatSquareLabel(hovered.i)}</strong>
            <span style={{ color: 'var(--text-faint)' }}>
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
