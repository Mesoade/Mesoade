/**
 * Placeholder "photos" for the launch video.
 *
 * The repo ships no real customer photos (and must not: every square is a real
 * person's), so these are painted procedurally: sunsets, mountains, sea, city
 * lights, forests, bokeh, portraits in silhouette. At the sizes they appear on
 * screen they read as photographs without being anyone's actual image.
 *
 * Deterministic: the same seed always paints the same picture, so every frame
 * Remotion renders (in any browser tab, in any order) agrees.
 */

export const PHOTO_SIZE = 160
export const PHOTO_COUNT = 72

export interface Photo {
  canvas: HTMLCanvasElement
  /** Average colour, used when a cell is too small on screen to show the image. */
  avg: string
}

let cache: Photo[] | null = null

export function getPhotos(): Photo[] {
  if (cache) return cache
  cache = Array.from({ length: PHOTO_COUNT }, (_, i) => paint(i))
  return cache
}

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

type Ctx = CanvasRenderingContext2D
type R = () => number

const SCENES: Array<(c: Ctx, r: R, S: number) => void> = [
  sunset,
  mountains,
  sea,
  city,
  forest,
  bokeh,
  portrait,
  field,
  desert,
  pastel,
]

function paint(i: number): Photo {
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  const ctx = canvas.getContext('2d')!
  const r = rng(i + 7)
  const scene = SCENES[i % SCENES.length]
  scene(ctx, r, PHOTO_SIZE)
  finish(ctx, r, PHOTO_SIZE)

  // Average colour from a tiny downsample.
  const tiny = document.createElement('canvas')
  tiny.width = 1
  tiny.height = 1
  const t = tiny.getContext('2d')!
  t.drawImage(canvas, 0, 0, 1, 1)
  const [rr, gg, bb] = t.getImageData(0, 0, 1, 1).data
  return { canvas, avg: `rgb(${rr},${gg},${bb})` }
}

// ---- helpers --------------------------------------------------------------

const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a})`

function vGrad(c: Ctx, S: number, stops: Array<[number, string]>, y0 = 0, y1 = S) {
  const g = c.createLinearGradient(0, y0, 0, y1)
  for (const [o, col] of stops) g.addColorStop(o, col)
  c.fillStyle = g
  c.fillRect(0, y0, S, y1 - y0)
}

function ridge(c: Ctx, r: R, S: number, base: number, amp: number, color: string, steps = 9) {
  c.fillStyle = color
  c.beginPath()
  c.moveTo(0, S)
  let y = base - r() * amp
  for (let k = 0; k <= steps; k++) {
    const x = (k / steps) * S
    y = base - amp * (0.3 + 0.7 * r())
    c.lineTo(x, y)
  }
  c.lineTo(S, S)
  c.closePath()
  c.fill()
}

function softCircle(c: Ctx, x: number, y: number, rad: number, inner: string, outer: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  c.fillStyle = g
  c.beginPath()
  c.arc(x, y, rad, 0, Math.PI * 2)
  c.fill()
}

/** Grain and vignette: the two things that make a flat drawing read as a photo. */
function finish(c: Ctx, r: R, S: number) {
  const v = c.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.38)')
  c.fillStyle = v
  c.fillRect(0, 0, S, S)

  const img = c.getImageData(0, 0, S, S)
  const d = img.data
  for (let p = 0; p < d.length; p += 4) {
    const n = (r() - 0.5) * 14
    d[p] += n
    d[p + 1] += n
    d[p + 2] += n
  }
  c.putImageData(img, 0, 0)
}

// ---- scenes ---------------------------------------------------------------

function sunset(c: Ctx, r: R, S: number) {
  const h = 10 + r() * 30
  vGrad(c, S, [
    [0, hsl(250 + r() * 30, 45, 22)],
    [0.45, hsl(h + 10, 80, 55)],
    [0.62, hsl(h, 90, 68)],
  ])
  const horizon = S * (0.6 + r() * 0.1)
  softCircle(c, S * (0.3 + r() * 0.4), horizon - S * 0.06, S * 0.14, hsl(45, 100, 88), hsl(h, 90, 65, 0))
  vGrad(c, S, [[0, hsl(h + 200, 30, 22)], [1, hsl(230, 35, 10)]], horizon, S)
  c.fillStyle = hsl(40, 100, 80, 0.35)
  for (let k = 0; k < 6; k++) c.fillRect(S * 0.35 + r() * S * 0.3, horizon + 4 + k * 6, S * 0.12 * r(), 1.5)
}

function mountains(c: Ctx, r: R, S: number) {
  const h = 195 + r() * 25
  vGrad(c, S, [[0, hsl(h, 55, 62)], [1, hsl(h - 10, 40, 85)]])
  ridge(c, r, S, S * 0.55, S * 0.3, hsl(h + 15, 20, 62))
  ridge(c, r, S, S * 0.7, S * 0.25, hsl(h + 20, 25, 42))
  ridge(c, r, S, S * 0.86, S * 0.18, hsl(140 + r() * 30, 25, 22))
}

function sea(c: Ctx, r: R, S: number) {
  const h = 190 + r() * 20
  const horizon = S * (0.42 + r() * 0.12)
  vGrad(c, S, [[0, hsl(h + 10, 60, 72)], [1, hsl(h, 50, 88)]], 0, horizon)
  vGrad(c, S, [[0, hsl(h, 70, 42)], [1, hsl(h + 5, 75, 22)]], horizon, S)
  c.fillStyle = 'rgba(255,255,255,0.25)'
  for (let k = 0; k < 18; k++) c.fillRect(r() * S, horizon + r() * (S - horizon), 6 + r() * 14, 1.2)
  if (r() > 0.4) {
    c.fillStyle = hsl(40, 45, 75)
    c.beginPath()
    c.moveTo(0, S)
    c.quadraticCurveTo(S * 0.5, S * 0.82, S, S * (0.85 + r() * 0.1))
    c.lineTo(S, S)
    c.fill()
  }
}

function city(c: Ctx, r: R, S: number) {
  vGrad(c, S, [[0, hsl(235, 45, 9)], [1, hsl(260 + r() * 30, 40, 24)]])
  let x = -4
  while (x < S) {
    const w = 12 + r() * 22
    const top = S * (0.3 + r() * 0.45)
    c.fillStyle = hsl(235, 25, 8 + r() * 6)
    c.fillRect(x, top, w, S - top)
    for (let wy = top + 4; wy < S - 3; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 5)
        if (r() > 0.55) {
          c.fillStyle = hsl(40 + r() * 15, 90, 60 + r() * 20, 0.85)
          c.fillRect(wx, wy, 2, 2.5)
        }
    x += w + 1
  }
}

function forest(c: Ctx, r: R, S: number) {
  vGrad(c, S, [[0, hsl(90 + r() * 40, 30, 70)], [1, hsl(120, 25, 40)]])
  for (let layer = 0; layer < 3; layer++) {
    const l = 38 - layer * 12
    for (let k = 0; k < 9; k++) {
      const x = r() * S
      const h = S * (0.3 + r() * 0.3 + layer * 0.08)
      const base = S * (0.75 + layer * 0.1)
      c.fillStyle = hsl(130 + r() * 30, 35, l)
      c.beginPath()
      c.moveTo(x, base - h)
      c.lineTo(x - h * 0.28, base)
      c.lineTo(x + h * 0.28, base)
      c.fill()
    }
  }
  vGrad(c, S, [[0, hsl(100, 30, 20)], [1, hsl(100, 30, 12)]], S * 0.92, S)
}

function bokeh(c: Ctx, r: R, S: number) {
  const h = r() * 360
  c.fillStyle = hsl(h, 30, 8)
  c.fillRect(0, 0, S, S)
  for (let k = 0; k < 26; k++) {
    const rad = 6 + r() * 22
    softCircle(c, r() * S, r() * S, rad, hsl(h + r() * 60 - 30, 85, 65, 0.55), hsl(h, 85, 50, 0))
  }
}

function portrait(c: Ctx, r: R, S: number) {
  const h = r() * 360
  vGrad(c, S, [[0, hsl(h, 35, 70)], [1, hsl(h + 30, 30, 50)]])
  softCircle(c, S * 0.75, S * 0.2, S * 0.5, hsl(h, 60, 90, 0.5), hsl(h, 60, 80, 0))
  const skin = hsl(20 + r() * 15, 35 + r() * 20, 30 + r() * 40)
  c.fillStyle = hsl(r() * 360, 30, 20 + r() * 20)
  c.beginPath()
  c.ellipse(S * 0.5, S * 1.02, S * 0.42, S * 0.3, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = skin
  c.fillRect(S * 0.44, S * 0.55, S * 0.12, S * 0.2)
  c.beginPath()
  c.ellipse(S * 0.5, S * 0.45, S * 0.16, S * 0.2, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = hsl(25, 30, 10 + r() * 30)
  c.beginPath()
  c.ellipse(S * 0.5, S * 0.33, S * 0.18, S * 0.12, 0, Math.PI, Math.PI * 2)
  c.fill()
}

function field(c: Ctx, r: R, S: number) {
  vGrad(c, S, [[0, hsl(205, 60, 65)], [1, hsl(200, 40, 88)]], 0, S * 0.5)
  softCircle(c, S * r(), S * 0.2, S * 0.18, 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)')
  vGrad(c, S, [[0, hsl(80 + r() * 30, 45, 45)], [1, hsl(90, 40, 25)]], S * 0.5, S)
  const fh = r() > 0.5 ? 50 : 340
  for (let k = 0; k < 80; k++) {
    const y = S * 0.55 + r() * S * 0.45
    c.fillStyle = hsl(fh + r() * 20, 85, 60, 0.9)
    c.beginPath()
    c.arc(r() * S, y, 0.8 + (y / S) * 2.2, 0, Math.PI * 2)
    c.fill()
  }
}

function desert(c: Ctx, r: R, S: number) {
  vGrad(c, S, [[0, hsl(30, 60, 78)], [1, hsl(20, 70, 86)]])
  ridge(c, r, S, S * 0.65, S * 0.18, hsl(28, 55, 62), 4)
  ridge(c, r, S, S * 0.82, S * 0.16, hsl(22, 55, 48), 3)
}

function pastel(c: Ctx, r: R, S: number) {
  const h = r() * 360
  vGrad(c, S, [[0, hsl(h, 55, 80)], [1, hsl(h + 50, 55, 70)]])
  c.fillStyle = hsl(h + 180, 30, 30, 0.9)
  c.beginPath()
  c.arc(S * (0.3 + r() * 0.4), S * (0.4 + r() * 0.3), S * (0.12 + r() * 0.12), 0, Math.PI * 2)
  c.fill()
  c.fillStyle = hsl(h + 20, 30, 92, 0.7)
  c.fillRect(0, S * 0.78, S, S * 0.22)
}
