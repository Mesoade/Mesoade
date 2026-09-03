# How this fits together

A short map of the moving parts and, more importantly, *why* each one is shaped
the way it is. Most of these are decisions from the project brief rather than
technical preferences, so please read before changing them.

## The wall is addressed, not stored

`src/lib/wall/geometry.ts` maps a square index to a grid cell and back, as pure
functions. Ring 0 is the 2x2 block at the centre; ring *r* is the square annulus
around it, holding `8r + 4` cells, and rings 0–499 tile exactly 1,000,000 cells.

Because the mapping is total and reversible, **unclaimed squares have no
database row**. The `squares` table holds only what has actually been bought.
There is never a million-row table to migrate, back up, or scan.

`src/lib/wall/geometry.test.ts` proves this end to end, including a full
1,000,000-cell sweep asserting the mapping is a bijection.

## Assignment is serialised through one row

`wall_state` holds a single `next_index` cursor. `assignSquare()` takes
`SELECT ... FOR UPDATE` on it inside a transaction, so two webhooks arriving in
the same millisecond cannot be handed the same square. Stripe delivers webhooks
at least once, so `processed_webhooks` additionally drops replays before any
work happens.

Buyers never choose a square. Placement grows outward for three reasons from the
brief: it stays legible at any zoom (a left-to-right fill reads as a loading
bar), it makes "early buyers are near the centre" literally true rather than an
invented badge, and it keeps the active area dense as it grows.

## Payment before content, assignment on the webhook

The flow is: email → Stripe Checkout → webhook assigns the square → upload
screen. Assignment happens in the webhook, not the success redirect, so a
payment always produces a square even if the buyer closes the tab. The success
page polls `/api/claim-status` to bridge the gap.

Nobody is ever blocked from paying by not having a photo ready — which is why
file size and type limits live on the upload step, a step that only exists after
payment.

## There are no accounts, so access is two credentials

A buyer's only handle on their square is:

1. the Stripe `session_id` in their success redirect, verified live against
   Stripe, or
2. a random token, stored only as a SHA-256 hash on the square row, whose
   plaintext exists solely inside their emails.

Once a square is filled it is locked, and neither credential opens it again.
Spent tokens are scrubbed from the email queue when the upload lands.

## Permanence is enforced in one place

`POST /api/upload` is the only write of a square's content, and it has no
counterpart. There is no edit, replace, or buyer-facing delete route anywhere.
The `UPDATE` is guarded on `state = 'claimed'`, so a double submission cannot
overwrite a filled square.

## Blank, abandoned, and removed all look identical

A square that was never filled, one whose window closed, and one whose content a
moderator removed all render as the same neutral tile. The wall never shows a
hole, and a removed square is not publicly marked as shameful. In every case the
square stays permanently owned, is never resold, and is not refunded.
`getWallCells()` deliberately returns `s: 0, k: null` for all three.

## The renderer draws, it does not mount

`src/components/Wall.tsx` is a canvas. Layers, back to front: the full
1,000,000-cell locked field (always drawn, greyed — honest about the scale
without implying those cells are for sale), the active ring outline, then
claimed cells inside the viewport. Images are only fetched once a cell is large
enough on screen to be worth seeing, and are cached with a hard cap.

## One scheduled-send queue, not two features

`scheduled_emails` carries the day-1/day-5 reminders and the 1/5/10/25-year time
capsule through the same rows, drained by `/api/cron/dispatch`. Anything added
later is another `kind`. Rows are claimed with a conditional `UPDATE`, so
overlapping cron runs cannot double-send.

## Numbers are never invented

Every public figure — squares claimed, revenue, remaining in the active ring,
the activity feed — is a real count of real rows. Faking a starting number was
considered and rejected: the FTC enforces against fabricated scarcity and social
proof, and a caught lie would undermine the "your square is permanent" promise
the whole product rests on. The cold-start problem is solved by seeding the
centre with genuine content instead (`npm run seed`).

## The database is deliberately somewhere else

Buyer and square data lives on a managed Postgres instance separate from the
application, and migrations are additive by policy. A code deploy must never be
able to endanger records for squares that can never be reissued. See
`db/migrations/README.md`.
