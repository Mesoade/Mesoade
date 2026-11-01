import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AbsoluteFill,
  Easing,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { GRID_SIZE, indexToCell, formatSquareLabel } from '../../src/lib/wall/geometry'
import { getPhotos, type Photo } from './photos'

/**
 * Launch video: 40s, 1080x1920, 30fps.
 *
 *   0.0s  Beat 1  the whole million, empty. "1,000,000 squares."
 *   4.0s  Beat 2  zoom to the centre; squares fill with photos, centre outward
 *  13.0s  Beat 3  "$10 each. One per person. Forever."
 *  21.0s  Beat 4  the next square highlights, gets its photo, locks in
 *  31.0s  Beat 5  end card: headline + URL
 *
 * Fill order is the site's real one (src/lib/wall/geometry.ts), so the pattern
 * on screen is exactly how the wall grows in production.
 */

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const DURATION = 40 * FPS

// Site palette (src/app/globals.css).
const C = {
  bg: '#0f0f10',
  text: '#e8e8ea',
  textDim: '#b8b8c0',
  textFaint: '#8a8a94',
  border: '#3a3a42',
}

/** The square the video "sells": the first unclaimed one once the fill stops. */
const TARGET_INDEX = 1000
const FILL_START = 250
const FILL_END = 620
const GAP = 0.12 // gap between cells, as a fraction of a cell
const CENTER = GRID_SIZE / 2

const ease = Easing.bezier(0.65, 0, 0.35, 1)
const easeOut = Easing.bezier(0.22, 1, 0.36, 1)

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const lerpLog = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t)

// ---- timing ---------------------------------------------------------------

/** Number of claimed squares at a frame. Slow at first (one by one), then a rush. */
function filledAt(frame: number): number {
  const u = interpolate(frame, [FILL_START, FILL_END], [0, 1], clamp)
  const k = 5.2
  return Math.floor((TARGET_INDEX * (Math.exp(k * u) - 1)) / (Math.exp(k) - 1))
}

/** Inverse of filledAt: the (fractional) frame at which square `i` is claimed. */
function claimFrame(i: number): number {
  const k = 5.2
  const u = Math.log(1 + ((i + 1) * (Math.exp(k) - 1)) / TARGET_INDEX) / k
  return FILL_START + u * (FILL_END - FILL_START)
}

const target = indexToCell(TARGET_INDEX)
const TX = target.x + 0.5
const TY = target.y + 0.5

/** Camera in cell space: centre (cx, cy) and pixels per cell (s). */
function camera(f: number) {
  let s: number
  let cx = CENTER
  let cy = CENTER
  const S0 = 1.0 // the full 1000-cell wall fits the 1080 frame
  const S1 = 34
  const S2 = 46
  const S3 = 270

  if (f < 150) {
    // Open close enough to read the squares, then pull back to the whole wall.
    s = lerpLog(9, S0, ease(interpolate(f, [0, 110], [0, 1], clamp)))
  } else if (f < 360) {
    s = lerpLog(S0, S1, ease(interpolate(f, [150, 360], [0, 1], clamp)))
  } else if (f < 630) {
    s = lerpLog(S1, S2, interpolate(f, [360, 630], [0, 1], clamp))
  } else if (f < 900) {
    const t = ease(interpolate(f, [630, 690], [0, 1], clamp))
    const drift = interpolate(f, [690, 900], [0, 1], clamp)
    s = lerpLog(S2, S3, t) * (1 + 0.06 * drift)
    cx = CENTER + (TX - CENTER) * t
    cy = CENTER + (TY - CENTER) * t
  } else {
    const t = ease(interpolate(f, [900, 980], [0, 1], clamp))
    const drift = interpolate(f, [980, DURATION], [0, 1], clamp)
    s = lerpLog(S3 * 1.06, 22, t) * (1 - 0.15 * drift)
    cx = TX
    cy = TY
  }
  return { s, cx, cy }
}

// ---- background tiles -----------------------------------------------------

const TILE_CELLS = 32
const TILE_SHADES: number[] = (() => {
  const out: number[] = []
  let seed = 12345
  for (let i = 0; i < TILE_CELLS * TILE_CELLS; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out.push(seed / 0x7fffffff)
  }
  return out
})()

/**
 * A tile of empty squares at a given pixel size per cell. Several sizes exist
 * so the pattern is never scaled down by more than 2x, which keeps the deep
 * zoom-out free of moire.
 */
function makeTiles() {
  const sizes = [64, 32, 16, 8, 4, 2, 1]
  return sizes.map((p) => {
    const c = document.createElement('canvas')
    c.width = c.height = TILE_CELLS * p
    const ctx = c.getContext('2d')!
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, c.width, c.height)
    for (let y = 0; y < TILE_CELLS; y++) {
      for (let x = 0; x < TILE_CELLS; x++) {
        ctx.fillStyle = shadeColor(cellShade(x, y))
        const g = p * GAP
        ctx.fillRect(x * p + g / 2, y * p + g / 2, p - g, p - g)
      }
    }
    return { p, canvas: c }
  })
}

interface Prepared {
  tiles: ReturnType<typeof makeTiles>
  photos: Photo[]
  cells: Array<{ x: number; y: number; photo: number; at: number }>
}

function prepare(): Prepared {
  const photos = getPhotos()
  const cells = []
  for (let i = 0; i <= TARGET_INDEX; i++) {
    const c = indexToCell(i)
    // Spread scenes so neighbours rarely share one.
    let h = Math.imul(i + 1, 2654435761) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    const photo = ((h ^ (h >>> 13)) >>> 0) % photos.length
    cells.push({ x: c.x, y: c.y, photo, at: claimFrame(i) })
  }
  return { tiles: makeTiles(), photos, cells }
}

let prepared: Prepared | null = null

// ---- canvas ---------------------------------------------------------------

function drawFrame(ctx: CanvasRenderingContext2D, f: number, P: Prepared) {
  const { s, cx, cy } = camera(f)
  const ox = WIDTH / 2 - cx * s
  const oy = HEIGHT / 2 - cy * s

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Whole scene fades back behind the end card.
  const sceneAlpha = interpolate(f, [900, 980], [1, 0.16], clamp)
  // Everything except the hero square dims while it locks in.
  const othersAlpha = interpolate(f, [640, 700], [1, 0.32], clamp) * sceneAlpha

  // Layer 1: the million empty squares.
  ctx.globalAlpha = othersAlpha
  if (s >= 2.5 && s < 24) drawEmptyCells(ctx, s, ox, oy)
  else {
    // Very far out (cells blur into texture) or very close (few cells, and
    // the pattern is barely resampled): a repeating tile is cheap and clean.
    const tile = P.tiles.find((t) => t.p / 2 <= s) ?? P.tiles[P.tiles.length - 1]
    const pattern = ctx.createPattern(tile.canvas, 'repeat')!
    const k = s / tile.p
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]))
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = pattern
    const gx0 = Math.max(0, ox)
    const gy0 = Math.max(0, oy)
    const gx1 = Math.min(WIDTH, ox + GRID_SIZE * s)
    const gy1 = Math.min(HEIGHT, oy + GRID_SIZE * s)
    if (gx1 > gx0 && gy1 > gy0) ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0)
  }

  // The edge of the wall, visible while zoomed out.
  ctx.strokeStyle = C.border
  ctx.lineWidth = 2
  ctx.strokeRect(ox, oy, GRID_SIZE * s, GRID_SIZE * s)

  // Layer 2: claimed squares.
  const size = s * (1 - GAP)
  const inset = (s * GAP) / 2
  for (let i = 0; i < TARGET_INDEX; i++) {
    const c = P.cells[i]
    const age = f - c.at
    if (age < 0) break
    const px = ox + c.x * s + inset
    const py = oy + c.y * s + inset
    if (px + size < 0 || py + size < 0 || px > WIDTH || py > HEIGHT) continue

    // Pop in: a short overshoot, then settle.
    const t = Math.min(1, age / 9)
    const sc = t < 1 ? 0.55 + 0.45 * Easing.out(Easing.back(2.2))(t) : 1
    const a = Math.min(1, age / 4)
    const d = size * sc
    const qx = px + (size - d) / 2
    const qy = py + (size - d) / 2

    ctx.globalAlpha = a * othersAlpha
    const photo = P.photos[c.photo]
    if (s >= 5) ctx.drawImage(photo.canvas, qx, qy, d, d)
    else {
      ctx.fillStyle = photo.avg
      ctx.fillRect(qx, qy, d, d)
    }
    // A brief light flash as each one lands.
    if (age < 10 && s >= 5) {
      ctx.globalAlpha = (1 - age / 10) * 0.55 * othersAlpha
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(qx, qy, d, d)
    }
  }

  // Layer 3: the hero square.
  drawHero(ctx, f, P, ox, oy, s, sceneAlpha)
  ctx.globalAlpha = 1
}

const SHADE_LEVELS = 6
const shadeColor = (lvl: number) => `hsl(240, 5%, ${17 + (lvl / (SHADE_LEVELS - 1)) * 4.5}%)`

/** Same per-cell shade as the tiles, so switching drawing paths is invisible. */
function cellShade(x: number, y: number): number {
  const tx = x % TILE_CELLS
  const ty = y % TILE_CELLS
  return Math.min(SHADE_LEVELS - 1, Math.floor(TILE_SHADES[ty * TILE_CELLS + tx] * SHADE_LEVELS))
}

/** Pixel-snapped individual cells, so mid-range zoom stays crisp (no moire). */
function drawEmptyCells(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number) {
  const x0 = Math.max(0, Math.floor(-ox / s))
  const x1 = Math.min(GRID_SIZE - 1, Math.ceil((WIDTH - ox) / s))
  const y0 = Math.max(0, Math.floor(-oy / s))
  const y1 = Math.min(GRID_SIZE - 1, Math.ceil((HEIGHT - oy) / s))
  const gap = Math.max(1, Math.round(s * GAP))
  const paths = Array.from({ length: SHADE_LEVELS }, () => new Path2D())
  for (let y = y0; y <= y1; y++) {
    const py = Math.round(oy + y * s)
    const ph = Math.round(oy + (y + 1) * s) - py - gap
    for (let x = x0; x <= x1; x++) {
      const px = Math.round(ox + x * s)
      const pw = Math.round(ox + (x + 1) * s) - px - gap
      paths[cellShade(x, y)].rect(px, py, pw, ph)
    }
  }
  paths.forEach((p, lvl) => {
    ctx.fillStyle = shadeColor(lvl)
    ctx.fill(p)
  })
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  f: number,
  P: Prepared,
  ox: number,
  oy: number,
  s: number,
  sceneAlpha: number,
) {
  if (f < 640) return
  const size = s * (1 - GAP)
  const x = ox + target.x * s + (s * GAP) / 2
  const y = oy + target.y * s + (s * GAP) / 2
  const mid = { x: x + size / 2, y: y + size / 2 }
  const photo = P.photos[HERO_PHOTO]

  // Highlight: a soft breathing outline on the empty square.
  const hl = interpolate(f, [650, 690], [0, 1], clamp)
  const pulse = f < 760 ? 0.5 + 0.5 * Math.sin((f - 650) / 6) : 1

  // Photo lands.
  const landT = interpolate(f, [730, 752], [0, 1], clamp)
  const landEase = easeOut(landT)
  const landScale = 1.32 - 0.32 * landEase

  // Lock: a firm squeeze, then a ring that pushes outward.
  const lockT = interpolate(f, [756, 770], [0, 1], clamp)
  const squeeze = 1 - 0.06 * Math.sin(Math.PI * lockT)

  ctx.save()
  ctx.globalAlpha = sceneAlpha

  // Shadow under the square so it lifts off the wall.
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 40 * hl
  ctx.fillStyle = '#2e2e35'
  ctx.fillRect(x, y, size, size)
  ctx.shadowBlur = 0

  if (landT > 0) {
    const d = size * landScale * squeeze
    ctx.globalAlpha = sceneAlpha * Math.min(1, landT * 1.6)
    ctx.drawImage(photo.canvas, mid.x - d / 2, mid.y - d / 2, d, d)
    ctx.globalAlpha = sceneAlpha
  }

  // Outline.
  const lineW = interpolate(f, [756, 762, 780], [3, 7, 3], clamp)
  const outlineAlpha = hl * (f < 756 ? 0.55 + 0.45 * pulse : 1)
  const od = size * (landT > 0 ? Math.max(1, landScale) * squeeze : 1) + 10
  ctx.strokeStyle = `rgba(232,232,234,${outlineAlpha})`
  ctx.lineWidth = lineW
  ctx.shadowColor = 'rgba(255,255,255,0.55)'
  ctx.shadowBlur = 24 * hl * (f < 756 ? pulse : 1)
  ctx.strokeRect(mid.x - od / 2, mid.y - od / 2, od, od)
  ctx.shadowBlur = 0

  // Ring pushed outward at the moment it locks.
  const ringT = interpolate(f, [758, 790], [0, 1], clamp)
  if (ringT > 0 && ringT < 1) {
    const rd = od * (1 + 0.9 * easeOut(ringT))
    ctx.strokeStyle = `rgba(232,232,234,${0.7 * (1 - ringT)})`
    ctx.lineWidth = 3
    ctx.strokeRect(mid.x - rd / 2, mid.y - rd / 2, rd, rd)
  }
  ctx.restore()
}

/** Which placeholder photo becomes "your" square. A warm sunset. */
const HERO_PHOTO = 10

function WallCanvas() {
  const frame = useCurrentFrame()
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    if (!prepared) prepared = prepare()
    const ctx = ref.current?.getContext('2d')
    if (ctx) drawFrame(ctx, frame, prepared)
  }, [frame])
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ position: 'absolute', inset: 0 }} />
}

// ---- text -----------------------------------------------------------------

function reveal(frame: number, start: number, end: number, rise = 28) {
  const inT = easeOut(interpolate(frame, [start, start + 20], [0, 1], clamp))
  const outT = interpolate(frame, [end - 14, end], [1, 0], clamp)
  return {
    opacity: inT * outT,
    transform: `translateY(${(1 - inT) * rise}px)`,
  }
}

const headline: React.CSSProperties = {
  fontFamily: 'InterVideo, Inter, system-ui, sans-serif',
  fontWeight: 600,
  color: C.text,
  letterSpacing: '-0.035em',
  lineHeight: 1.04,
  margin: 0,
}

/** Top scrim so text always sits on calm, dark ground. */
function Scrim({ opacity, height = 820 }: { opacity: number; height?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height,
        opacity,
        background: `linear-gradient(to bottom, ${C.bg} 0%, ${C.bg}ee 40%, ${C.bg}00 100%)`,
      }}
    />
  )
}

function BeatOne({ frame }: { frame: number }) {
  return (
    <>
      <Scrim opacity={interpolate(frame, [0, 120, 150], [0.9, 0.9, 0], clamp)} height={760} />
      <div style={{ position: 'absolute', left: 90, right: 90, top: 250, ...reveal(frame, 18, 140) }}>
        <h1 style={{ ...headline, fontSize: 112 }}>1,000,000 squares.</h1>
      </div>
    </>
  )
}

function BeatThree({ frame }: { frame: number }) {
  const lines = ['$10 each.', 'One per person.', 'Forever.']
  const scrim = interpolate(frame, [380, 410, 610, 640], [0, 1, 1, 0], clamp)
  return (
    <>
      <Scrim opacity={scrim} />
      <div style={{ position: 'absolute', left: 90, right: 90, top: 250 }}>
        {lines.map((l, i) => (
          <h2 key={l} style={{ ...headline, fontSize: 104, ...reveal(frame, 400 + i * 24, 630) }}>
            {l}
          </h2>
        ))}
      </div>
    </>
  )
}

function BeatFour({ frame }: { frame: number }) {
  // The hero square sits at screen centre; labels hang above and below it.
  const { s } = camera(frame)
  const half = (s * (1 - GAP)) / 2 + 40
  const above = reveal(frame, 690, 905, 16)
  const below = reveal(frame, 768, 905, 16)
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HEIGHT / 2 - half - 70,
          textAlign: 'center',
          fontFamily: 'InterVideo, Inter, system-ui, sans-serif',
          fontWeight: 500,
          fontSize: 40,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.textDim,
          ...above,
        }}
      >
        Square {formatSquareLabel(TARGET_INDEX)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HEIGHT / 2 + half + 8,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
          ...below,
        }}
      >
        <LockIcon frame={frame} />
        <span style={{ ...headline, fontSize: 60, letterSpacing: '-0.02em' }}>Locked in.</span>
      </div>
    </>
  )
}

function LockIcon({ frame }: { frame: number }) {
  // The shackle drops shut a beat after the icon appears.
  const shut = easeOut(interpolate(frame, [772, 784], [0, 1], clamp))
  return (
    <svg width="48" height="56" viewBox="0 0 24 28" fill="none" style={{ overflow: 'visible' }}>
      <path
        d="M7 12V8a5 5 0 0 1 10 0v4"
        stroke={C.text}
        strokeWidth="2.4"
        strokeLinecap="round"
        transform={`translate(0 ${-(1 - shut) * 5})`}
      />
      <rect x="3" y="12" width="18" height="14" rx="3" fill={C.text} />
    </svg>
  )
}

function EndCard({ frame }: { frame: number }) {
  const lines = ['You get one.', 'Forever.', 'Choose wisely.']
  const url = reveal(frame, 1010, DURATION + 100, 20)
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingBottom: 120,
      }}
    >
      {lines.map((l, i) => (
        <h2 key={l} style={{ ...headline, fontSize: 128, ...reveal(frame, 940 + i * 18, DURATION + 100, 30) }}>
          {l}
        </h2>
      ))}
      <div style={{ marginTop: 72, ...url }}>
        <span
          style={{
            display: 'inline-block',
            background: C.text,
            color: C.bg,
            borderRadius: 22,
            padding: '30px 46px',
            fontFamily: 'InterVideo, Inter, system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 52,
            letterSpacing: '-0.01em',
          }}
        >
          themillionsquare.com
        </span>
      </div>
    </div>
  )
}

// ---- composition ----------------------------------------------------------

function useFonts() {
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => {
    Promise.all([
      document.fonts.load('500 40px InterVideo'),
      document.fonts.load('600 100px InterVideo'),
    ])
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle))
  }, [handle])
}

const fontCss = `
@font-face { font-family: InterVideo; font-weight: 400; src: url(${staticFile('fonts/Inter-Regular.otf')}); }
@font-face { font-family: InterVideo; font-weight: 500; src: url(${staticFile('fonts/Inter-Medium.otf')}); }
@font-face { font-family: InterVideo; font-weight: 600; src: url(${staticFile('fonts/Inter-SemiBold.otf')}); }
`

export function LaunchVideo() {
  const frame = useCurrentFrame()
  useVideoConfig()
  useFonts()
  const style = useMemo(() => <style>{fontCss}</style>, [])

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {style}
      <WallCanvas />
      {frame < 150 && <BeatOne frame={frame} />}
      {frame >= 370 && frame < 650 && <BeatThree frame={frame} />}
      {frame >= 680 && frame < 910 && <BeatFour frame={frame} />}
      {frame >= 930 && <EndCard frame={frame} />}
    </AbsoluteFill>
  )
}
