import { ImageResponse } from 'next/og'
import { BRAND_NAME } from '@/lib/env'
import { absoluteUrl } from '@/lib/storage'
import { getSquare } from '@/lib/wall/queries'
import { formatSquareLabel } from '@/lib/wall/geometry'

/**
 * Link-preview card for a square (X, Facebook, Slack, iMessage).
 *
 * The square-format card people actually post to Instagram is a separate,
 * larger image -- see ./card/route.tsx.
 */
export const alt = `A square on ${BRAND_NAME}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

export default async function Image({ params }: { params: Promise<{ index: string }> }) {
  const { index } = await params
  const squareIndex = Number(index)
  const square = Number.isInteger(squareIndex) ? await getSquare(squareIndex) : null
  const label = Number.isInteger(squareIndex) ? formatSquareLabel(squareIndex) : '#—'
  const imageUrl =
    square?.state === 'filled' && square.image_key ? absoluteUrl(square.image_key) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0f0f10',
          color: '#e8e8ea',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 630,
            height: 630,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#2e2e35',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} width={630} height={630} style={{ objectFit: 'cover' }} alt="" />
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 56px',
          }}
        >
          <div style={{ fontSize: 22, color: '#8a8a94', letterSpacing: 3, marginBottom: 22 }}>
            {BRAND_NAME.toUpperCase()}
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
            {label}
          </div>
          <div style={{ fontSize: 30, color: '#b8b8c0', marginTop: 12 }}>of 1,000,000</div>
          <div style={{ fontSize: 26, color: '#8a8a94', marginTop: 40, lineHeight: 1.4 }}>
            You get one. Forever.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
