import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isCategoryId } from '@/lib/categories'
import {
  InvalidImageError,
  MAX_CAPTION_LENGTH,
  MAX_UPLOAD_BYTES,
  inspectImage,
  normaliseLink,
} from '@/lib/image'
import { scanUpload } from '@/lib/moderation/csam'
import { cancelUploadReminders } from '@/lib/scheduler'
import { imageKeyFor, publicUrl, storage } from '@/lib/storage'
import { DENIAL_MESSAGES, checkUploadAccess } from '@/lib/upload-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The one and only write of a square's content.
 *
 * There is no counterpart to this route: no edit, no replace, no delete for the
 * buyer. Once this succeeds the square is locked forever, which is what makes
 * "choose wisely" a fact rather than a slogan.
 */
export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Malformed upload.' }, { status: 400 })
  }

  const squareIndex = Number(form.get('squareIndex'))
  if (!Number.isInteger(squareIndex) || squareIndex < 0) {
    return NextResponse.json({ error: 'Unknown square.' }, { status: 400 })
  }

  const access = await checkUploadAccess({
    squareIndex,
    token: asString(form.get('token')),
    sessionId: asString(form.get('sessionId')),
  })
  if (!access.ok) {
    return NextResponse.json(
      { error: DENIAL_MESSAGES[access.reason] },
      { status: access.reason === 'bad_credential' ? 403 : 409 },
    )
  }

  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Images must be under ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  let info
  let link: string | null = null
  try {
    info = inspectImage(bytes)
    const rawLink = asString(form.get('link'))
    if (rawLink) link = normaliseLink(rawLink)
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const captionRaw = asString(form.get('caption')) ?? ''
  const caption = captionRaw.trim().slice(0, MAX_CAPTION_LENGTH) || null

  const categoryRaw = asString(form.get('category'))
  const category = isCategoryId(categoryRaw) ? categoryRaw : null

  const key = imageKeyFor(squareIndex, info.extension)
  const store = await storage()
  await store.put(key, bytes, info.contentType)

  /*
   * CSAM backstop, before the content is visible. Everything else is handled
   * post-hoc by a human moderator -- a deliberate choice -- but 18 U.S.C. 2258A
   * creates an obligation the moment we become aware, so this one check does
   * not wait for a daily sweep.
   */
  const scan = await scanUpload({
    squareIndex,
    bytes,
    contentType: info.contentType,
    publicUrl: publicUrl(key),
  })

  if (scan.verdict === 'flagged') {
    await store.delete(key).catch(() => {})
    // Recorded as removed, not left claimed: the square is permanently the
    // buyer's either way, and it must not be re-uploadable.
    await query(
      `UPDATE squares
          SET state = 'removed', removed_at = now(),
              removed_reason = 'Automated CSAM scan', removed_by = 'system'
        WHERE index = $1`,
      [squareIndex],
    )
    console.error(`CSAM scan flagged square ${squareIndex}; content discarded`)
    return NextResponse.json(
      { error: 'This image cannot be accepted. This decision has been logged.' },
      { status: 422 },
    )
  }

  // Guarded on state so two simultaneous submissions cannot both win.
  const updated = await query<{ index: number }>(
    `UPDATE squares
        SET state = 'filled',
            image_key = $2,
            image_width = $3,
            image_height = $4,
            caption = $5,
            link_url = $6,
            category = $7,
            filled_at = now(),
            upload_token_used_at = now()
      WHERE index = $1 AND state = 'claimed'
      RETURNING index`,
    [squareIndex, key, info.width, info.height, caption, link, category],
  )

  if (updated.length === 0) {
    await store.delete(key).catch(() => {})
    return NextResponse.json({ error: DENIAL_MESSAGES.already_filled }, { status: 409 })
  }

  await cancelUploadReminders(access.grant.orderId)

  return NextResponse.json({ ok: true, squareUrl: `/s/${squareIndex}` })
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null
}
