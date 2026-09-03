import { BRAND_NAME } from '@/lib/env'

/**
 * No admin link here, or anywhere else public. Obscurity is not security --
 * /admin has a password -- but there is no reason to advertise the door.
 */
export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        padding: '40px 0 60px',
        color: 'var(--text-faint)',
        fontSize: 14,
      }}
    >
      <div className="wrap">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/content-policy">Content policy</a>
          <a href="/dmca">Copyright / DMCA</a>
          <a href="/contact">Contact &amp; report abuse</a>
        </div>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {BRAND_NAME} — 1,000,000 squares, $10 each, one per person. No refunds.
          Content is permanent once uploaded.
        </p>
      </div>
    </footer>
  )
}
