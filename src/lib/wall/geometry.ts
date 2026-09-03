/**
 * Center-outward square addressing for the 1,000,000-cell wall.
 *
 * The wall is a 1000 x 1000 grid. Squares are handed out from the middle
 * outward in concentric rings, never row-by-row: a left-to-right fill reads as
 * a loading bar, and it puts the earliest buyers in an arbitrary corner. Rings
 * keep the claimed area legible at every zoom level and make "closest to the
 * center" a true statement about who bought first.
 *
 * Ring geometry
 * -------------
 * The grid has an even side, so there is no single center cell. Ring 0 is the
 * 2x2 block at the middle; ring r is the square annulus around it, spanning
 * x, y in [CENTER_LO - r, CENTER_HI + r].
 *
 *   cells in ring r  = (2r + 2)^2 - (2r)^2 = 8r + 4
 *   cells before r   = (2r)^2 = 4r^2
 *   rings 0..499     = sum(8r + 4) = 1,000,000 exactly
 *
 * Within a ring, indexes walk clockwise from the ring's top-left cell: right
 * along the top edge, down the right, left along the bottom, up the left.
 *
 * Both directions are pure functions, so unclaimed cells need no database row.
 */

export const GRID_SIZE = 1000
export const TOTAL_SQUARES = GRID_SIZE * GRID_SIZE // 1,000,000
export const MAX_RING = GRID_SIZE / 2 - 1 // 499

/** Coordinates of the 2x2 core: cells 499 and 500 on each axis. */
const CENTER_LO = GRID_SIZE / 2 - 1 // 499
const CENTER_HI = GRID_SIZE / 2 // 500

export interface Cell {
  index: number
  x: number
  y: number
  ring: number
}

/** Number of cells in ring `r`. */
export function ringSize(r: number): number {
  return 8 * r + 4
}

/** Index of the first cell of ring `r`. */
export function ringStart(r: number): number {
  return 4 * r * r
}

/** Index of the last cell of ring `r`. */
export function ringEnd(r: number): number {
  return ringStart(r) + ringSize(r) - 1
}

/** The ring a given index falls in. */
export function ringOfIndex(index: number): number {
  assertIndex(index)
  // ringStart(r) = 4r^2 <= index  =>  r = floor(sqrt(index / 4))
  const r = Math.floor(Math.sqrt(index / 4))
  // Guard against floating-point drift at ring boundaries.
  if (ringStart(r + 1) <= index) return r + 1
  if (r > 0 && ringStart(r) > index) return r - 1
  return r
}

/** The ring a given cell falls in. */
export function ringOfCell(x: number, y: number): number {
  assertCoord(x, 'x')
  assertCoord(y, 'y')
  const dx = x < CENTER_LO ? CENTER_LO - x : x > CENTER_HI ? x - CENTER_HI : 0
  const dy = y < CENTER_LO ? CENTER_LO - y : y > CENTER_HI ? y - CENTER_HI : 0
  return Math.max(dx, dy)
}

/** Grid coordinates for a square index. Inverse of `cellToIndex`. */
export function indexToCell(index: number): Cell {
  assertIndex(index)
  const ring = ringOfIndex(index)
  const offset = index - ringStart(ring)

  const minX = CENTER_LO - ring
  const minY = CENTER_LO - ring
  const maxX = CENTER_HI + ring
  const maxY = CENTER_HI + ring
  const side = 2 * ring + 2 // cells along one edge

  let x: number
  let y: number

  if (offset < side) {
    // Top edge, left to right.
    x = minX + offset
    y = minY
  } else if (offset < side + (side - 1)) {
    // Right edge, top to bottom (top-right corner already counted).
    x = maxX
    y = minY + (offset - side) + 1
  } else if (offset < side + 2 * (side - 1)) {
    // Bottom edge, right to left.
    x = maxX - (offset - side - (side - 1)) - 1
    y = maxY
  } else {
    // Left edge, bottom to top.
    x = minX
    y = maxY - (offset - side - 2 * (side - 1)) - 1
  }

  return { index, x, y, ring }
}

/** Square index for grid coordinates. Inverse of `indexToCell`. */
export function cellToIndex(x: number, y: number): number {
  const ring = ringOfCell(x, y)
  const minX = CENTER_LO - ring
  const minY = CENTER_LO - ring
  const maxX = CENTER_HI + ring
  const maxY = CENTER_HI + ring
  const side = 2 * ring + 2

  let offset: number
  if (y === minY) {
    offset = x - minX
  } else if (x === maxX) {
    offset = side + (y - minY - 1)
  } else if (y === maxY) {
    offset = side + (side - 1) + (maxX - x - 1)
  } else {
    offset = side + 2 * (side - 1) + (maxY - y - 1)
  }

  return ringStart(ring) + offset
}

/**
 * The active region: the ring currently being sold.
 *
 * The wall unlocks a ring at a time. Everything in the active ring is
 * claimable; everything beyond it is drawn locked/greyed so the full million-
 * cell boundary stays visible without implying those cells are for sale.
 */
export interface ActiveRegion {
  ring: number
  firstIndex: number
  lastIndex: number
  /** Real unclaimed cells left in this ring. Never a fabricated number. */
  remaining: number
  size: number
}

export function activeRegion(nextIndex: number): ActiveRegion {
  const clamped = Math.min(nextIndex, TOTAL_SQUARES - 1)
  const ring = ringOfIndex(clamped)
  const firstIndex = ringStart(ring)
  const lastIndex = ringEnd(ring)
  return {
    ring,
    firstIndex,
    lastIndex,
    size: ringSize(ring),
    remaining: Math.max(0, lastIndex - nextIndex + 1),
  }
}

/** Bounding box of the active ring, for drawing the claimable boundary. */
export function ringBounds(ring: number): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  return {
    minX: CENTER_LO - ring,
    minY: CENTER_LO - ring,
    maxX: CENTER_HI + ring,
    maxY: CENTER_HI + ring,
  }
}

/**
 * Claim ordinals that are worth noticing publicly. Flagged on the order record
 * when they happen so they are easy to act on later; what to *do* with each is
 * a decision for the day it happens.
 */
export const MILESTONE_ORDINALS = [1, 1_000, 100_000, 500_000, 1_000_000] as const

/** Returns the milestone ordinal for a square index, or null. */
export function milestoneForIndex(index: number): number | null {
  const ordinal = index + 1
  return (MILESTONE_ORDINALS as readonly number[]).includes(ordinal) ? ordinal : null
}

/** Human display form, e.g. 482910 -> "#482,910". */
export function formatSquareLabel(index: number): string {
  return `#${index.toLocaleString('en-US')}`
}

function assertIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL_SQUARES) {
    throw new RangeError(`square index out of range: ${index}`)
  }
}

function assertCoord(v: number, name: string): void {
  if (!Number.isInteger(v) || v < 0 || v >= GRID_SIZE) {
    throw new RangeError(`${name} out of range: ${v}`)
  }
}
