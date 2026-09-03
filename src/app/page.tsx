import ActivityFeed from '@/components/ActivityFeed'
import Footer from '@/components/Footer'
import Wall from '@/components/Wall'
import { BRAND_NAME, BRAND_TAGLINE, SQUARE_PRICE_DISPLAY, UPLOAD_WINDOW_DAYS, env } from '@/lib/env'
import { getRecentActivity, getStats, getWallCells } from '@/lib/wall/queries'
import { TOTAL_SQUARES } from '@/lib/wall/geometry'

// Stats and the feed must always be current -- they are real numbers about real
// money, and a cached "squares claimed" figure is a wrong one.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [stats, activity, cells] = await Promise.all([
    getStats(),
    getRecentActivity(8),
    getWallCells({ limit: 60_000 }),
  ])

  return (
    <>
      <main>
        {/* 1. Hero ------------------------------------------------------- */}
        <section style={{ padding: '90px 0 64px' }}>
          <div className="wrap">
            <p
              style={{
                fontSize: 13,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                margin: '0 0 22px',
              }}
            >
              {BRAND_NAME}
            </p>
            <h1
              style={{
                fontSize: 'clamp(38px, 7vw, 68px)',
                lineHeight: 1.05,
                letterSpacing: '-.03em',
                margin: '0 0 20px',
                maxWidth: '15ch',
              }}
            >
              {BRAND_TAGLINE}
            </h1>
            <p
              style={{
                fontSize: 19,
                color: 'var(--text-dim)',
                lineHeight: 1.6,
                maxWidth: '52ch',
                margin: '0 0 32px',
              }}
            >
              1,000,000 squares. {SQUARE_PRICE_DISPLAY} each. One per person,
              ever. Upload a single photo and it is locked forever — no edits,
              no second chances.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <a className="btn" href="/claim">
                Claim your square — {SQUARE_PRICE_DISPLAY}
              </a>
              <a className="btn btn-ghost" href="#how">
                How it works
              </a>
            </div>

            {/* Real numbers only. Nothing here is padded or pre-seeded. */}
            <div
              style={{
                display: 'flex',
                gap: 40,
                flexWrap: 'wrap',
                marginTop: 48,
                paddingTop: 28,
                borderTop: '1px solid var(--border)',
              }}
            >
              <Stat
                value={stats.claimed.toLocaleString('en-US')}
                label={`of ${TOTAL_SQUARES.toLocaleString('en-US')} squares claimed`}
              />
              <Stat
                value={stats.activeRegion.remaining.toLocaleString('en-US')}
                label="left in the region open right now"
              />
            </div>
          </div>
        </section>

        {/* 2. The wall --------------------------------------------------- */}
        <section className="section" style={{ paddingTop: 40 }}>
          <div className="wrap">
            <h2>The wall</h2>
            <p className="section-lede">
              Every claimed square, exactly where it is. Squares fill outward
              from the centre, so the earliest buyers really are closest to the
              middle. Look around before you decide what yours will be.
            </p>
            <Wall
              storageBaseUrl={env.storagePublicBaseUrl}
              activeRing={stats.activeRegion.ring}
              initialCells={cells}
            />
          </div>
        </section>

        {/* 3. Activity --------------------------------------------------- */}
        <section className="section">
          <div className="wrap">
            <h2>Just claimed</h2>
            <p className="section-lede">Real claims, as they happen.</p>
            <div style={{ maxWidth: 640 }}>
              <ActivityFeed initial={activity} />
            </div>
          </div>
        </section>

        {/* 4. How it works ----------------------------------------------- */}
        <section className="section" id="how">
          <div className="wrap">
            <h2>How it works</h2>
            <p className="section-lede">Three steps. The third one is permanent.</p>
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              <Step
                n={1}
                title="Get your square"
                body="You do not pick a spot. The next square on the wall is assigned to you automatically, working outward from the centre."
              />
              <Step
                n={2}
                title={`Pay ${SQUARE_PRICE_DISPLAY}`}
                body="One payment, once. No account, no subscription, no renewals. The square is permanently yours the moment you pay."
              />
              <Step
                n={3}
                title="Upload your one photo"
                body={`You have ${UPLOAD_WINDOW_DAYS} days. Once you upload it, it is locked forever — there is no edit button, and there never will be. That is the whole point.`}
              />
            </ol>
          </div>
        </section>

        {/* 5. FAQ -------------------------------------------------------- */}
        <section className="section">
          <div className="wrap">
            <h2>Before you buy</h2>
            <p className="section-lede">
              The awkward questions, answered plainly and up front rather than
              discovered afterwards.
            </p>
            <div style={{ maxWidth: '70ch', display: 'grid', gap: 4 }}>
              <Faq q="Can I change my photo later?">
                No. Not for any reason. Once you upload, it is locked
                permanently — there is no edit or replace anywhere in the
                product. This is the entire idea, not a limitation we plan to
                fix.
              </Faq>
              <Faq q="Can I buy more than one square?">
                No. One square per person, and nothing here will sell you a
                second one. There is no bulk option and no way to buy one for
                someone else.
              </Faq>
              <Faq q={`What happens if I don’t upload within ${UPLOAD_WINDOW_DAYS} days?`}>
                You keep the square. Forever. It stays blank, showing a plain
                neutral tile, and it is never resold or given to anyone else.
                There is no refund.
              </Faq>
              <Faq q="Can I get a refund?">
                No, under any circumstances. Including if you never upload
                anything.
              </Faq>
              <Faq q="What can't I upload?">
                Sexually explicit content, illegal content, hate speech or
                harassment, scams and fraudulent claims, other people&apos;s
                private information, and anything that infringes someone
                else&apos;s copyright or trademark. The full{' '}
                <a href="/content-policy">content policy</a> has the detail. A
                moderator reviews content after it goes live and can remove
                anything that breaks these rules.
              </Faq>
              <Faq q="If my content is removed, do I get my square back?">
                The square stays permanently yours — it is simply blank again,
                and cannot be re-uploaded. No refund, and it is never resold.
              </Faq>
              <Faq q="Do I need an account?">
                No. There are no accounts here at all. After paying you get a
                permanent link to your square, and it is emailed to you. That
                link is how you find it again.
              </Faq>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ color: 'var(--text-faint)', fontSize: 14, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="card">
      <div style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 10 }}>
        Step {n}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.65, fontSize: 15 }}>
        {body}
      </p>
    </li>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '16px 0',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>{q}</summary>
      <div
        style={{
          color: 'var(--text-dim)',
          lineHeight: 1.7,
          marginTop: 10,
          fontSize: 15,
        }}
      >
        {children}
      </div>
    </details>
  )
}
