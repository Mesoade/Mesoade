import { NextResponse } from 'next/server'
import { ACTIVITY_FEED_SIZE, getRecentActivity } from '@/lib/wall/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await getRecentActivity(ACTIVITY_FEED_SIZE)
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}
