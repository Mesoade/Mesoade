import { env } from '../env.ts'
import type { EmailDriver } from './index.ts'

/**
 * Resend driver, called over plain fetch to avoid another dependency. Swap in
 * Postmark/SES here if preferred -- everything upstream only knows the
 * EmailDriver interface.
 */
export function resendDriver(): EmailDriver {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('EMAIL_DRIVER=resend requires RESEND_API_KEY')

  return {
    async send(message) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.emailFrom,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      })
      if (!res.ok) {
        throw new Error(`Resend rejected the message (${res.status}): ${await res.text()}`)
      }
    },
  }
}
