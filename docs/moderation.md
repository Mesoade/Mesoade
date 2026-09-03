# Moderation

## The model

Content goes live the instant it is uploaded and is reviewed afterwards. This is
a deliberate choice, not an oversight: pre-moderating every upload would put a
human in the critical path of a $10 purchase for no proportionate benefit.

The one exception is CSAM, which is scanned for automatically before content can
sit publicly for any length of time.

## Day to day

Sign in at `/admin` with the shared password. Two views:

- **`/admin`** — everything recently claimed, newest first, with each square's
  image, caption, link, buyer email, and open report count. Squares with open
  reports are outlined in red.
- **`/admin/reports`** — the open report queue, *oldest first*, because those
  have been live and unreviewed the longest.

Removing content asks for a reason, then: sets the square to `removed`, deletes
the image from storage, marks that square's open reports as actioned, and emails
the buyer to explain what happened and that they still own the square.

## What removal does and does not do

It does **not** free the square. Per the brief, a square removed for a content
violation follows exactly the same rule as one that was never filled in:

- permanently locked to the original buyer;
- no refund;
- never resold or released back into the pool;
- shown with the neutral default treatment, indistinguishable from a blank square;
- not re-uploadable.

This is enforced in code — `checkUploadAccess` refuses a `removed` square even
with a valid credential.

## The content policy

The prohibited categories are the mainstream baseline: sexually explicit
content, illegal content, hate speech or harassment, scams and fraudulent
claims, doxxing and private information, and copyright or trademark
infringement. The public wording is at `/content-policy`; it is referenced from
the Terms, so it is part of what buyers agree to.

## CSAM scanning

`src/lib/moderation/csam.ts`. Every upload writes a `moderation_scans` row —
including a `skipped` row when no scanner is configured, so the audit trail
never implies a check that did not happen.

If a scan flags an image the upload is refused, the blob is deleted, and the
square is set to `removed` immediately. The `/admin` dashboard surfaces a count
of flagged scans.

**Cloudflare's tool is configured, not called.** It is enabled per-zone in the
Cloudflare dashboard and scans images as they are served through Cloudflare; it
has no inline API. Setting `CSAM_SCANNER=cloudflare` records that the zone-level
backstop is the active one. For that to be true, uploads must be served through
a Cloudflare-proxied hostname — set `STORAGE_PUBLIC_BASE_URL` accordingly.

For an inline check instead, use `CSAM_SCANNER=webhook` with a service that
accepts a POSTed image body and answers `{"match": boolean}`.

Either way: 18 U.S.C. § 2258A creates a reporting obligation to NCMEC the moment
you become aware of such material. Know the process before you need it.

## Duplicate purchases

One square per person is enforced at two points: before checkout (so a returning
buyer gets a friendly redirect rather than a charge), and again in the webhook
(because someone can always type a different address at Stripe).

A duplicate that gets through is recorded as `orders.status = 'duplicate'`, is
**not** given a second square, and appears in the `/admin` counters. It needs a
human decision — the stated policy is no refunds, but a genuine double-charge
may be the case where you make an exception. That call is deliberately not
automated.
