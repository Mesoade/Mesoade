/**
 * Environment access. Nothing here throws at import time -- a missing Stripe key
 * should break checkout, not the whole site -- but each accessor throws a clear
 * error at the point of use.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL')
  },
  get stripeSecretKey() {
    return required('STRIPE_SECRET_KEY')
  },
  get stripeWebhookSecret() {
    return required('STRIPE_WEBHOOK_SECRET')
  },
  get adminPassword() {
    return required('ADMIN_PASSWORD')
  },
  get sessionSecret() {
    return required('SESSION_SECRET')
  },
  get cronSecret() {
    return required('CRON_SECRET')
  },
  get siteUrl() {
    return optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000').replace(/\/$/, '')
  },
  get storageDriver() {
    return optional('STORAGE_DRIVER', 'local') as 'local' | 's3'
  },
  get storagePublicBaseUrl() {
    return optional('STORAGE_PUBLIC_BASE_URL', '/uploads').replace(/\/$/, '')
  },
  get emailDriver() {
    return optional('EMAIL_DRIVER', 'console') as 'console' | 'resend'
  },
  get emailFrom() {
    return optional('EMAIL_FROM', 'A Million Squares <hello@amillionsquaresworld.com>')
  },
  get csamScanner() {
    return optional('CSAM_SCANNER', 'none')
  },
}

/** Price is fixed at $10 and there is no bulk or tiered pricing anywhere. */
export const SQUARE_PRICE_CENTS = 1000
export const SQUARE_PRICE_DISPLAY = '$10'

/** Buyers have 7 days to upload. The square is theirs regardless. */
export const UPLOAD_WINDOW_DAYS = 7

/** Time capsule delivery offsets, in years. */
export const TIME_CAPSULE_YEARS = [1, 5, 10, 25] as const

export const BRAND_NAME = 'A Million Squares'
export const BRAND_TAGLINE = 'You get one. Forever. Choose wisely.'
