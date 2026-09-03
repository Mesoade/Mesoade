/**
 * Launch seeding.
 *
 * The cold-start problem is real: a handful of squares scattered across an
 * apparently-empty million-cell field looks broken. The brief's answer is to
 * seed the centre with GENUINE content -- yours, your friends', your family's --
 * before running any ads, so day-one visitors see a small, dense, real cluster.
 *
 * This script creates real square records from real image files. It does NOT
 * fabricate buyers, inflate the claimed count, or invent activity: every row it
 * writes corresponds to an image a real person actually gave you, and every
 * public number stays true. Do not use it to pad the wall.
 *
 * Usage:
 *   node --experimental-strip-types scripts/seed.ts ./seed-images
 *
 * Each image filename may carry metadata, separated by double dashes:
 *   alice@example.com--pet--Our dog Biscuit, 2009-2024.jpg
 *   bob@example.com--art.png
 *   carol@example.com.jpg
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const SQUARE_PRICE_CENTS = 1000

async function main(): Promise<void> {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Usage: node --experimental-strip-types scripts/seed.ts <image-directory>')
    process.exit(1)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  // Imported lazily so this script works without a build step.
  const { indexToCell, milestoneForIndex, TOTAL_SQUARES } = await import(
    '../src/lib/wall/geometry.ts'
  )
  const { inspectImage } = await import('../src/lib/image.ts')
  const { imageKeyFor, storage } = await import('../src/lib/storage/index.ts')

  const files = (await readdir(dir)).filter((f) =>
    ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extname(f).toLowerCase()),
  )
  if (files.length === 0) {
    console.error(`No images found in ${dir}`)
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: true },
  })
  await client.connect()
  const store = await storage()

  console.log(`Seeding ${files.length} square(s) from ${dir}\n`)
  let seeded = 0

  for (const file of files.sort()) {
    const [emailPart, categoryPart, captionPart] = basename(file, extname(file)).split('--')
    const email = (emailPart ?? '').trim().toLowerCase()
    if (!email.includes('@')) {
      console.log(`  skip ${file}: filename must start with an email address`)
      continue
    }

    const existing = await client.query(
      'SELECT square_index FROM orders WHERE email = $1 AND square_index IS NOT NULL',
      [email],
    )
    if (existing.rows.length > 0) {
      console.log(`  skip ${file}: ${email} already holds square ${existing.rows[0].square_index}`)
      continue
    }

    const bytes = await readFile(join(dir, file))
    let info
    try {
      info = inspectImage(bytes)
    } catch (err) {
      console.log(`  skip ${file}: ${err instanceof Error ? err.message : err}`)
      continue
    }

    try {
      await client.query('BEGIN')

      const cursor = await client.query<{ next_index: number }>(
        'SELECT next_index FROM wall_state WHERE id = 1 FOR UPDATE',
      )
      const nextIndex = cursor.rows[0]?.next_index ?? 0
      if (nextIndex >= TOTAL_SQUARES) throw new Error('the wall is full')

      const cell = indexToCell(nextIndex)
      const orderId = randomUUID()

      await client.query(
        `INSERT INTO orders (id, stripe_checkout_session_id, email, amount_cents,
                             status, square_index, milestone, paid_at)
         VALUES ($1, $2, $3, $4, 'paid', $5, $6, now())`,
        [
          orderId,
          `seed_${orderId}`,
          email,
          SQUARE_PRICE_CENTS,
          cell.index,
          milestoneForIndex(cell.index),
        ],
      )

      const key = imageKeyFor(cell.index, info.extension)
      await store.put(key, bytes, info.contentType)

      await client.query(
        `INSERT INTO squares (index, order_id, ring, x, y, state, image_key,
                              image_width, image_height, caption, category, filled_at)
         VALUES ($1, $2, $3, $4, $5, 'filled', $6, $7, $8, $9, $10, now())`,
        [
          cell.index,
          orderId,
          cell.ring,
          cell.x,
          cell.y,
          key,
          info.width,
          info.height,
          captionPart?.trim() || null,
          categoryPart?.trim() || null,
        ],
      )

      await client.query('UPDATE wall_state SET next_index = $1, updated_at = now() WHERE id = 1', [
        nextIndex + 1,
      ])
      await client.query('COMMIT')

      console.log(`  square #${cell.index} <- ${file}`)
      seeded++
    } catch (err) {
      await client.query('ROLLBACK')
      console.log(`  fail ${file}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nSeeded ${seeded} square(s).`)
  console.log(
    'Reminder: these count as real claims in every public number, because they are real.',
  )
  await client.end()
}

void main()
