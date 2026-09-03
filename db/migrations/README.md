# Migrations

Plain SQL, applied in filename order by `npm run migrate`. Applied filenames are
recorded in a `schema_migrations` table, so re-running is a no-op.

## The one rule

**Migrations are additive.** Add columns, add tables, add indexes. Do not drop
or rename anything that holds buyer or square data.

This is not a style preference. Every square is a permanent, paid-for, one-per-
person slot that can never be reissued, and the database lives on a separate
managed service precisely so that shipping app code can never endanger it. If a
future feature seems to need a destructive change, add the new shape alongside
the old one and backfill.

When asking Claude Code for schema changes later, say so explicitly:
*"additive migration only — add columns, don't drop tables."*
