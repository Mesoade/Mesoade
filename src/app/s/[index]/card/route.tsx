import { ImageResponse } from 'next/og'
import { BRAND_NAME } from '@/lib/env'
import { absoluteUrl } from '@/lib/storage'
import { getSquare } from '@/lib/wall/queries'
import { TOTAL_SQUARES, formatSquareLabel } from '@/lib/wall/geometry'

export const dynamic = 'force-dynamic'

/**
 * The branded share card: 1080x1080, the format people actually post.
 *
 * The point is that what someone shares looks like a thing in its own right --
 * their photo, their coordinates, the brand -- rather than a screenshot of a
 * website.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ index: string }> },
) {
  const { index } = await params
  const squareIndex = Number(index)
  if (!Number.isInteger(squareIndex) || squareIndex < 0 || squareIndex >= TOTAL_SQUARES) {
    return new Response('Not found', { status: 404 })
  }

  const square = await getSquare(squareIndex)
  const label = formatSquareLabel(squareIndex)
  const imageUrl =
    square?.state === 'filled' && square.image_key ? absoluteUrl(square.image_key) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f0f10',
          color: '#e8e8ea',
          fontFamily: 'sans-serif',
          padding: 64,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: '#8a8a94',
            letterSpacing: 3,
            marginBottom: 40,
          }}
        >
          <span>{BRAND_NAME.toUpperCase()}</span>
          <span>AMILLIONSQUARESWORLD.COM</span>
        </div>

        {/* A square photo in a square frame: this is how it appears on the
            wall, and cropping it to a banner would misrepresent it. */}
        <div
          style={{
            display: 'flex',
            width: 700,
            height: 700,
            margin: '0 126px',
            // Neutral tile when there is no photo -- a blank square is a real
            // state, not a broken one.
            background: '#2e2e35',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} width={700} height={700} style={{ objectFit: 'cover' }} alt="" />
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 48,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 32, color: '#b8b8c0', marginTop: 10 }}>of 1,000,000</div>
          </div>
          {/* Satori needs an explicit display on any element with more than
              one child, so these are two stacked divs rather than a <br />. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              fontSize: 30,
              color: '#8a8a94',
              lineHeight: 1.35,
            }}
          >
            <div>You get one.</div>
            <div>Forever.</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
