import { env } from '../env.ts'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailDriver {
  send(message: OutgoingEmail): Promise<void>
}

let cached: EmailDriver | null = null

export async function mailer(): Promise<EmailDriver> {
  if (cached) return cached
  cached =
    env.emailDriver === 'resend'
      ? (await import('./resend.ts')).resendDriver()
      : (await import('./console.ts')).consoleDriver()
  return cached
}
