import ActivityFeed from '@/components/ActivityFeed'
import { Faq, FaqItem } from '@/components/Faq'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import Wall from '@/components/Wall'
import { BRAND_NAME, SQUARE_PRICE_DISPLAY, UPLOAD_WINDOW_DAYS, env } from '@/lib/env'
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
        {/* 1. Hero -------------------------------------------------------
            No photography, no illustration: type, colour and space carry
            the whole thing. One accent lands on one word. */}
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow enter enter-1">{BRAND_NAME}</p>

            <h1 className="hero-title enter enter-2">
              You get one.
              <span className="hero-forever">Forever.</span>
              Choose wisely.
            </h1>

            <p className="hero-sub enter enter-3">
              A million people will each get to do this exactly once. Somewhere
              in that million is your one square. What&apos;s the photo
              you&apos;d actually want it to be?
            </p>

            <div className="hero-actions enter enter-4">
              <a className="btn" href="/claim">
                Claim your square, {SQUARE_PRICE_DISPLAY}
              </a>
              <a className="link-quiet" href="#how">
                How it works
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            {/* A real count of real rows. Nothing here is padded, seeded or
                rounded -- see getStats() in src/lib/wall/queries.ts. */}
            <p className="hero-stat enter enter-5">
              <span className="live-dot" aria-hidden="true" />
              <span>
                <ClaimedCount n={stats.claimed} />
              </span>
            </p>
          </div>
        </section>

        {/* 2. The wall ---------------------------------------------------
            The one dark band on the page, and it earns itself: real
            photographs need dark surroundings to read as photographs. */}
        <section className="section-vault">
          <div className="wrap">
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              The wall
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 38px)', margin: '0 0 10px' }}>
              Every square that has been claimed.
            </h2>
            <p className="section-lede" style={{ marginBottom: 26 }}>
              Squares fill outward from the centre, so the earliest buyers
              really are closest to the middle.{' '}
              <span className="num" style={{ color: 'var(--vault-ink)' }}>
                {stats.activeRegion.remaining.toLocaleString('en-US')}
              </span>{' '}
              are left in the region open right now. Look around before you
              decide what yours will be.
            </p>

            <Wall
              storageBaseUrl={env.storagePublicBaseUrl}
              activeRing={stats.activeRegion.ring}
              initialCells={cells}
            />

            {/* Live claims sit with the wall rather than in their own band --
                they are the same product content, describing the same thing. */}
            <div
              style={{
                marginTop: 44,
                paddingTop: 28,
                borderTop: '1px solid var(--vault-rule)',
              }}
            >
              <p className="eyebrow" style={{ marginBottom: 16 }}>
                Just claimed
              </p>
              <div style={{ maxWidth: 660 }}>
                <ActivityFeed initial={activity} />
              </div>
            </div>
          </div>
        </section>

        {/* 3. How it works ----------------------------------------------- */}
        <section className="section" id="how" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 14 }}>
                How it works
              </p>
              <h2>Three steps. The third one is permanent.</h2>
              <p className="section-lede">
                You do not pick a spot and you do not get a second attempt.
                Both of those are the point, not a limitation.
              </p>
            </Reveal>

            <ol className="steps">
              <Step
                n={1}
                delay={0}
                title="Get your square"
                body="You do not pick a spot. The next square on the wall is assigned to you automatically, working outward from the centre."
              />
              <Step
                n={2}
                delay={60}
                title={`Pay ${SQUARE_PRICE_DISPLAY}`}
                body="One payment, once. No account, no subscription, no renewals. The square is permanently yours the moment you pay."
              />
              <Step
                n={3}
                delay={120}
                title="Upload your one photo"
                body={`You have ${UPLOAD_WINDOW_DAYS} days. Once you upload it, it is locked forever — there is no edit button, and there never will be. That is the whole point.`}
              />
            </ol>
          </div>
        </section>

        {/* 4. FAQ --------------------------------------------------------- */}
        <section className="section">
          <div className="wrap">
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 14 }}>
                Before you buy
              </p>
              <h2>The awkward questions, up front.</h2>
              <p className="section-lede">
                Answered plainly here rather than discovered afterwards.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <Faq>
                <FaqItem q="Can I change my photo later?">
                  No. Not for any reason. Once you upload, it is locked
                  permanently — there is no edit or replace anywhere in the
                  product. This is the entire idea, not a limitation we plan to
                  fix.
                </FaqItem>
                <FaqItem q="Can I buy more than one square?">
                  No. One square per person, and nothing here will sell you a
                  second one. There is no bulk option and no way to buy one for
                  someone else.
                </FaqItem>
                <FaqItem
                  q={`What happens if I don’t upload within ${UPLOAD_WINDOW_DAYS} days?`}
                >
                  You keep the square. Forever. It stays blank, showing a plain
                  neutral tile, and it is never resold or given to anyone else.
                  There is no refund.
                </FaqItem>
                <FaqItem q="Can I get a refund?">
                  No, under any circumstances. Including if you never upload
                  anything.
                </FaqItem>
                <FaqItem q="What can't I upload?">
                  Sexually explicit content, illegal content, hate speech or
                  harassment, scams and fraudulent claims, other people&apos;s
                  private information, and anything that infringes someone
                  else&apos;s copyright or trademark. The full{' '}
                  <a href="/content-policy">content policy</a> has the detail. A
                  moderator reviews content after it goes live and can remove
                  anything that breaks these rules.
                </FaqItem>
                <FaqItem q="If my content is removed, do I get my square back?">
                  The square stays permanently yours — it is simply blank again,
                  and cannot be re-uploaded. No refund, and it is never resold.
                </FaqItem>
                <FaqItem q="Do I need an account?">
                  No. There are no accounts here at all. After paying you get a
                  permanent link to your square, and it is emailed to you. That
                  link is how you find it again.
                </FaqItem>
              </Faq>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}

/**
 * The live claimed count.
 *
 * Wired straight to the real row count, including when that count is zero --
 * "0 people have already claimed theirs" is a true sentence, and a fabricated
 * starting number is the one thing this product cannot afford. Only the
 * singular is special-cased, because "1 people" is a bug rather than a number.
 */
function ClaimedCount({ n }: { n: number }) {
  return (
    <>
      <strong className="num">{n.toLocaleString('en-US')}</strong>{' '}
      {n === 1 ? 'person has' : 'people have'} already claimed theirs.
    </>
  )
}

function Step({
  n,
  title,
  body,
  delay,
}: {
  n: number
  title: string
  body: string
  delay: number
}) {
  return (
    <Reveal as="li" className="step" delay={delay}>
      <div className="step-n" aria-hidden="true">
        {n}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </Reveal>
  )
}
