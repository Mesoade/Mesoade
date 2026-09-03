import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { query } from '@/lib/db'
import { publicUrl } from '@/lib/storage'
import { formatSquareLabel } from '@/lib/wall/geometry'
import { removeContent, resolveReport } from '../actions'

export const metadata: Metadata = {
  title: 'Reports',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

interface ReportRow {
  id: string
  square_index: number
  reason: string
  details: string | null
  created_at: Date
  state: 'claimed' | 'filled' | 'removed'
  image_key: string | null
  caption: string | null
}

export default async function ReportsPage() {
  if (!(await isAdmin())) redirect('/admin/login')

  const reports = await query<ReportRow>(
    `SELECT r.id, r.square_index, r.reason, r.details, r.created_at,
            s.state, s.image_key, s.caption
       FROM reports r
       JOIN squares s ON s.index = r.square_index
      WHERE r.status = 'open'
      ORDER BY r.created_at ASC
      LIMIT 200`,
  )

  return (
    <main className="wrap" style={{ padding: '40px 20px 80px', maxWidth: 860 }}>
      <a href="/admin" style={{ fontSize: 14 }}>
        ← Moderation
      </a>
      <h1 style={{ fontSize: 22, margin: '20px 0 6px' }}>Open reports</h1>
      <p className="hint" style={{ margin: '0 0 26px' }}>
        Oldest first — these are the ones that have been live and unreviewed the
        longest.
      </p>

      {reports.length === 0 && <p className="hint">Nothing reported right now.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {reports.map((r) => (
          <div key={r.id} className="card" style={{ padding: 16, display: 'flex', gap: 16 }}>
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
              {r.state === 'filled' && r.image_key && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={publicUrl(r.image_key)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <a href={`/s/${r.square_index}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                {formatSquareLabel(r.square_index)}
              </a>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
                Reported as <strong style={{ color: 'var(--text-dim)' }}>{r.reason}</strong> ·{' '}
                {r.created_at.toISOString().slice(0, 16).replace('T', ' ')} UTC
                {r.state !== 'filled' && ' · content already removed'}
              </div>
              {r.details && (
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
                  {r.details}
                </p>
              )}
              {r.caption && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-faint)' }}>
                  Caption: {r.caption}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {r.state === 'filled' && (
                <form action={removeContent}>
                  <input type="hidden" name="squareIndex" value={r.square_index} />
                  <input type="hidden" name="reason" value={`Report: ${r.reason}`} />
                  <button
                    className="btn btn-ghost"
                    type="submit"
                    style={{ padding: '7px 12px', fontSize: 13, color: '#ff9ba0' }}
                  >
                    Remove content
                  </button>
                </form>
              )}
              <form action={resolveReport}>
                <input type="hidden" name="reportId" value={r.id} />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  style={{ padding: '7px 12px', fontSize: 13 }}
                >
                  Dismiss
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
