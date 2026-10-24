import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { query } from '@/lib/db'
import { categoryLabel } from '@/lib/categories'
import { publicUrl } from '@/lib/storage'
import { UPLOAD_WINDOW_DAYS } from '@/lib/env'
import { getStats } from '@/lib/wall/queries'
import { formatSquareLabel } from '@/lib/wall/geometry'
import { deleteSquare, grantSquare, logout, removeContent } from './actions'

export const metadata: Metadata = {
  title: 'Moderation',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

interface RecentRow {
  index: number
  state: 'claimed' | 'filled' | 'removed'
  claimed_at: Date
  image_key: string | null
  caption: string | null
  link_url: string | null
  category: string | null
  email: string
  milestone: number | null
  open_reports: string
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    granted?: string
    t?: string
    error?: string
    notice?: string
  }>
}) {
  if (!(await isAdmin())) redirect('/admin/login')

  const sp = await searchParams
  const grantedIndex = Number(sp.granted)
  const granted =
    Number.isInteger(grantedIndex) && sp.t
      ? { index: grantedIndex, token: sp.t }
      : null

  const [stats, recent, counters] = await Promise.all([
    getStats(),
    query<RecentRow>(
      `SELECT s.index, s.state, s.claimed_at, s.image_key, s.caption, s.link_url,
              s.category, o.email, o.milestone,
              (SELECT count(*) FROM reports r
                WHERE r.square_index = s.index AND r.status = 'open') AS open_reports
         FROM squares s
         JOIN orders o ON o.id = s.order_id
        ORDER BY s.claimed_at DESC
        LIMIT 60`,
    ),
    query<{ open_reports: string; duplicates: string; last_7_days: string; flagged_scans: string }>(
      `SELECT
         (SELECT count(*) FROM reports WHERE status = 'open') AS open_reports,
         (SELECT count(*) FROM orders WHERE status = 'duplicate') AS duplicates,
         (SELECT count(*) FROM squares WHERE claimed_at > now() - interval '7 days') AS last_7_days,
         (SELECT count(*) FROM moderation_scans WHERE verdict = 'flagged') AS flagged_scans`,
    ),
  ])

  const c = counters[0]

  return (
    <main className="wrap" style={{ padding: '40px 20px 80px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Moderation</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/admin/reports">
            Reports{Number(c?.open_reports ?? 0) > 0 ? ` (${c?.open_reports})` : ''}
          </a>
          <form action={logout}>
            <button className="btn btn-ghost" type="submit" style={{ padding: '8px 14px' }}>
              Sign out
            </button>
          </form>
        </div>
      </div>

      <section
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          marginBottom: 40,
        }}
      >
        <Metric label="Squares claimed" value={stats.claimed.toLocaleString('en-US')} />
        <Metric
          label="Revenue"
          value={`$${(stats.revenueCents / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
        <Metric label="Claimed in last 7 days" value={Number(c?.last_7_days ?? 0).toLocaleString('en-US')} />
        <Metric label="Photos uploaded" value={stats.filled.toLocaleString('en-US')} />
        <Metric
          label={`Left in ring ${stats.activeRegion.ring}`}
          value={stats.activeRegion.remaining.toLocaleString('en-US')}
        />
        <Metric label="Wall filled" value={`${stats.fillPercent.toFixed(4)}%`} />
        <Metric
          label="Released, awaiting reuse"
          value={stats.released.toLocaleString('en-US')}
        />
        <Metric label="Open reports" value={String(c?.open_reports ?? 0)} />
        <Metric label="Duplicate purchases" value={String(c?.duplicates ?? 0)} />
        <Metric label="CSAM scan hits" value={String(c?.flagged_scans ?? 0)} />
      </section>

      {sp.error && (
        <div className="error" style={{ marginBottom: 24, fontSize: 15 }}>
          {sp.error}
        </div>
      )}

      {sp.notice && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderColor: 'var(--patina)',
            background: 'var(--patina-wash)',
            fontSize: 15,
            color: 'var(--ink)',
          }}
        >
          {sp.notice}
        </div>
      )}

      {granted && (
        <div
          className="card"
          style={{
            marginBottom: 28,
            borderColor: 'var(--ember-deep)',
            background: 'var(--ember-wash)',
          }}
        >
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>
            {formatSquareLabel(granted.index)} is yours.
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-dim)' }}>
            Upload link below. It is also in the confirmation email, but copy it
            now — this is the only time it is shown in plain text, and it is the
            only way onto the upload screen.
          </p>
          <code
            style={{
              display: 'block',
              wordBreak: 'break-all',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            {`/upload/${granted.index}?t=${granted.token}`}
          </code>
          <p style={{ margin: '12px 0 0' }}>
            <a className="btn" href={`/upload/${granted.index}?t=${granted.token}`}>
              Open the upload screen
            </a>
          </p>
        </div>
      )}

      <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Give yourself a square</h2>
      <p className="hint" style={{ margin: '0 0 14px' }}>
        Assigns the next square from the same pool as everyone else, with no
        payment. It behaves exactly like a bought square afterwards: same
        permanent URL, same upload screen, same {UPLOAD_WINDOW_DAYS}-day window,
        and locked forever once a photo is on it. The one-per-person rule does
        not apply here, so this can be used as often as you like.
      </p>
      <form
        action={grantSquare}
        className="card"
        style={{ marginBottom: 36, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <label className="field" style={{ margin: 0, flex: '1 1 260px' }}>
          <span>Email for the grant</span>
          <input type="email" name="email" required placeholder="you@example.com" />
        </label>
        <label className="field" style={{ margin: 0, flex: '1 1 260px' }}>
          <span>
            Time-capsule note <em style={{ color: 'var(--text-faint)' }}>(optional)</em>
          </span>
          <input type="text" name="note" placeholder="Left for your future self" />
        </label>
        <button className="btn" type="submit">
          Assign a square
        </button>
      </form>

      <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Recently claimed</h2>
      <p className="hint" style={{ margin: '0 0 20px' }}>
        Newest first. Removing content leaves the square permanently owned by its
        buyer — it simply shows the neutral tile, exactly like a square that was
        never filled in. There is no refund and it is never resold.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {recent.length === 0 && <p className="hint">No squares claimed yet.</p>}
        {recent.map((row) => (
          <div
            key={row.index}
            className="card"
            style={{
              padding: 16,
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              borderColor:
                Number(row.open_reports) > 0 ? 'rgba(229,72,77,.45)' : 'var(--border)',
            }}
          >
            <div
              style={{
                width: 78,
                height: 78,
                borderRadius: 8,
                background: 'var(--square-blank)',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {row.state === 'filled' && row.image_key && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={publicUrl(row.image_key)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`/s/${row.index}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {formatSquareLabel(row.index)}
                </a>
                <Tag>{row.state}</Tag>
                {row.category && <Tag>{categoryLabel(row.category)}</Tag>}
                {row.milestone && <Tag>milestone: {row.milestone.toLocaleString('en-US')}</Tag>}
                {Number(row.open_reports) > 0 && (
                  <Tag danger>{row.open_reports} open report(s)</Tag>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 5 }}>
                {row.email} · {row.claimed_at.toISOString().slice(0, 16).replace('T', ' ')} UTC
              </div>
              {row.caption && (
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
                  {row.caption}
                </p>
              )}
              {row.link_url && (
                <p style={{ margin: '5px 0 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-faint)' }}>{row.link_url}</span>
                </p>
              )}
            </div>

            <div style={{ flexShrink: 0, display: 'grid', gap: 10 }}>
            {row.state === 'filled' && (
              <form action={removeContent}>
                <input type="hidden" name="squareIndex" value={row.index} />
                <input
                  type="text"
                  name="reason"
                  placeholder="Reason"
                  style={{
                    display: 'block',
                    width: 150,
                    marginBottom: 8,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    padding: '7px 9px',
                    fontSize: 13,
                  }}
                />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  style={{ padding: '7px 12px', fontSize: 13, color: '#ff9ba0' }}
                >
                  Remove content
                </button>
              </form>
            )}

            <form action={deleteSquare}>
              <input type="hidden" name="squareIndex" value={row.index} />
              <input
                type="text"
                name="confirmIndex"
                placeholder={`Type ${row.index}`}
                autoComplete="off"
                style={{
                  display: 'block',
                  width: 150,
                  marginBottom: 8,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  padding: '7px 9px',
                  fontSize: 13,
                }}
              />
              <button
                className="btn btn-ghost"
                type="submit"
                style={{ padding: '7px 12px', fontSize: 13, color: 'var(--danger)' }}
              >
                Delete square
              </button>
            </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 650 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Tag({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        padding: '3px 7px',
        borderRadius: 5,
        border: `1px solid ${danger ? 'rgba(229,72,77,.45)' : 'var(--border)'}`,
        color: danger ? '#ff9ba0' : 'var(--text-faint)',
      }}
    >
      {children}
    </span>
  )
}
