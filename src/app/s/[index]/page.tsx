import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import ReportButton from '@/components/ReportButton'
import ShareLinks from '@/components/ShareLinks'
import { categoryLabel } from '@/lib/categories'
import { BRAND_NAME, env } from '@/lib/env'
import { publicUrl } from '@/lib/storage'
import { getSquare } from '@/lib/wall/queries'
import { TOTAL_SQUARES, formatSquareLabel } from '@/lib/wall/geometry'

export const dynamic = 'force-dynamic'

/**
 * The permanent per-square page.
 *
 * With no accounts and no search, this URL is the whole access mechanism: it is
 * how a buyer finds their square again, and it is what they share. It never
 * changes and never expires.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ index: string }>
}): Promise<Metadata> {
  const { index } = await params
  const squareIndex = Number(index)
  if (!Number.isInteger(squareIndex)) return { title: 'Square not found' }

  const label = formatSquareLabel(squareIndex)
  const total = TOTAL_SQUARES.toLocaleString('en-US')
  const square = await getSquare(squareIndex)

  // The owner's story is what makes a shared link worth opening, so it is the
  // description wherever there is one. Trimmed on a word boundary, because a
  // sentence cut mid-word reads as a bug in the preview.
  const description = summarise(square?.caption) ?? NO_STORY_DESCRIPTION
  const title = `Square ${label} of ${total}`
  const path = `/s/${squareIndex}`

  return {
    title: `Square ${label}`,
    description,
    alternates: { canonical: path },
    openGraph: {
      // Spelled out rather than left to the title template, so the card reads
      // the same wherever it is unfurled.
      title: `${title} | ${BRAND_NAME}`,
      description,
      // Relative: Next resolves it against metadataBase, which is built from
      // NEXT_PUBLIC_SITE_URL.
      url: path,
      type: 'article',
      images: [
        {
          url: `${path}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Square ${label} on ${BRAND_NAME}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${BRAND_NAME}`,
      description,
    },
  }
}

/** What a square with no story says instead. */
const NO_STORY_DESCRIPTION =
  'One million squares. $10 each. One per person, forever. Which photo would you choose?'

const DESCRIPTION_LIMIT = 150

/** First ~150 characters of a story, cut at a word rather than mid-word. */
function summarise(caption: string | null | undefined): string | null {
  const text = caption?.trim().replace(/\s+/g, ' ')
  if (!text) return null
  if (text.length <= DESCRIPTION_LIMIT) return text
  const cut = text.slice(0, DESCRIPTION_LIMIT)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

export default async function SquarePage({
  params,
}: {
  params: Promise<{ index: string }>
}) {
  const { index } = await params
  const squareIndex = Number(index)
  if (!Number.isInteger(squareIndex) || squareIndex < 0 || squareIndex >= TOTAL_SQUARES) {
    notFound()
  }

  const square = await getSquare(squareIndex)
  const label = formatSquareLabel(squareIndex)
  const url = `${env.siteUrl}/s/${squareIndex}`

  // Not claimed yet. This is a real, honest state -- the square exists in the
  // grid, nobody has bought it.
  if (!square) {
    return (
      <>
        <main className="wrap" style={{ maxWidth: 620, padding: '80px 20px' }}>
          <h1 style={{ fontSize: 30, letterSpacing: '-.02em', margin: '0 0 12px' }}>
            Square {label} hasn&apos;t been claimed.
          </h1>
          <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
            Squares are assigned automatically from the centre outward, so this
            one isn&apos;t something you can pick, but the next one out is
            available right now.
          </p>
          <p style={{ marginTop: 26 }}>
            <a className="btn" href="/claim">
              Claim your square for $10
            </a>
          </p>
        </main>
        <Footer />
      </>
    )
  }

  const filled = square.state === 'filled' && square.image_key
  const claimedOn = square.claimed_at.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <main className="wrap" style={{ maxWidth: 680, padding: '56px 20px 72px' }}>
        <a href="/" style={{ fontSize: 14 }}>
          ← The wall
        </a>

        <div style={{ marginTop: 26 }}>
          {filled ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={publicUrl(square.image_key!)}
              alt={square.caption ?? `Square ${label}`}
              style={{
                width: '100%',
                maxWidth: 460,
                aspectRatio: '1 / 1',
                // Contain, not cover: this is the page a buyer shares and
                // returns to, and cropping their one permanent photo to fit a
                // square frame is exactly the thing not to do here.
                objectFit: 'contain',
                background: 'var(--paper-sunk)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          ) : (
            /*
             * The neutral default treatment: a plain colour, never an empty
             * hole. Used identically whether the square was never filled in or
             * had its content removed -- the wall should not look broken, and a
             * removed square should not be publicly marked as shameful.
             */
            <div
              style={{
                width: '100%',
                maxWidth: 460,
                aspectRatio: '1 / 1',
                borderRadius: 14,
                background: 'var(--square-blank)',
                border: '1px solid var(--border)',
              }}
            />
          )}
        </div>

        <h1 style={{ fontSize: 30, letterSpacing: '-.02em', margin: '28px 0 6px' }}>
          Square {label}
        </h1>
        <p style={{ color: 'var(--text-faint)', margin: '0 0 22px', fontSize: 14 }}>
          {label} of {TOTAL_SQUARES.toLocaleString('en-US')} · claimed {claimedOn}
          {square.category && ` · ${categoryLabel(square.category)}`}
        </p>

        {square.caption && (
          <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text)', maxWidth: '58ch' }}>
            {square.caption}
          </p>
        )}

        {square.link_url && (
          <p style={{ margin: '14px 0' }}>
            <a href={square.link_url} rel="noreferrer noopener nofollow ugc" target="_blank">
              {square.link_url}
            </a>
          </p>
        )}

        {square.state === 'claimed' && (
          <p className="hint" style={{ maxWidth: '58ch' }}>
            This square is claimed and permanently owned, but nothing has been
            uploaded to it. It stays exactly like this.
          </p>
        )}

        {square.state === 'removed' && (
          <p className="hint" style={{ maxWidth: '58ch' }}>
            The content that was here was removed under the{' '}
            <a href="/content-policy">content policy</a>. The square remains
            permanently owned by the person who bought it, and cannot be
            uploaded to again.
          </p>
        )}

        <div style={{ marginTop: 34, paddingTop: 26, borderTop: '1px solid var(--border)' }}>
          <ShareLinks
            url={url}
            label={label}
            brand={BRAND_NAME}
            total={TOTAL_SQUARES.toLocaleString('en-US')}
          />
        </div>

        <div style={{ marginTop: 26 }}>
          <ReportButton squareIndex={squareIndex} />
        </div>

        <div style={{ marginTop: 40, paddingTop: 26, borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, margin: '0 0 16px' }}>
            One million squares. $10 each. One per person, ever.
          </p>
          <a className="btn" href="/claim">
            Claim yours for $10
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}
