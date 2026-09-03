import { Pool, type PoolClient, type QueryResultRow } from 'pg'
import { env } from './env.ts'

/**
 * Postgres access. The database is a separate managed service (Neon/Supabase or
 * similar) from the application code, by design: buyer and square data must not
 * be reachable by a code deploy. See db/migrations/README.md.
 */

declare global {
  // eslint-disable-next-line no-var
  var __amsPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = env.databaseUrl
  return new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX ?? 5),
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: true },
  })
}

export function pool(): Pool {
  if (!globalThis.__amsPool) globalThis.__amsPool = createPool()
  return globalThis.__amsPool
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/** Runs `fn` in a transaction, rolling back on any throw. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
