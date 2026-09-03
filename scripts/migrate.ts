/**
 * Applies db/migrations/*.sql in filename order.
 *
 * Applied filenames are recorded in schema_migrations, so re-running is a
 * no-op. Migrations are additive by policy -- see db/migrations/README.md.
 *
 *   npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'

const DIR = join(process.cwd(), 'db', 'migrations')

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: true },
  })
  await client.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const applied = new Set(
    (await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map(
      (r) => r.filename,
    ),
  )

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()
  let count = 0

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(DIR, file), 'utf8')
    process.stdout.write(`applying ${file} ... `)
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log('ok')
      count++
    } catch (err) {
      await client.query('ROLLBACK')
      console.log('failed')
      console.error(err)
      await client.end()
      process.exit(1)
    }
  }

  console.log(count === 0 ? 'Already up to date.' : `Applied ${count} migration(s).`)
  await client.end()
}

void main()
