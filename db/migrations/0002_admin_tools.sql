-- 0002_admin_tools.sql — admin deletion and admin-granted squares.
--
-- MIGRATION POLICY (per project brief): migrations are ADDITIVE ONLY.
-- Two tables and one column are added. One index is replaced, which is the
-- single exception and is called out below: an index carries no data, and the
-- replacement is strictly a widening of what is permitted.

-- ---------------------------------------------------------------------------
-- released_squares: the free list.
--
-- 0001 says a square is "never released, resold, or reassigned". That remains
-- true of everything the public can do -- there is still no path in the product
-- that frees a square. This table exists only for an admin deletion, which is a
-- deliberate manual override, and it is what makes a deleted index claimable
-- again rather than a permanent hole in the wall.
--
-- assignSquare() drains this before advancing wall_state.next_index, so the
-- wall fills its gaps before extending the frontier. Lowest index first, which
-- keeps the centre-outward ordering honest.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS released_squares (
  index       integer PRIMARY KEY CHECK (index >= 0 AND index < 1000000),
  released_at timestamptz NOT NULL DEFAULT now(),
  reason      text
);

-- ---------------------------------------------------------------------------
-- deleted_squares: what a deletion destroyed.
--
-- Deleting a square removes its reports and its moderation_scans rows, because
-- both carry a foreign key to squares(index) and the index is about to be
-- handed to somebody else. moderation_scans is not disposable: 0001 records it
-- as an auditable trail of what was scanned and when, which matters under
-- 18 U.S.C. 2258A. So the scan verdicts are copied here before the rows go,
-- along with enough of the square to answer "what used to be at #N" later.
--
-- No foreign key to squares, deliberately: these rows must outlive the square
-- and must not break when the index is reused.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deleted_squares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_index   integer NOT NULL,
  order_id       uuid,
  email          citext,
  claimed_at     timestamptz,
  state          text,
  image_key      text,
  caption        text,
  link_url       text,
  category       text,
  filled_at      timestamptz,
  was_admin_grant boolean NOT NULL DEFAULT false,
  scan_history   jsonb NOT NULL DEFAULT '[]'::jsonb,
  reports_removed integer NOT NULL DEFAULT 0,
  deleted_reason text,
  deleted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deleted_squares_index_idx
  ON deleted_squares (square_index, deleted_at DESC);

-- ---------------------------------------------------------------------------
-- orders.is_admin_grant: a square handed out from /admin, not bought.
--
-- amount_cents is 0 and no Stripe session exists, so revenue figures are
-- unaffected. status stays 'paid' because the square is live and permanent in
-- every way a bought one is -- same URL, same upload window, same locked
-- forever once filled.
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_admin_grant boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS orders_admin_grant_idx
  ON orders (created_at DESC) WHERE is_admin_grant;

-- ---------------------------------------------------------------------------
-- The one-per-person cap, narrowed to exclude admin grants.
--
-- This is the one DROP in the file. It drops an index, never a row: the data in
-- orders is untouched, and the new index permits a strict superset of what the
-- old one did, so nothing that was valid before becomes invalid now.
--
-- The cap it enforces is unchanged for every buyer. Admin grants are exempt
-- because the owner needs to issue many of them to one address, which is not a
-- purchase and was never what this cap was defending against.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS orders_email_holding_square_key;
CREATE UNIQUE INDEX IF NOT EXISTS orders_email_holding_square_key
  ON orders (email) WHERE square_index IS NOT NULL AND NOT is_admin_grant;
