-- 0001_init.sql — A Million Squares, initial schema.
--
-- MIGRATION POLICY (per project brief): migrations are ADDITIVE ONLY.
-- Add columns and tables; never DROP or rename anything that holds buyer data.
-- The database is deliberately a separate managed service from the app code so
-- that a code deploy can never destroy it.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- wall_state: single-row table holding the center-outward assignment cursor.
-- next_index is the next square index (0-based) to be handed out. Reads/writes
-- go through SELECT ... FOR UPDATE so concurrent webhooks cannot collide.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wall_state (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_index  integer  NOT NULL DEFAULT 0 CHECK (next_index >= 0 AND next_index <= 1000000),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO wall_state (id, next_index) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- orders: one paid Stripe transaction. Guest checkout, no accounts.
--
-- One-square-per-person is enforced softly here: a unique index on email for
-- orders that actually got a square. Backed up by Stripe card fingerprint,
-- which we record for the moderator to spot obvious repeat attempts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text UNIQUE NOT NULL,
  stripe_payment_intent_id   text,
  email                     citext NOT NULL,
  amount_cents              integer NOT NULL,
  currency                  text NOT NULL DEFAULT 'usd',
  -- 'pending'   : checkout session created, payment not confirmed
  -- 'paid'      : payment confirmed, square assigned
  -- 'duplicate' : payment confirmed but the email already owns a square, so no
  --               second square was assigned. Surfaced in admin for a manual
  --               decision; the product never exposes a way to buy two.
  -- 'expired'   : checkout session expired without payment
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','paid','duplicate','expired')),
  square_index              integer UNIQUE,
  card_fingerprint          text,
  -- Optional note the buyer leaves at claim time, mailed back to them later.
  time_capsule_note         text,
  -- Set for the 1st / 1,000th / 100,000th / 500,000th / 1,000,000th claim.
  milestone                 integer,
  upload_deadline           timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  paid_at                   timestamptz
);

-- Soft one-per-person cap: only orders that actually hold a square count.
CREATE UNIQUE INDEX IF NOT EXISTS orders_email_holding_square_key
  ON orders (email) WHERE square_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_paid_at_idx ON orders (paid_at DESC);
CREATE INDEX IF NOT EXISTS orders_card_fingerprint_idx
  ON orders (card_fingerprint) WHERE card_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_milestone_idx
  ON orders (milestone) WHERE milestone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- squares: only CLAIMED squares get a row. Unclaimed cells are not stored --
-- x/y/ring are pure functions of the index (see src/lib/wall/geometry.ts), so
-- there is no reason to carry a million placeholder rows.
--
-- A square is permanently the buyer's from the moment they pay. It is never
-- released, resold, or reassigned, whatever happens to its content.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS squares (
  index             integer PRIMARY KEY CHECK (index >= 0 AND index < 1000000),
  order_id          uuid NOT NULL REFERENCES orders(id),
  ring              integer NOT NULL,
  x                 integer NOT NULL,
  y                 integer NOT NULL,
  -- 'claimed' : paid for, no image yet (neutral default treatment)
  -- 'filled'  : image uploaded and live
  -- 'removed' : content removed by a moderator; reverts to neutral treatment
  state             text NOT NULL DEFAULT 'claimed'
                    CHECK (state IN ('claimed','filled','removed')),
  claimed_at        timestamptz NOT NULL DEFAULT now(),

  -- Content. Immutable once set: there is no edit path anywhere in the product.
  image_key         text,
  image_width       integer,
  image_height      integer,
  caption           text,
  link_url          text,
  category          text,
  filled_at         timestamptz,

  -- Moderation
  removed_at        timestamptz,
  removed_reason    text,
  removed_by        text,

  -- Access token for the one-time upload screen, stored hashed. There are no
  -- accounts; this token plus the square URL is the buyer's only handle.
  upload_token_hash text,
  upload_token_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS squares_claimed_at_idx ON squares (claimed_at DESC);
CREATE INDEX IF NOT EXISTS squares_state_idx ON squares (state);
CREATE INDEX IF NOT EXISTS squares_ring_idx ON squares (ring);
CREATE INDEX IF NOT EXISTS squares_category_idx
  ON squares (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS squares_order_id_idx ON squares (order_id);

-- ---------------------------------------------------------------------------
-- scheduled_emails: one general-purpose scheduled-send queue, used for the
-- day-1 / day-5 upload reminders AND the 1/5/10/25-year time capsule. Drained
-- by a cron-triggered endpoint. dedupe_key makes enqueueing idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  dedupe_key  text UNIQUE NOT NULL,
  recipient   citext NOT NULL,
  send_at     timestamptz NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed','cancelled')),
  attempts    integer NOT NULL DEFAULT 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_emails_due_idx
  ON scheduled_emails (send_at) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- reports: "Report this square", open to any visitor. Post-moderation model --
-- this is how the moderator finds problems without scanning a million cells.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_index    integer NOT NULL REFERENCES squares(index),
  reason          text NOT NULL,
  details         text,
  reporter_ip_hash text,
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','actioned','dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_square_idx ON reports (square_index);

-- ---------------------------------------------------------------------------
-- moderation_scans: automated CSAM scan results, kept separate from human
-- moderation. Recorded for every upload so there is an auditable trail of what
-- was checked and when -- relevant to 18 U.S.C. 2258A reporting obligations.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_scans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_index integer NOT NULL REFERENCES squares(index),
  provider     text NOT NULL,
  verdict      text NOT NULL CHECK (verdict IN ('clear','flagged','error','skipped')),
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_scans_square_idx ON moderation_scans (square_index);
CREATE INDEX IF NOT EXISTS moderation_scans_flagged_idx
  ON moderation_scans (created_at DESC) WHERE verdict = 'flagged';

-- ---------------------------------------------------------------------------
-- processed_webhooks: Stripe delivers at-least-once. Recording event ids keeps
-- square assignment exactly-once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
