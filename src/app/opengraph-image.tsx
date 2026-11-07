import { ImageResponse } from 'next/og'
import { OG, OG_SIZE, ogFontConfig } from '@/app/_og/shared'
import { BRAND_NAME, SQUARE_PRICE_DISPLAY } from '@/lib/env'
import { TOTAL_SQUARES } from '@/lib/wall/geometry'

/** The default link-preview card, used anywhere without one of its own. */
export const alt = BRAND_NAME
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: OG.paper,
          fontFamily: 'UI',
          padding: '0 86px',
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, color: OG.ember, textTransform: 'uppercase' }}>
          {BRAND_NAME}
        </div>
        <div
          style={{
            fontFamily: 'Display',
            fontSize: 96,
            color: OG.ink,
            letterSpacing: -3,
            lineHeight: 1.04,
            marginTop: 30,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex' }}>You get one. Forever.</div>
          <div style={{ display: 'flex' }}>Make it count.</div>
        </div>
        <div style={{ display: 'flex', width: 110, height: 2, background: OG.ember, marginTop: 46 }} />
        <div style={{ fontSize: 31, color: OG.ink2, marginTop: 32 }}>
          {`${TOTAL_SQUARES.toLocaleString('en-US')} squares · ${SQUARE_PRICE_DISPLAY} each · one per person`}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFontConfig() },
  )
}
