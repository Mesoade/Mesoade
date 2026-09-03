# A Million Squares — Project Brief

Site: **amillionsquaresworld.com**. A "million dollar homepage"-style site:
1,000,000 squares, $10 each, one per person, paid once and permanent. This
document is the full scope as decided — hand it to Claude Code as the
starting brief for the build. ("A Million Squares" is used as the display
brand name throughout this doc; adjust if you want the on-site name to
match the domain exactly, e.g. "A Million Squares World.")

## The idea in one line

Everyone gets exactly one square, forever, and can never change it. You're
not offering unlimited free posts like Instagram — you're offering one
permanent, irreversible slot, and that scarcity is what makes people choose
something that actually means something to them instead of a throwaway
image.

**Brand anchor / value proposition:**
> You get one. Forever. Choose wisely.

Alt framing used in copy/ads: *"If you could only ever post one photo
online, permanently, which would it be?"*

This line should show up in the hero headline, and — importantly — in the
claim flow itself, right above the upload box, not just in marketing. The
prompt at the moment of upload shapes what people submit more than any ad
they saw earlier.

## Core mechanics

- **1,000,000 squares total.** Not currently planned to change size.
- **$10 USD per square, flat, one-time.** No bulk pricing, no subscriptions,
  no renewals. This is not a donation platform — squares are being sold.
- **One square per person, hard cap, no exceptions.** Nothing in the
  product should allow buying more than one — no bulk purchase option, no
  "buy for a friend" flow, no multi-square checkout of any kind. Enforced
  softly on the backend: unique email at checkout, backed by Stripe's
  fraud/card-fingerprint signals to catch obvious repeat attempts. This
  backend enforcement is best-effort by design, not airtight — full
  identity verification would add too much friction for a $10 purchase and
  isn't worth it — but the product itself should never expose a path to
  buying more than one, even if the enforcement behind it is soft.
- **No user accounts, no login, ever.** Guest checkout only.
- **Pay first, then upload.** Flow is: claim a square → pay $10 immediately
  → *then* get the upload screen. Payment is not gated on having content
  ready.
- **7-day upload window after payment.** Reminder emails on day 1 and day
  5 nudging them to finish.
- **No refunds, ever, for any reason** — including if they never upload
  within the window.
- **The square is permanently theirs the moment they pay**, whether or not
  they ever upload anything. It is never resold or released back into the
  pool. (Reasoning: reselling a square someone already paid for is a
  double-sale and a chargeback/dispute risk. "You paid, you permanently own
  square #N, whether or not you decorated it" is easy to defend and keeps
  the wall's addressing simple.)
- **Once content is uploaded, it's locked forever.** No edit capability,
  ever. This is also what makes "choose wisely" literally true rather than
  just marketing copy.
- **Squares that stay blank past the 7-day window** get a neutral default
  visual treatment (a plain color, not an empty hole) so the wall doesn't
  look broken where content never showed up.
- **Placement is auto-assigned, not freely picked**, and grows
  **center-outward** — think concentric rings/spiral expanding from the
  middle, not row-by-row or random. Reasons: (1) it stays visually legible
  at any zoom level, including fully zoomed out, unlike a left-to-right
  fill which reads as a loading bar; (2) it means the earliest buyers are
  closest to the center, which is a true, honest version of "early adopter"
  status rather than an invented badge; (3) it keeps whatever portion of
  the wall is currently active mostly full, since it can only grow as fast
  as real purchases happen.
- **The full 1,000,000-cell boundary is always visible**, even the part
  that isn't claimable yet — shown greyed out / locked. This preserves the
  scale and ambition of "one million" instead of hiding it, while being
  completely honest (nothing greyed-out is claimed or claimable yet).
- **No fabricated stats, ever.** The claimed-count, dollars, and activity
  feed must reflect real transactions only. Faking a "starting number" was
  considered and explicitly rejected — the FTC actively enforces against
  fake scarcity/social-proof numbers, and a caught lie undermines trust in
  the "your square is permanent forever" promise the whole product depends
  on. The cold-start problem (empty-looking wall at launch) is instead
  solved by only exposing a small, real, densely-seeded center region at
  launch (see "Launch seeding" below) and growing it outward for real.

## Claim flow, step by step

1. Visitor lands on homepage, sees the wall (a small active region at
   launch, growing over time), stats, and activity feed.
2. Clicks "Claim your square — $10."
3. Pays via Stripe Checkout. Guest checkout — email captured for the
   receipt, no account created.
4. On success, a square is auto-assigned from the current center-outward
   frontier. Buyer is redirected to an upload screen for that specific
   square.
5. Buyer uploads an image (file-size/type limits enforced at this step,
   which only exists post-payment). Optional short caption/story field.
   Optional link (e.g. to their business/profile).
6. Content goes live immediately (post-moderation model — see below).
   Locked forever from this point on.
7. Buyer gets a permanent, unique URL for their square (e.g.
   `/s/482910`). This is their "my square" page, requires no login, and
   doubles as the link used for "share to social."
8. If they don't complete step 5–6 within 7 days: square stays
   permanently theirs, shows the neutral default treatment, no refund,
   never resold. Reminder emails go out on day 1 and day 5 of the window.

## Content & moderation

- **Image upload only.** No text/color-only fallback — every square
  requires an actual uploaded photo.
- **No automated content filtering for general moderation**, by
  decision — moderation is a human (a hired moderator) reviewing after
  the fact.
- **Confirmed: include a free automated CSAM-scanning backstop**
  (Cloudflare's CSAM Scanning Tool or equivalent), separate from and in
  addition to the human moderator. This isn't about replacing manual
  moderation — post-moderation for everything else (spam, low-effort
  junk, harassment, scams) is a fine, deliberate choice — but CSAM
  carries federal reporting obligations (18 U.S.C. § 2258A) the moment
  you become aware of it, and a once-a-day manual check leaves a window
  where illegal content is live and public. Cheap and close to zero
  engineering effort to add, so just build it in.
- **Post-moderation, live-immediately model.** Content is visible the
  instant it's uploaded; moderator removes anything that violates the
  content policy after the fact.
- **"Report this square" button** on every square, visible to any visitor
  — helps the moderator find problems faster than manually scanning a
  million-square wall.
- **Content policy — standard prohibited categories:** sexually explicit
  content, illegal content, hate speech or harassment, scams/fraudulent
  claims, doxxing or other people's private information, content that
  infringes someone else's copyright or trademark. General principle:
  what's typically prohibited across mainstream platforms — this doesn't
  need to be more exotic or more permissive than that baseline.
- **Confirmed: a square removed by the moderator for a content violation
  follows the exact same rule as an abandoned unfilled square** —
  permanently locked to the original buyer, no refund, no resale, shown
  with the neutral default treatment instead of the removed content.

## Admin panel

- Single shared password, gates `/admin` (or similar). No per-moderator
  accounts, no public link to it anywhere on the site (don't expose the
  URL in the footer or nav — obscurity isn't security, but there's no
  reason to advertise it either).
- Moderator can browse recently-claimed squares (newest first) and remove
  any square's content.
- Basic analytics: squares claimed over time, revenue, squares remaining
  in the currently-active region, total wall fill percentage.

## Payments

- Stripe. Owner already has an account, connect directly (use live keys
  when ready to launch; test with Stripe's test-mode keys and test card
  numbers first).
- One-time payment only — no subscriptions, no recurring billing.
- Guest checkout, no Stripe customer accounts needed beyond what Stripe
  itself requires for the transaction/receipt.

## Homepage

Sections, roughly top to bottom:

1. **Hero** — the anchor headline ("You get one. Forever. Choose wisely."),
   a one-line explainer (1,000,000 squares, $10 each, one per person),
   primary CTA ("Claim your square — $10"), and a real, live stat (squares
   claimed so far).
2. **The interactive wall itself**, embedded directly on the homepage —
   not a separate page. Pan/zoom, browse real claimed squares before
   committing. This does more convincing than copy — seeing an actual
   stranger's meaningful photo makes the concept concrete.
3. **Live activity feed** — real claims only, e.g. "Someone just claimed
   square #482,910 — 3 seconds ago."
4. **How it works**, 3 steps: pick your square → pay $10 → upload your one
   photo, locked forever. State the "locked forever" part plainly here,
   not as a surprise discovered after payment.
5. **FAQ / objection handling**, short and direct: Can I change my photo
   later? (No.) What can't I upload? (short content-policy summary.) What
   happens if I don't upload within 7 days? (You keep the square, no
   refund, it stays blank.)
6. **Footer** — Terms, Privacy, content policy, contact/report-abuse link.
   No public admin link.

### Launch seeding

To avoid the cold-start "empty wall" problem without faking anything: seed
the initial center region yourself with real content (the owner, friends,
family — genuine photos) before running any ads, so day-one visitors see a
small, dense, real cluster rather than a handful of squares scattered
across an apparently-empty million-cell field. The active region then
grows outward for real as purchases come in.

## Social / sharing

- **Share-to-social after claiming.** Auto-generate a nice branded
  shareable image (their photo, their square's coordinates, e.g.
  "#347,291 of 1,000,000") sized for Instagram/X — the goal is that what
  they post looks good on its own, not just a screenshot of the site.
- **Permanent per-square URL** doubles as the share link and the "find my
  square" mechanism — no search/lookup system needed since there's no
  account to search from; the URL itself is the access point.
- **No referral or gifting mechanic.** Explicitly decided against.
- **No charity/donation component.** Explicitly decided against — this is
  a straightforward sale, not a donation platform, and dropping this also
  removes real legal complexity (commercial co-venturer registration in
  several states) that would otherwise need to be handled properly before
  launch.

## Confirmed additional features

- **Time capsule.** Optional note left at claim time, emailed back to the
  buyer in 1 / 5 / 10 / 25 years. Needs a scheduled-send system (see
  Technical notes) and should be framed to the buyer as "we'll do our
  best to reach you" rather than a guarantee, since email addresses don't
  reliably survive a decade.
- **Filter/browse by category.** An optional "what is this?" tag captured
  at upload time (memorial, grad photo, pet, business, art, joke, etc.),
  used to let visitors browse the wall by theme.
- **Milestone moments.** The 1st, 1,000th, 100,000th, 500,000th, and
  1,000,000th square are natural PR/social beats — flag these in the
  data (e.g. a `milestone` flag on the order/square record) so they're
  easy to notice and act on when they happen, even if what you *do* with
  each milestone is decided later.

## Explicitly out of scope

These were considered during scoping and are deliberate "no" calls, not
oversights:

- **Referral/gift purchase flow** — decided against.
- **Charity split** — decided against.
- **User accounts / login** — decided against.
- **Editing a square after upload** — decided against.
- **Bulk / multi-square purchases of any kind** — decided against; hard
  cap of one square per person.
- **"Claim next to a friend"** — decided against. Also structurally
  incompatible with auto-assign, center-outward placement, since buyers
  don't pick their own spot.
- **"Random square" button** — decided against; placement and discovery
  stay structured (center-outward growth, category browsing) rather than
  randomized.
- **"On this day"** (surfacing squares claimed N years ago today) — not
  needed for now. Cheap to add later once the wall has enough history for
  it to matter — claim dates are already being recorded, so nothing needs
  to be built in anticipation of it.

## Legal / trust — things to actually do, not just discuss

*(Not legal advice — the items below, especially the DMCA and content
policy pieces, are cheap enough to just do; anything bigger should get a
real lawyer's eyes before launch.)*

- **Terms of Service**, stating plainly: no refunds under any
  circumstance, content is locked permanently once uploaded, the buyer
  owns their square permanently even if never used, 18+ to purchase, and
  the content policy from the "Content & moderation" section above.
- **Privacy Policy** — what's collected (email, uploaded image, optional
  link/caption), how it's used, that it's never sold.
- **Register a DMCA designated agent** with the U.S. Copyright Office
  ($6, renews every 3 years). Gives safe-harbor protection under DMCA
  512(c) for user-uploaded content that turns out to infringe someone
  else's copyright, as long as takedown notices are handled properly.
  Cheap and easy — just do it before launch.
- **Section 230** gives baseline protection from liability for
  third-party content generally, but doesn't cover IP (hence the DMCA
  piece above) or the CSAM reporting obligation (hence the scanning
  recommendation above).
- **Sales tax** — low priority at this scale; "digital ad space" style
  sales aren't taxed in most states, but revisit with an accountant if
  volume gets significant.

## Technical notes for the build

Not prescriptive — Claude Code should make its own implementation choices
— but worth stating as constraints/context:

- **Buyer and square data must live in a database that's fully separate
  from the application code** (e.g. a managed Postgres instance — Neon or
  Supabase are common, low-cost choices with automatic backups). This
  matters specifically because the owner will come back later and ask for
  new features/redesigns — a code update should never be able to touch or
  risk the database. When asking Claude Code for schema changes later,
  explicitly request additive/non-destructive migrations (add columns,
  don't drop tables) rather than destructive ones.
- **The wall must not render 1,000,000 DOM elements.** A canvas-based
  renderer that only draws the currently-visible viewport (plus the
  locked/greyed boundary) is the right approach for performance at this
  scale.
- **Center-outward auto-assignment** needs a defined, deterministic
  algorithm — concentric ring/spiral expansion from the center index is a
  well-known, straightforward pattern.
- **Image storage** for uploads — a blob/object storage service (e.g.
  Vercel Blob, S3-compatible) rather than storing images in the database.
- **Scheduled email sending** is needed for the day-1/day-5 upload
  reminders, and for the time-capsule feature (delivering a buyer's note
  1/5/10/25 years later) — build this as a general-purpose scheduled-send
  capability rather than two one-off systems.
- **Category tag** captured at upload time as a field on the square/order
  record, with a browse/filter UI on the wall — no separate system needed,
  just a column and a filter.
- **Admin auth** is a single shared secret/password check, not a full
  user-accounts system — keep it simple.
- **Stripe integration**: Checkout Sessions for the one-time $10 payment,
  a webhook to confirm payment success before finalizing the square
  assignment, guest checkout (email only, no Stripe customer accounts
  needed beyond the transaction itself).

## Status

All decisions that were open as of the previous version of this brief have
been resolved and folded into the sections above (domain, image-only
content, moderator-removal parity, CSAM scanning, content policy wording,
and which additional features are in vs. out). Nothing is currently
pending — this brief is ready to build from. If new questions come up
during the build, add them here as a new **OPEN** section rather than
deciding silently, so the brief stays the single source of truth.

## Decisions made during the build

Four questions came up while scaffolding that the brief above did not settle.
Each was put to the owner rather than decided silently, and each is now
implemented. Recorded here so this document stays the single source of truth.

1. **Display brand name: "A Million Squares."** The brief flagged this itself.
   The domain remains amillionsquaresworld.com; the wordmark is the shorter
   form. Set in `BRAND_NAME` (`src/lib/env.ts`) — one constant, used everywhere.

2. **The active region is ring-based.** The admin analytics in the brief mention
   "squares remaining in the currently-active region", which implies a claimable
   region larger than the set of already-claimed squares. Resolved as: the wall
   unlocks one concentric ring at a time. Everything in the active ring is
   claimable; when it fills, the next ring unlocks. "Squares remaining" is the
   real count of unclaimed cells in the current ring. Ring *r* holds `8r + 4`
   cells, and rings 0–499 tile exactly 1,000,000.

3. **The category tag is a fixed list**, not free text: Memorial, A person,
   Family, Pet, Milestone, Business, Art, Travel, Joke, Something else. Closed
   dropdown, optional. Free tags would be another surface for the moderator to
   police and would make the browse filter meaningless. Adding a value later is
   additive — see `src/lib/categories.ts`.

4. **Policy documents are drafted in full, with marked placeholders.** The
   Terms, Privacy Policy, content policy, and DMCA page are complete and match
   the product's actual behaviour. The real-world details nobody could know —
   entity name, contact and abuse addresses, mailing address, governing law,
   DMCA agent — are `LEGAL_*` environment variables that render as
   `[PLACEHOLDER]` until set, with a visible warning banner on every policy page
   while any remain unfilled. See `docs/pre-launch-checklist.md`.

### Deliberately left to the owner

Not decisions the code should make, and each one flagged in the pre-launch
checklist rather than guessed at:

- **What to do about a duplicate purchase.** The webhook flags these and never
  assigns a second square, but whether a genuine double-charge is the one
  exception to "no refunds, ever" is a business call, so it is surfaced in
  `/admin` for a human rather than automated.
- **Which CSAM scanner to run.** Both supported paths are wired
  (`cloudflare` for the zone-level tool, `webhook` for an inline service); the
  choice depends on how images end up being served. The default records a
  `skipped` audit row rather than pretending a check happened.
