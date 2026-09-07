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
  const v = process.env[name]
  /*
   * An empty string counts as absent.
   *
   * `??` only falls back on undefined, so a variable that exists but was left
   * blank used to be handed straight through -- and every hosting dashboard
   * makes it easy to add a name, save, and never fill in the value. That is
   * how NEXT_PUBLIC_SITE_URL reached `new URL('')` and failed a deploy with
   * nothing but "Invalid URL" to go on.
   */
  return v === undefined || v.trim() === '' ? fallback : v
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
  /**
   * The site's own origin.
   *
   * This is load-bearing well beyond metadata: Stripe's success and cancel
   * redirects, the permanent square link, and the upload link inside the
   * receipt email are all built from it. With no accounts on this site that
   * emailed link is the only route a buyer has back to their square, so a
   * wrong value here is worse than a failed build -- it sends paying customers
   * to a URL that does not exist.
   *
   * Hence: prefer what was configured, fall back to the host the platform says
   * we are deployed on rather than to localhost, and refuse anything that is
   * not a usable absolute URL instead of letting it reach `new URL()` as a
   * bare TypeError.
   */
  get siteUrl() {
    const configured = optional('NEXT_PUBLIC_SITE_URL')
    // Vercel sets these itself. Both are bare hosts, with no scheme.
    const platformHost =
      optional('VERCEL_PROJECT_PRODUCTION_URL') || optional('VERCEL_URL')
    const raw =
      configured ||
      (platformHost ? `https://${platformHost}` : 'http://localhost:3000')
    const trimmed = raw.replace(/\/+$/, '')

    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL is not a valid URL: ${JSON.stringify(raw)}. ` +
          'It must include the scheme, e.g. https://amillionsquaresworld.com',
      )
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL must be http or https, got ${JSON.stringify(parsed.protocol)}.`,
      )
    }
    return trimmed
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

/**
 * The name shown on the Stripe Checkout page and on the buyer's card receipt.
 *
 * Deliberately separate from BRAND_NAME, and currently different from it. Worth
 * knowing why that is a risk rather than a feature: people check that the name
 * taking their money matches the site they are on, and a mismatch at the card
 * field is a well-known cause of abandoned checkouts and of chargebacks raised
 * as "I don't recognise this charge". Set both to the same string once the
 * public name is settled.
 */
export const CHECKOUT_BRAND_NAME = 'Themillionsquares'
export const BRAND_TAGLINE = 'You get one. Forever. Choose wisely.'
