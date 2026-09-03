import Stripe from 'stripe'
import { BRAND_NAME, SQUARE_PRICE_CENTS, env } from './env.ts'

let client: Stripe | null = null

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(env.stripeSecretKey, { apiVersion: '2025-02-24.acacia' })
  }
  return client
}

/**
 * One-time $10 Checkout Session, guest checkout.
 *
 * Deliberately fixed at quantity 1 with adjustable quantity off. There is no
 * bulk pricing, no multi-square checkout, and no gifting flow anywhere in the
 * product -- one square per person is a hard product rule, not just a backend
 * check.
 */
export async function createCheckoutSession(args: {
  email: string
  timeCapsuleNote: string | null
}): Promise<{ id: string; url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: args.email,
    // Guest checkout: we never create a Stripe Customer, and there are no
    // accounts on our side either.
    customer_creation: 'if_required',
    line_items: [
      {
        quantity: 1,
        adjustable_quantity: { enabled: false },
        price_data: {
          currency: 'usd',
          unit_amount: SQUARE_PRICE_CENTS,
          product_data: {
            name: `One square on ${BRAND_NAME}`,
            description:
              'One permanent square, auto-assigned. Yours forever. Locked once uploaded. No refunds.',
          },
        },
      },
    ],
    payment_intent_data: {
      description: `${BRAND_NAME} — one permanent square`,
    },
    // Surfaced again at checkout so nobody reaches the card field without
    // having seen the terms they are agreeing to.
    custom_text: {
      submit: {
        message:
          'Your square is permanently yours the moment you pay. Once you upload a photo it can never be changed. No refunds, for any reason.',
      },
    },
    metadata: {
      time_capsule_note: (args.timeCapsuleNote ?? '').slice(0, 480),
    },
    success_url: `${env.siteUrl}/claim/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/?checkout=cancelled`,
  })

  if (!session.url) throw new Error('Stripe did not return a Checkout URL')
  return { id: session.id, url: session.url }
}

/**
 * The card fingerprint, when Stripe exposes it. Used only as a soft signal for
 * the moderator to spot obvious repeat purchases -- the brief is explicit that
 * enforcement is best-effort, since real identity verification would be absurd
 * friction on a $10 sale.
 */
export async function cardFingerprintFor(
  paymentIntentId: string | null,
): Promise<string | null> {
  if (!paymentIntentId) return null
  try {
    const intent = await stripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.payment_method_details'],
    })
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') return null
    return charge.payment_method_details?.card?.fingerprint ?? null
  } catch {
    return null
  }
}
