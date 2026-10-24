import type { PoolClient } from 'pg'
import { query, queryOne, transaction } from '../db.ts'
import {
  TOTAL_SQUARES,
  activeRegion,
  indexToCell,
  milestoneForIndex,
  type ActiveRegion,
} from './geometry.ts'

/**
 * Reads and writes against the wall.
 *
 * Every number surfaced from here is a real count of real rows. No starting
 * offsets, no padded figures, no simulated activity -- the whole product rests
 * on "your square is permanent, and we are telling you the truth", and the FTC
 * actively enforces against fabricated scarcity and social proof besides.
 */

export type SquareState = 'claimed' | 'filled' | 'removed'

export interface SquareRow {
  index: number
  order_id: string
  ring: number
  x: number
  y: number
  state: SquareState
  claimed_at: Date
  image_key: string | null
  image_width: number | null
  image_height: number | null
  caption: string | null
  link_url: string | null
  category: string | null
  filled_at: Date | null
  removed_at: Date | null
  removed_reason: string | null
  upload_token_hash: string | null
}

export interface WallStats {
  claimed: number
  filled: number
  total: number
  revenueCents: number
  activeRegion: ActiveRegion
  fillPercent: number
  /** Indexes freed by an admin deletion, waiting to be handed out again. */
  released: number
}

export async function getStats(): Promise<WallStats> {
  const row = await queryOne<{
    claimed: string
    filled: string
    revenue_cents: string | null
    next_index: number
    released: string
  }>(
    `SELECT
       (SELECT count(*) FROM squares) AS claimed,
       (SELECT count(*) FROM squares WHERE state = 'filled') AS filled,
       (SELECT coalesce(sum(amount_cents), 0) FROM orders WHERE status = 'paid') AS revenue_cents,
       (SELECT next_index FROM wall_state WHERE id = 1) AS next_index,
       (SELECT count(*) FROM released_squares) AS released`,
  )

  const claimed = Number(row?.claimed ?? 0)
  const nextIndex = row?.next_index ?? 0
  const released = Number(row?.released ?? 0)

  /*
   * A released index is claimable right now -- assignSquare() hands those out
   * before it touches the cursor -- but activeRegion() is a pure function of
   * the cursor and cannot know about them. Left uncorrected, "N are left in the
   * region open right now" undercounts by one for every square an admin has
   * deleted, and that line is on the public homepage. This product does not get
   * to publish a number that is merely close.
   *
   * Released squares can sit in a lower ring than the active one. They are
   * still counted here, because the question that sentence answers is how many
   * squares somebody can claim before the frontier moves, not which ring they
   * happen to fall in.
   */
  const region = activeRegion(nextIndex)

  return {
    claimed,
    filled: Number(row?.filled ?? 0),
    total: TOTAL_SQUARES,
    revenueCents: Number(row?.revenue_cents ?? 0),
    activeRegion: { ...region, remaining: region.remaining + released },
    fillPercent: (claimed / TOTAL_SQUARES) * 100,
    released,
  }
}

export async function getSquare(index: number): Promise<SquareRow | null> {
  return queryOne<SquareRow>(`SELECT * FROM squares WHERE index = $1`, [index])
}

export interface WallCell {
  i: number
  x: number
  y: number
  s: 0 | 1 // 0 = neutral (blank or removed), 1 = has an image
  k: string | null // image key
  c: string | null // category
}

/**
 * Cells for the renderer, optionally windowed to a viewport and filtered by
 * category. The client draws to canvas -- a million DOM nodes is not an option
 * -- so this returns a compact array, not markup.
 */
export async function getWallCells(opts: {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  category?: string | null
  limit?: number
}): Promise<WallCell[]> {
  const clauses: string[] = []
  const params: unknown[] = []

  if (opts.minX !== undefined && opts.maxX !== undefined) {
    params.push(opts.minX, opts.maxX)
    clauses.push(`x BETWEEN $${params.length - 1} AND $${params.length}`)
  }
  if (opts.minY !== undefined && opts.maxY !== undefined) {
    params.push(opts.minY, opts.maxY)
    clauses.push(`y BETWEEN $${params.length - 1} AND $${params.length}`)
  }
  if (opts.category) {
    params.push(opts.category)
    clauses.push(`category = $${params.length} AND state = 'filled'`)
  }

  params.push(Math.min(opts.limit ?? 50_000, 200_000))

  const rows = await query<{
    index: number
    x: number
    y: number
    state: SquareState
    image_key: string | null
    category: string | null
  }>(
    `SELECT index, x, y, state, image_key, category
       FROM squares
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY index ASC
      LIMIT $${params.length}`,
    params,
  )

  return rows.map((r) => ({
    i: r.index,
    x: r.x,
    y: r.y,
    // A removed square is shown exactly like one that was never filled: the
    // neutral default treatment, so the wall never looks broken or punitive.
    s: r.state === 'filled' && r.image_key ? 1 : 0,
    k: r.state === 'filled' ? r.image_key : null,
    c: r.state === 'filled' ? r.category : null,
  }))
}

export interface ActivityItem {
  index: number
  claimedAt: string
  state: SquareState
  category: string | null
}

/**
 * How many claims the "Just claimed" feed shows.
 *
 * One constant rather than a number at each call site: the homepage renders
 * the feed on the server and the component then re-polls it every 20 seconds,
 * so if the two disagreed the list would silently change length a few seconds
 * after the page loaded.
 */
export const ACTIVITY_FEED_SIZE = 5

/** Real claims only. Nothing is synthesised to make the feed look busier. */
export async function getRecentActivity(
  limit = ACTIVITY_FEED_SIZE,
): Promise<ActivityItem[]> {
  const rows = await query<{
    index: number
    claimed_at: Date
    state: SquareState
    category: string | null
  }>(
    `SELECT index, claimed_at, state, category
       FROM squares
      ORDER BY claimed_at DESC
      LIMIT $1`,
    [Math.min(limit, 50)],
  )
  return rows.map((r) => ({
    index: r.index,
    claimedAt: r.claimed_at.toISOString(),
    state: r.state,
    category: r.category,
  }))
}

/** Has this email already been given a square? The soft one-per-person cap. */
export async function emailHasSquare(email: string): Promise<number | null> {
  const row = await queryOne<{ square_index: number }>(
    `SELECT square_index FROM orders
      WHERE email = $1 AND square_index IS NOT NULL
      LIMIT 1`,
    [email],
  )
  return row?.square_index ?? null
}

export class WallSoldOutError extends Error {
  constructor() {
    super('Every square has been claimed.')
    this.name = 'WallSoldOutError'
  }
}

/**
 * Assigns the next square on the center-outward frontier and binds it to an
 * order, in one transaction.
 *
 * `SELECT ... FOR UPDATE` on the single wall_state row serialises assignment,
 * so two webhooks arriving at the same instant cannot be handed the same index.
 * Stripe delivers webhooks at least once, so callers additionally guard on the
 * event id -- see processed_webhooks.
 */
export async function assignSquare(args: {
  orderId: string
  uploadTokenHash: string
}): Promise<{ index: number; ring: number; milestone: number | null }> {
  return transaction(async (client: PoolClient) => {
    // Taken first and held for the whole transaction, even when the index ends
    // up coming from the free list: this row lock is what serialises every
    // assignment in the system, so draining released_squares underneath it
    // cannot hand the same freed index to two callers at once.
    const cursor = await client.query<{ next_index: number }>(
      `SELECT next_index FROM wall_state WHERE id = 1 FOR UPDATE`,
    )
    const nextIndex = cursor.rows[0]?.next_index ?? 0

    /*
     * Reuse before extending.
     *
     * released_squares only ever contains indexes an admin deliberately
     * deleted. Taking the lowest one first means a gap left in the middle of
     * the wall is filled before the frontier moves outward again, which keeps
     * "the earliest buyers are closest to the centre" true rather than leaving
     * a permanent hole that nothing can ever occupy.
     */
    const reclaimed = await client.query<{ index: number }>(
      `DELETE FROM released_squares
        WHERE index = (SELECT index FROM released_squares ORDER BY index ASC LIMIT 1)
        RETURNING index`,
    )
    const reused = reclaimed.rows[0]?.index

    if (reused === undefined && nextIndex >= TOTAL_SQUARES) throw new WallSoldOutError()

    const targetIndex = reused ?? nextIndex
    const cell = indexToCell(targetIndex)
    const milestone = milestoneForIndex(targetIndex)

    await client.query(
      `INSERT INTO squares (index, order_id, ring, x, y, state, upload_token_hash)
       VALUES ($1, $2, $3, $4, $5, 'claimed', $6)`,
      [cell.index, args.orderId, cell.ring, cell.x, cell.y, args.uploadTokenHash],
    )

    await client.query(
      `UPDATE orders SET square_index = $2, milestone = $3 WHERE id = $1`,
      [args.orderId, cell.index, milestone],
    )

    // The cursor only moves when the cursor was what we spent. Filling a gap
    // must not consume a fresh index as well.
    if (reused === undefined) {
      await client.query(
        `UPDATE wall_state SET next_index = $1, updated_at = now() WHERE id = 1`,
        [nextIndex + 1],
      )
    }

    return { index: cell.index, ring: cell.ring, milestone }
  })
}
