import { NextResponse } from 'next/server'
import { getWallCells } from '@/lib/wall/queries'
import { GRID_SIZE } from '@/lib/wall/geometry'

export const dynamic = 'force-dynamic'

/** Viewport-windowed cell data for the canvas renderer. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const coord = (name: string, fallback: number) => {
    const raw = Number(url.searchParams.get(name))
    if (!Number.isFinite(raw)) return fallback
    return Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(raw)))
  }

  const cells = await getWallCells({
    minX: coord('minX', 0),
    maxX: coord('maxX', GRID_SIZE - 1),
    minY: coord('minY', 0),
    maxY: coord('maxY', GRID_SIZE - 1),
    category: url.searchParams.get('category'),
    limit: 60_000,
  })

  return NextResponse.json({ cells }, { headers: { 'Cache-Control': 'no-store' } })
}
