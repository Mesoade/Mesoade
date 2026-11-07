import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { OG, OG_SIZE, ogFontConfig } from '@/app/_og/shared'
import { BRAND_NAME } from '@/lib/env'
import { absoluteUrl } from '@/lib/storage'
import { getSquare } from '@/lib/wall/queries'
import { TOTAL_SQUARES, formatSquareLabel } from '@/lib/wall/geometry'

/**
 * Link-preview card for a square: the photograph on the left, what it is on
 * the right.
 *
 * The square-format card people post to Instagram is a separate, larger
 * image -- see ./card/route.tsx.
 *
 * WhatsApp will not render a preview much over 300 KB, and next/og can only
 * emit PNG, which encodes photographic detail terribly: a card measured at
 * 1.04 MB with a photograph on it. So the PNG is re-encoded to JPEG before it
 * is served -- the same card measures 141 KB that way, on noise, which is the
 * worst input there is.
 */
export const alt = `A square on ${BRAND_NAME}`
export const size = OG_SIZE
export const contentType = 'image/jpeg'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PHOTO_W = 520
/** Width left for the text, after the photo and the column's padding. */
const TEXT_W = OG_SIZE.width - PHOTO_W - 128

/**
 * The headline has to hold anything from "Square #0" to "Square #1,000,000",
 * so it is sized to the string rather than fixed: at a fixed size the longest
 * labels wrapped between the word and the number, which read as a mistake.
 */
function headlineSize(text: string): number {
  return Math.max(44, Math.min(84, Math.floor(TEXT_W / (0.62 * text.length))))
}

export default async function Image({ params }: { params: Promise<{ index: string }> }) {
  const { index } = await params
  const squareIndex = Number(index)
  const square = Number.isInteger(squareIndex) ? await getSquare(squareIndex) : null
  const label = Number.isInteger(squareIndex) ? formatSquareLabel(squareIndex) : '#?'
  const imageUrl =
    square?.state === 'filled' && square.image_key ? absoluteUrl(square.image_key) : null
  const headline = `Square ${label}`

  const png = await new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: OG.paper,
          fontFamily: 'UI',
        }}
      >
        <div
          style={{
            width: PHOTO_W,
            height: OG_SIZE.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: OG.paperRaised,
            borderRight: `1px solid ${OG.rule}`,
          }}
        >
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              width={PHOTO_W}
              height={OG_SIZE.height}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          ) : (
            <div style={{ display: 'flex', fontSize: 150, color: OG.rule, fontFamily: 'Display' }}>
              ?
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 64px',
          }}
        >
          <div
            style={{
              fontSize: 21,
              letterSpacing: 4,
              color: OG.ember,
              textTransform: 'uppercase',
            }}
          >
            {BRAND_NAME}
          </div>
          <div
            style={{
              fontFamily: 'Display',
              fontSize: headlineSize(headline),
              color: OG.ink,
              letterSpacing: -2,
              lineHeight: 1,
              marginTop: 26,
            }}
          >
            {headline}
          </div>
          <div style={{ fontSize: 34, color: OG.ink2, marginTop: 14 }}>
            {`of ${TOTAL_SQUARES.toLocaleString('en-US')}`}
          </div>
          <div style={{ display: 'flex', width: 92, height: 2, background: OG.ember, marginTop: 40 }} />
          <div style={{ fontSize: 30, color: OG.ink2, marginTop: 28 }}>
            One per person. Forever.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFontConfig() },
  ).arrayBuffer()

  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 86, mozjpeg: true }).toBuffer()

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // A filled square never changes, but a blank one becomes filled, so the
      // card is allowed to go stale for an hour rather than forever.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
