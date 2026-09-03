import { BRAND_NAME, UPLOAD_WINDOW_DAYS, env } from '../env.ts'
import { formatSquareLabel } from '../wall/geometry.ts'
import type { OutgoingEmail } from './index.ts'

function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#0f0f10;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8e8ea">
<div style="max-width:520px;margin:0 auto;background:#17171a;border:1px solid #2a2a2f;border-radius:12px;padding:28px">
<div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a8a94;margin-bottom:18px">${BRAND_NAME}</div>
${bodyHtml}
</div></body></html>`
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#e8e8ea;color:#0f0f10;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a></p>`
}

export interface SquareEmailContext {
  to: string
  squareIndex: number
  uploadToken?: string
}

function uploadUrl(ctx: SquareEmailContext): string {
  return `${env.siteUrl}/upload/${ctx.squareIndex}?t=${ctx.uploadToken ?? ''}`
}

function squareUrl(squareIndex: number): string {
  return `${env.siteUrl}/s/${squareIndex}`
}

export function claimConfirmation(ctx: SquareEmailContext): OutgoingEmail {
  const label = formatSquareLabel(ctx.squareIndex)
  const url = uploadUrl(ctx)
  return {
    to: ctx.to,
    subject: `Square ${label} is yours — now choose your photo`,
    html: shell(
      `<h1 style="font-size:22px;margin:0 0 12px">Square ${label} is permanently yours.</h1>
<p style="line-height:1.6;color:#b8b8c0">It is yours from this moment on, and it will never be resold or reassigned — whatever you do next.</p>
<p style="line-height:1.6;color:#b8b8c0">You have <strong style="color:#e8e8ea">${UPLOAD_WINDOW_DAYS} days</strong> to upload your one photo. Once you upload it, it is locked forever — there is no edit, no replace, no undo. Choose wisely.</p>
${button(url, 'Upload your photo')}
<p style="font-size:13px;color:#8a8a94;line-height:1.6">Keep this link. There are no accounts here, so this email is how you get back to the upload screen.</p>
<p style="font-size:13px;color:#8a8a94;line-height:1.6">Your permanent square page: <a href="${squareUrl(ctx.squareIndex)}" style="color:#b8b8c0">${squareUrl(ctx.squareIndex)}</a></p>`,
    ),
    text: `Square ${label} is permanently yours.

It is yours from this moment on, and it will never be resold or reassigned.

You have ${UPLOAD_WINDOW_DAYS} days to upload your one photo. Once uploaded it is locked forever - no edit, no replace, no undo.

Upload it here: ${url}

Keep this link. There are no accounts here, so this email is how you get back to the upload screen.

Your permanent square page: ${squareUrl(ctx.squareIndex)}`,
  }
}

export function uploadReminder(ctx: SquareEmailContext, daysLeft: number): OutgoingEmail {
  const label = formatSquareLabel(ctx.squareIndex)
  const url = uploadUrl(ctx)
  return {
    to: ctx.to,
    subject: `Square ${label} is still blank — ${daysLeft} days left to upload`,
    html: shell(
      `<h1 style="font-size:22px;margin:0 0 12px">Your square is still waiting.</h1>
<p style="line-height:1.6;color:#b8b8c0">Square ${label} is yours permanently, but nothing has been uploaded to it yet. You have <strong style="color:#e8e8ea">${daysLeft} days</strong> left in your upload window.</p>
${button(url, 'Upload your photo')}
<p style="font-size:13px;color:#8a8a94;line-height:1.6">If the window closes, you still keep square ${label} forever — it simply stays blank. Take the time to pick the right photo; you only get one.</p>`,
    ),
    text: `Your square is still waiting.

Square ${label} is yours permanently, but nothing has been uploaded to it yet. You have ${daysLeft} days left in your upload window.

Upload it here: ${url}

If the window closes, you still keep square ${label} forever - it simply stays blank.`,
  }
}

export function timeCapsule(
  ctx: SquareEmailContext & { note: string; years: number; claimedAt: string },
): OutgoingEmail {
  const label = formatSquareLabel(ctx.squareIndex)
  return {
    to: ctx.to,
    subject: `A note you wrote ${ctx.years} ${ctx.years === 1 ? 'year' : 'years'} ago`,
    html: shell(
      `<h1 style="font-size:22px;margin:0 0 12px">${ctx.years} ${ctx.years === 1 ? 'year' : 'years'} ago, you claimed square ${label}.</h1>
<p style="line-height:1.6;color:#b8b8c0">You left this note for yourself on ${ctx.claimedAt}:</p>
<blockquote style="margin:20px 0;padding:16px 20px;border-left:3px solid #3a3a42;background:#1d1d21;border-radius:0 8px 8px 0;line-height:1.7;white-space:pre-wrap">${escapeHtml(ctx.note)}</blockquote>
${button(squareUrl(ctx.squareIndex), 'See your square')}
<p style="font-size:13px;color:#8a8a94;line-height:1.6">Your square is exactly where you left it, and always will be.</p>`,
    ),
    text: `${ctx.years} ${ctx.years === 1 ? 'year' : 'years'} ago, you claimed square ${label}.

You left this note for yourself on ${ctx.claimedAt}:

${ctx.note}

See your square: ${squareUrl(ctx.squareIndex)}`,
  }
}

export function contentRemoved(
  ctx: SquareEmailContext & { reason: string },
): OutgoingEmail {
  const label = formatSquareLabel(ctx.squareIndex)
  return {
    to: ctx.to,
    subject: `Content removed from square ${label}`,
    html: shell(
      `<h1 style="font-size:22px;margin:0 0 12px">The content on square ${label} has been removed.</h1>
<p style="line-height:1.6;color:#b8b8c0">A moderator removed it under our content policy. Reason given: <strong style="color:#e8e8ea">${escapeHtml(ctx.reason)}</strong>.</p>
<p style="line-height:1.6;color:#b8b8c0">Square ${label} is still permanently yours. It is not resold or released, and there is no refund. It now shows the same neutral treatment as any square that was never filled in, and it cannot be re-uploaded.</p>
<p style="font-size:13px;color:#8a8a94;line-height:1.6">If you believe this was a mistake, reply to this email.</p>`,
    ),
    text: `The content on square ${label} has been removed.

A moderator removed it under our content policy. Reason given: ${ctx.reason}.

Square ${label} is still permanently yours. It is not resold or released, and there is no refund. It now shows the same neutral treatment as any square that was never filled in, and it cannot be re-uploaded.

If you believe this was a mistake, reply to this email.`,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
