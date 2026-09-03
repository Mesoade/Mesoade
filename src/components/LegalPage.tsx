import Footer from './Footer'
import { hasUnfilledPlaceholders } from '@/lib/legal'

/** Shared shell for the policy documents. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <>
      <main className="wrap" style={{ padding: '56px 20px 72px' }}>
        <a href="/" style={{ fontSize: 14 }}>
          ← The wall
        </a>
        <div className="prose" style={{ marginTop: 26 }}>
          <h1>{title}</h1>
          <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 28px' }}>
            Last updated: {updated}
          </p>

          {hasUnfilledPlaceholders() && (
            <p className="placeholder-note">
              <strong>Not ready for launch.</strong> This document still contains
              bracketed placeholders such as{' '}
              <code>[LEGAL_ENTITY_NAME]</code>. Fill them in via the{' '}
              <code>LEGAL_*</code> environment variables (see{' '}
              <code>src/lib/legal.ts</code>) before taking real payments. This
              notice disappears once they are all set.
            </p>
          )}

          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
