import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from './env.ts'

/**
 * Admin auth is a single shared password, per the brief -- no per-moderator
 * accounts, no user system. On success we set a signed, HttpOnly cookie so the
 * password is not re-sent on every request.
 *
 * /admin is not linked anywhere on the site. Obscurity is not security, which
 * is why there is still a password; there is also no reason to advertise it.
 */

const COOKIE_NAME = 'ams_admin'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function checkPassword(candidate: string): boolean {
  const expected = env.adminPassword
  // Hash both sides first so the comparison is constant-time regardless of
  // length, and a wrong-length guess leaks nothing.
  return safeEqual(sign(candidate), sign(expected))
}

export function issueSessionValue(): string {
  const expires = Date.now() + SESSION_TTL_MS
  return `${expires}.${sign(String(expires))}`
}

function isValidSession(value: string | undefined): boolean {
  if (!value) return false
  const [expiresRaw, signature] = value.split('.')
  if (!expiresRaw || !signature) return false
  const expires = Number(expiresRaw)
  if (!Number.isFinite(expires) || expires < Date.now()) return false
  return safeEqual(sign(expiresRaw), signature)
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return isValidSession(store.get(COOKIE_NAME)?.value)
}

export async function startAdminSession(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, issueSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
