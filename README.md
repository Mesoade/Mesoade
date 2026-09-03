# A Million Squares

1,000,000 squares. $10 each. One per person, ever. You upload one photo and it
is locked forever.

> **You get one. Forever. Choose wisely.**

The scarcity is the product. Nothing here offers a second square, an edit
button, or a refund, and the code is written so that those paths do not exist
rather than merely being discouraged.

Built from `PROJECT-BRIEF.md`. If you are picking this up cold, read
[`docs/architecture.md`](docs/architecture.md) first — it explains *why* the
unusual parts are the way they are, most of which are product decisions rather
than technical ones.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| App | Next.js 15 (App Router), TypeScript | Server rendering for the real-time stats, one deployable |
| Database | Postgres, plain SQL migrations | No ORM that can drop a table; migrations are additive by policy |
| Payments | Stripe Checkout + webhook | Guest checkout, one-time charge, no customer accounts |
| Images | S3-compatible object storage | Never in the database |
| Email | Pluggable driver (Resend built in) | One scheduled-send queue for reminders *and* time capsules |
| Wall | HTML canvas, viewport-culled | A million DOM nodes is not survivable |

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL at minimum
npm run migrate
npm run dev
```

Defaults are development-safe: images go to `./storage-dev`, email prints to the
console, and no real payment or scanning credentials are needed to click through
the site.

To exercise the paid flow, add Stripe **test** keys and run
`stripe listen --forward-to localhost:3000/api/stripe/webhook`, then pay with
`4242 4242 4242 4242`.

### Commands

```bash
npm run dev        # development server
npm run check      # typecheck + tests
npm run test       # geometry test suite, including a full 1,000,000-cell sweep
npm run migrate    # apply pending migrations
npm run seed ./dir # launch seeding from real photos (see below)
npm run build
```

## How a claim works

1. Visitor enters their email on `/claim`. We check it does not already hold a
   square *before* charging anything.
2. Stripe Checkout takes $10. Guest checkout; no account is created anywhere.
3. The `checkout.session.completed` webhook assigns the next square on the
   centre-outward frontier, inside a transaction, and queues their emails.
   Assignment lives here rather than on the redirect so a payment always
   produces a square even if the buyer closes the tab.
4. They are redirected to `/upload/<index>`, which polls until the square exists.
5. They upload one photo, optionally with a caption, category, and link. It goes
   live immediately and is **locked forever**.
6. `/s/<index>` is their permanent URL. There is no login and no search — that
   URL is the access mechanism, and it doubles as the share link.

If they never upload, the square stays permanently theirs, shows a neutral tile,
and is never resold. Same outcome if a moderator removes their content.

## Project layout

```
db/migrations/           Plain SQL. Additive only — see the README in there.
docs/                    Architecture, moderation, pre-launch checklist.
scripts/migrate.ts       Migration runner.
scripts/seed.ts          Launch seeding from real photos.
src/app/                 Routes. /, /claim, /upload/[index], /s/[index], /admin, policies.
src/components/Wall.tsx  The canvas renderer.
src/lib/wall/geometry.ts The centre-outward addressing. Start here.
src/lib/scheduler.ts     One queue for reminders and time capsules.
src/lib/moderation/      CSAM scanning backstop.
```

## Launch seeding

An empty million-cell field looks broken, and inventing numbers to hide that is
both dishonest and something the FTC actively enforces against. So: seed the
centre with **genuine** photos from real people before advertising.

```bash
npm run seed ./seed-images
# filenames: email@example.com--category--Optional caption.jpg
```

Seeded squares count as real claims in every public number, because they are
real. Do not use this to pad the wall — the credibility of the counters is what
makes the permanence promise believable.

## Before you take real money

See [`docs/pre-launch-checklist.md`](docs/pre-launch-checklist.md). The short
version: fill in the `LEGAL_*` variables (the policy pages display a warning
banner until you do), register a DMCA designated agent, turn on a real CSAM
scanner, and switch storage and email off their development drivers.

## A note on changing this later

Two things are easy to break without noticing:

- **Migrations must stay additive.** Add columns, never drop them. Every row
  represents a paid, permanent, non-reissuable square.
- **Do not add an edit path.** Not a "fix a typo" endpoint, not an admin
  content-replace. "Locked forever" is the product; the moment there is a way
  around it, the promise is no longer true.
