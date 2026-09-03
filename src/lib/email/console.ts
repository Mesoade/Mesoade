import type { EmailDriver } from './index.ts'

/** Development driver: prints instead of sending, so no real mail escapes. */
export function consoleDriver(): EmailDriver {
  return {
    async send(message) {
      console.log(
        `\n--- email (console driver, not sent) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n---\n`,
      )
    },
  }
}
