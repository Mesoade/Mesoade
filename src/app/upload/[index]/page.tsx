import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import UploadForm from '@/components/UploadForm'
import { DENIAL_MESSAGES, checkUploadAccess } from '@/lib/upload-access'
import { formatSquareLabel } from '@/lib/wall/geometry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Upload your photo', robots: { index: false } }

/**
 * The upload screen. It exists only after payment -- nobody is ever blocked
 * from buying by not having their photo ready.
 */
export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ index: string }>
  searchParams: Promise<{ t?: string; session_id?: string }>
}) {
  const { index } = await params
  const { t: token, session_id: sessionId } = await searchParams
  const squareIndex = Number(index)

  const access = Number.isInteger(squareIndex)
    ? await checkUploadAccess({ squareIndex, token, sessionId })
    : ({ ok: false, reason: 'not_found' } as const)

  if (!access.ok) {
    return (
      <>
        <main className="wrap" style={{ maxWidth: 620, padding: '80px 20px' }}>
          <h1 style={{ fontSize: 28, letterSpacing: '-.02em', margin: '0 0 14px' }}>
            This upload link can&apos;t be used.
          </h1>
          <p style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
            {DENIAL_MESSAGES[access.reason]}
          </p>
          <p style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Number.isInteger(squareIndex) && access.reason !== 'not_found' && (
              <a className="btn btn-ghost" href={`/s/${squareIndex}`}>
                See square {formatSquareLabel(squareIndex)}
              </a>
            )}
            <a className="btn btn-ghost" href="/">
              Back to the wall
            </a>
          </p>
        </main>
        <Footer />
      </>
    )
  }

  const deadline = access.grant.deadline

  return (
    <>
      <main className="wrap" style={{ maxWidth: 620, padding: '64px 20px 80px' }}>
        <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 8px' }}>
          Square {formatSquareLabel(squareIndex)}
        </p>
        <h1 style={{ fontSize: 34, letterSpacing: '-.025em', margin: '0 0 10px' }}>
          You get one. Forever. Choose wisely.
        </h1>
        {deadline && (
          <p className="hint" style={{ marginBottom: 30 }}>
            Your upload window closes{' '}
            {deadline.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            . After that the square stays yours — it just stays blank.
          </p>
        )}

        <div className="card">
          <UploadForm
            squareIndex={squareIndex}
            token={token ?? null}
            sessionId={sessionId ?? null}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
