# Migrations

Target project: **GIO4X JUNE 2026** (`tdifcayznqnaduchzfqz`, ap-northeast-2, Postgres 17).

Migrations land here as `NNNN_short_name.sql` and get applied via the Supabase MCP
`apply_migration` tool or `supabase db push`.

## Source projects to pull schema from

| Old project ref            | Domain                                      | Notes                                |
|----------------------------|---------------------------------------------|--------------------------------------|
| `hlzvqixhizdmwfrfunfc`     | GIO4X NEW (marketing site)                  | leads, contact forms                 |
| `owszyagbzfzhcdrlqmps`     | RAPTOR BRAND NEW platform                   | accounts, trades, wallet             |
| `leumpgkfillgeyyfptef`     | Old Gioraptor platform                      | older copy of platform schema        |
| `mwthmekcogivgwwzmftm`     | GIOCRM                                      | CRM contacts, deals                  |

When migrating: dedupe overlapping tables, prefer the most recent schema, add
explicit `GRANT` to `anon` / `authenticated` for any new table — the public-schema
auto-grant flips off on 2026-10-30 for existing projects.
