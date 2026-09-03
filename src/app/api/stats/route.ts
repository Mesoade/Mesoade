import { NextResponse } from 'next/server'
import { getStats } from '@/lib/wall/queries'

export const dynamic = 'force-dynamic'

/** Public stats. Every figure is a real count -- see src/lib/wall/queries.ts. */
export async function GET() {
  const stats = await getStats()
  return NextResponse.json(
    {
      claimed: stats.claimed,
      filled: stats.filled,
      total: stats.total,
      fillPercent: stats.fillPercent,
      activeRegion: stats.activeRegion,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
