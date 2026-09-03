import { NextResponse } from 'next/server'
import { getRecentActivity } from '@/lib/wall/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await getRecentActivity(8)
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}
