# Pre-launch checklist

The build is complete; these are the real-world items it cannot do for you.
Nothing here is optional if you are taking real money.

## Legal details (the site tells you if you skip these)

Until every `LEGAL_*` variable is set, the policy pages render with visible
`[PLACEHOLDER]` markers and a warning banner. Set them in your host's
environment:

- [ ] `LEGAL_ENTITY_NAME` — the entity actually selling the squares
- [ ] `LEGAL_CONTACT_EMAIL`
- [ ] `LEGAL_ABUSE_EMAIL` — where report-abuse mail lands
- [ ] `LEGAL_DMCA_AGENT`, `LEGAL_DMCA_EMAIL`
- [ ] `LEGAL_MAILING_ADDRESS`
- [ ] `LEGAL_GOVERNING_LAW`
- [ ] `LEGAL_EFFECTIVE_DATE`

## Legal actions

- [ ] **Register a DMCA designated agent** with the U.S. Copyright Office at
      <https://dmca.copyright.gov/>. $6, renews every three years. Without the
      registration there is no DMCA 512(c) safe harbour, and the `/dmca` page is
      not a substitute for it.
- [ ] Have a lawyer read the Terms and Privacy Policy. They were drafted to
      match the product's actual behaviour — the no-refund rule, permanent
      content, one square per person, 18+ — but they are a starting point, not
      legal advice.
- [ ] Confirm the no-refund policy against Stripe's rules and your card network
      obligations. It is your stated policy; it does not by itself prevent a
      cardholder from raising a chargeback, and Stripe will expect a clear
      disclosure. The disclosure is on the claim page, the Checkout submit
      message, the FAQ, and the Terms.

## CSAM scanning — do not launch on `none`

`CSAM_SCANNER=none` writes a `skipped` audit row and checks nothing. Pick one:

- `cloudflare` — the free CSAM Scanning Tool. Enabled per-zone in the Cloudflare
  dashboard, not via an API, and it requires uploads to be served through a
  Cloudflare-proxied hostname. Set `STORAGE_PUBLIC_BASE_URL` to that hostname.
- `webhook` — POST each upload to PhotoDNA, Thorn Safer, or similar, and set
  `CSAM_WEBHOOK_URL`.

Either way, know your 18 U.S.C. § 2258A obligations before the first upload:
they attach the moment you become aware, not when you get around to reviewing.
See `docs/moderation.md`.

## Infrastructure

- [ ] Managed Postgres provisioned, **automatic backups confirmed on**.
- [ ] `npm run migrate` run against it.
- [ ] `STORAGE_DRIVER=s3` with a real bucket. `local` is development only and
      will lose every image on redeploy.
- [ ] `EMAIL_DRIVER=resend` (or your provider) with SPF/DKIM set up — reminder
      and confirmation emails are the only way a buyer finds their square again.
- [ ] `SESSION_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET` set to real generated
      values (`openssl rand -base64 32`). The defaults in `.env.example` are
      placeholders.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the live domain — it is baked into Stripe
      redirect URLs, emails, and share cards.
- [ ] Cron hitting `/api/cron/dispatch` hourly. `vercel.json` configures this on
      Vercel; on Vercel, setting `CRON_SECRET` makes the platform send the
      bearer token automatically.

## Stripe

- [ ] Test the whole flow end to end with test keys and `4242 4242 4242 4242`
      first: pay → assignment → upload → locked.
- [ ] Webhook endpoint registered for `checkout.session.completed` and
      `checkout.session.expired`, with its signing secret in
      `STRIPE_WEBHOOK_SECRET`.
- [ ] Switch to live keys only when the above passes.
- [ ] Decide, in advance, what you do about a duplicate purchase. The webhook
      flags these as `status = 'duplicate'` and does not assign a second square;
      they show in `/admin`. Your stated policy is no refunds, but a genuine
      double-charge is the one case where you may want to make an exception.
      Decide now rather than under pressure.

## Launch seeding

- [ ] Collect genuine photos from real people — you, friends, family — who each
      understand the square is permanently theirs.
- [ ] `npm run seed ./seed-images` with filenames shaped
      `email@example.com--category--Caption.jpg`.
- [ ] Confirm the centre looks dense before running any advertising.

Seeded squares count as real claims in every public number, because they are
real. Do not use the seeder to pad the wall — the honesty of the counters is
what makes the permanence promise credible.

## Finally

- [ ] Visit `/admin` and confirm you can sign in and remove a test square.
- [ ] Confirm `/admin` is linked from nowhere public (it is not, by design —
      keep it that way).
- [ ] Check `/terms`, `/privacy`, `/content-policy`, `/dmca` for any remaining
      bracketed placeholder.
