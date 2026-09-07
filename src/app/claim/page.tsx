import type { Metadata } from 'next'
import ClaimForm from '@/components/ClaimForm'
import Footer from '@/components/Footer'
import { BRAND_TAGLINE, SQUARE_PRICE_DISPLAY } from '@/lib/env'
import { getStats } from '@/lib/wall/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Claim your square' }

export default async function ClaimPage() {
  const stats = await getStats()
  const soldOut = stats.activeRegion.remaining === 0 && stats.claimed >= stats.total

  return (
    <>
      <main className="wrap" style={{ maxWidth: 620, padding: '64px 20px 80px' }}>
        <a href="/" style={{ fontSize: 14 }}>
          ← Back to the wall
        </a>

        <h1
          style={{
            fontSize: 'clamp(30px, 5vw, 42px)',
            letterSpacing: '-.025em',
            lineHeight: 1.1,
            margin: '26px 0 14px',
          }}
        >
          {BRAND_TAGLINE}
        </h1>

        {soldOut ? (
          <div className="card">
            <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-dim)' }}>
              Every one of the 1,000,000 squares has been claimed. There are no
              more, and there will never be more.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, fontSize: 17 }}>
              You pay {SQUARE_PRICE_DISPLAY} once. Then you choose the one photo
              that stays here for good.
            </p>

            <div className="card" style={{ marginTop: 28 }}>
              <ClaimForm />
            </div>

            <p className="hint" style={{ marginTop: 20 }}>
              Payment is handled by Stripe. We never see your card details, and
              no account is created anywhere.
            </p>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
