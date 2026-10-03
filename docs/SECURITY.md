# GIO4X security model (as built)

This describes what exists in the repository today: the public form endpoints, the database, and the first
version of GIO4X Control. It makes no claim beyond that. Nothing here is "unhackable"; the design assumes
that any single layer can fail and tries to make sure another one is behind it.

Related: `docs/CONTROL.md` (operating the console), `supabase/migrations/` (the rules themselves).

## 1. Threat model, in brief

**Assets**

| Asset | Classification | Where |
|---|---|---|
| Enquiries: name, email, phone, country, message | Confidential (personal data) | `public.leads` |
| Consent evidence: what was accepted, when, policy version | Confidential | `leads`, `newsletter_subscribers` |
| Newsletter addresses | Confidential (personal data) | `public.newsletter_subscribers` |
| Internal notes | Confidential | `public.lead_notes` |
| Staff list and roles | Internal | `public.staff` |
| Audit trail | Internal, integrity-critical | `public.audit_log` |
| Staff sessions | Restricted | HttpOnly cookies scoped to `/control` |

**Actors:** an anonymous visitor; an automated sender (spam, flooding); another website acting through a
visitor's browser; anyone holding the publishable key (which is everyone: it ships to browsers); a signed-in
Supabase user who is not staff; staff in the roles `viewer`, `agent`, `admin`; the owner with SQL access.

Since migration `0004` there are eight roles, and what each may do is a set of capabilities checked by
`staff_can()` rather than a list of role names in each policy; an inactive staff row grants nothing; and
changes to staff made in the console need a second person. `viewer`, `agent` and `admin` behave exactly as
described in this document. See `docs/CONTROL.md`, "Roles and capabilities" and "Staff changes and four eyes".

**Main abuse cases and what answers them**

| Abuse case | Controls |
|---|---|
| Spam or flooding through the forms | Honeypot and minimum fill time (silent discard); per-IP limiter in the API; database throttle triggers; 16 KB body cap |
| Calling the database directly with the publishable key to skip the API | Insert-only policies; column-level INSERT grants; CHECK constraints repeating every API bound; the same throttle triggers |
| Forging server-controlled values (`status`, `assigned_to`, timestamps, back-dated consent) | Columns not grantable to the public; `WITH CHECK` pins; timestamps stamped by trigger; consent time must be "now" |
| Reading other people's enquiries | No SELECT privilege for `anon`; SELECT policy requires a `staff` row; inserts never use `RETURNING` |
| Mass assignment (`role=admin`, `status=resolved`) | Top-level allow-list in the API (unknown field → 400); column grants in the database |
| Stored script or markup in a message, shown later to staff | React escapes all output; no `dangerouslySetInnerHTML` on user data; control and invisible characters stripped on input; CSP as a backstop |
| Spreadsheet formula injection through the CSV export | Cells starting with `= + - @` (and tab / CR) are prefixed with `'`; every cell quoted |
| Another site posting through a visitor's browser (CSRF) | Public endpoints: Origin/Referer must be this site. Control: session cookies are `SameSite=Lax`, Next.js rejects server actions whose Origin differs from Host, the export route checks Origin itself |
| A signed-in user who is not staff reaching the console | Server check on every page, action and route; RLS gives a non-staff user exactly the rights of a visitor |
| A `viewer` or `agent` exceeding their role by calling the API directly | Policies and column grants per role; assignment rule in a trigger; UI restrictions are only a courtesy |
| Tampering with the audit trail | No INSERT/UPDATE/DELETE privilege or policy; rows written only by triggers; UPDATE, DELETE and TRUNCATE refused by trigger for every role |
| Account enumeration at sign-in | One generic message for every refusal; no sign-up; Supabase Auth rate limits plus a per-IP limiter |
| Leaking database detail in errors | Fixed, generic messages; only an error code is logged, never the payload |
| Cached private pages | `/control` is `Cache-Control: private, no-store`, `noindex`, always rendered on demand |

## 2. The publishable key

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not a secret. It maps to the Postgres role `anon` (or, with a
session, `authenticated`). **There is no service-role key for this project's database anywhere in this
application**, so there is no key whose theft bypasses its row-level security. RLS is the security boundary.

One exception, for a different database, since 3 October 2026 (owner's decision): Control's portal
sections read the client portal's database with that project's secret key. See section 8a.

With the publishable key and no session, a caller **can**:
- insert one row into `leads` or `newsletter_subscribers`, supplying only the visitor columns, passing every
  CHECK constraint and the throttles;
- add 1 to a visit-counter total by calling `pulse_hit`, `pulse_form_hit` or `pulse_search_hit` (section 11).

They **cannot**: read any table; update or delete anything; set `status`, `assigned_to`, `created_at`,
`updated_at` or `unsubscribed_at`; back-date consent; write notes; read or write `staff` or `audit_log`; call
`is_staff()`, `staff_role()`, `staff_directory()` or `record_subscriber_export()`.

A signed-in user **without a `staff` row** has the same rights as a visitor, plus reading nothing: the helper
functions return false/null/empty for them.

## 3. Row-level security by role

RLS is **enabled and forced** on every table. No policy means no access. PostgREST also needs table
privileges, so each cell below is "privilege granted **and** policy passes".

| Table | Operation | anon | signed-in, not staff | viewer | agent | admin |
|---|---|---|---|---|---|---|
| `leads` | INSERT (visitor columns only; `status='new'`, `assigned_to` null, consent time ≈ now) | yes | yes | yes | yes | yes |
| `leads` | SELECT | no | no | yes | yes | yes |
| `leads` | UPDATE `status` | no | no | no | yes | yes |
| `leads` | UPDATE `assigned_to` | no | no | no | self or unassign | anyone |
| `leads` | UPDATE any other column, DELETE | no | no | no | no | no |
| `lead_notes` | SELECT | no | no | yes | yes | yes |
| `lead_notes` | INSERT (`author` = caller, always) | no | no | no | yes | yes |
| `lead_notes` | UPDATE, DELETE | no | no | no | no | no |
| `newsletter_subscribers` | INSERT (`unsubscribed_at` null, consent time ≈ now) | yes | yes | yes | yes | yes |
| `newsletter_subscribers` | SELECT | no | no | yes | yes | yes |
| `newsletter_subscribers` | UPDATE, DELETE | no | no | no | no | no |
| `staff` | SELECT own row | no | (no row) | yes | yes | yes |
| `staff` | SELECT all rows | no | no | no | no | yes |
| `staff` | INSERT, UPDATE, DELETE | no | no | no | no | no (SQL only) |
| `audit_log` | SELECT | no | no | yes | yes | yes |
| `audit_log` | INSERT, UPDATE, DELETE, TRUNCATE | no | no | no | no | no (triggers only; append-only for the owner too) |

Functions (all `SECURITY DEFINER`, `search_path = ''`, fully qualified names, EXECUTE for `authenticated`
only): `is_staff()`, `staff_role()`, `staff_directory()` (id and display name only, to staff only),
`record_subscriber_export(int)` (admin only; writes the audit row). Trigger functions have EXECUTE revoked
from every API role.

Two deliberate choices worth knowing:
- **A user may read their own `staff` row.** The console needs the caller's role; reading your own role
  reveals nothing you are not entitled to know. Other people's roles are admin-only.
- **Display names are visible to all staff** through `staff_directory()` so the console can show who is
  assigned and who wrote a note. Roles are not included.

### Verify after applying the migrations

The migrations could not be executed while they were written, so run these once. Replace the URL and key.

```bash
# 1. anon cannot read (expect 401/permission denied or an empty array, never rows)
curl -s "$SUPABASE_URL/rest/v1/leads?select=*" -H "apikey: $KEY"
curl -s "$SUPABASE_URL/rest/v1/staff?select=*" -H "apikey: $KEY"
curl -s "$SUPABASE_URL/rest/v1/audit_log?select=*" -H "apikey: $KEY"

# 2. anon cannot forge a server-controlled column (expect 401/403 "permission denied")
curl -s -X POST "$SUPABASE_URL/rest/v1/leads" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"id":"00000000-0000-4000-8000-000000000001","reference":"GX-AAAAAAAA","name":"x","email":"x@example.com","topic":"General","message":"x","page":"/","utm":{},"privacy_accepted_at":"2026-01-01T00:00:00Z","privacy_version":"v","marketing_consent":false,"status":"resolved"}'

# 3. the same without "status" but with the old consent date: refused by the policy (back-dated consent)
# 4. the application path: submit the contact form on the site; expect 200 and a GX- reference,
#    then find the row in GIO4X Control.
# 5. anon cannot call the helpers (expect 401/403/404)
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/staff_directory" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'
```

Then run the Supabase security advisor on the project and read every finding.

## 4. Input validation (`src/lib/server/validate.ts`)

- Only `application/json`; body read as a stream and abandoned past 16 KB (413).
- Top-level allow-list: an unexpected field is a 400. Types are checked, never coerced.
- Strings: Unicode NFC, control characters removed, zero-width and bidirectional formatting characters
  removed (they can disguise text shown to staff), whitespace collapsed, trimmed, then length-checked.
- `email`: ASCII, lower-cased, 6–254 characters, pattern-checked. `topic`: one of the eleven allowed values.
  `message`: 1–5000 characters. `name` ≤ 120. `phone`: digits, spaces, `+ ( ) . / -`, 5–40.
  `country`, `accountInterest` ≤ 80. `page`: a same-site path (no `//`, backslash or whitespace; query and
  fragment dropped). `utm`: only the five `utm_*` keys are kept, each ≤ 120 characters; other keys inside
  `utm` are dropped, not stored.
- The database repeats every bound as a CHECK constraint, so the direct-PostgREST route is held to the same
  rules.
- Honeypot filled, or submitted in under 2.5 s: the response is an ordinary 200 with a reference, and
  nothing is stored.
- Not stored at all: IP address, user agent, query strings. (The visit counter, section 11, stores none of
  them either.)

## 5. Rate limiting, three layers

| Layer | Rule | Honest limits |
|---|---|---|
| API, per IP, in memory (`src/lib/server/rate-limit.ts`) | 30 requests and 5 accepted submissions per 10 minutes, per endpoint; 10 sign-in attempts per 10 minutes | Per function instance and lost when an instance is recycled. Slows a casual script; does not stop a distributed sender. |
| Database triggers (`0003_triggers.sql`) | 30 inserts per minute per table (global); 3 leads per email address per hour | Durable and cannot be bypassed. The global breaker is shared: a flood makes the form unavailable to everyone for up to a minute. No per-IP rule (the database cannot trust an IP). |
| Supabase Auth | Its own limits on sign-in and token refresh | Configured in the Supabase dashboard. |

A throttled insert returns 429 from PostgREST (`SQLSTATE PT429`) and from the API.

## 6. GIO4X Control

- Email and password through Supabase Auth; no sign-up; accounts are created by the owner.
- Sessions are cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/control`. The public
  site and `/api` never receive them. No token is stored where page scripts can read it.
- `src/middleware.ts` runs only on `/control`. It refreshes the session and redirects visitors without one.
  It does not decide access.
- Access is decided in `src/lib/server/staff.ts` on every page, server action and route handler, using
  `auth.getUser()` (validated by the Auth server, so a revoked session stops working at once). Every query
  then runs as that user, so RLS decides again.
- States: no session → sign-in; signed in without a staff row → "Not authorised"; environment variables
  missing → "Not configured"; tables unreadable → a plain notice.
- The subscriber export is POST-only, admin-only, same-origin, and is written to the audit log *before* the
  file is produced.

## 7. Headers and CSP (`next.config.mjs`, owned by the lead engineer)

`Content-Security-Policy` (`default-src 'self'`; scripts from self only; `connect-src` self and the Supabase
project; frames only TradingView; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`;
`frame-ancestors 'none'`), `Strict-Transport-Security` (two years, subdomains, preload),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy:
same-origin`. `/control/*` adds `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`;
`/api/*` adds `Cache-Control: no-store`.

Known weakness, stated: `script-src` includes `'unsafe-inline'` because statically generated Next.js pages
need an inline bootstrap. A nonce-based policy would require rendering every page on demand.

## 8. Secrets

- The repository contains no passwords, no default accounts and no secret keys. `.env.local` holds only
  public values (site URL, Supabase URL, publishable key) and is not committed.
- Any future secret (service-role key, email provider key, Turnstile secret) lives only in the hosting
  provider's environment settings, never in a `NEXT_PUBLIC_` variable, never in the repository.
- A secret that is ever committed or pasted somewhere is rotated, not merely deleted.

## 8a. The portal's secret key

Twelve Control sections (KYC, Funds & Settlement, Fee Engine, General Ledger, IB Network, Copy Trading,
PAMM / MAM, Trade Log, Broker Controls, Event Bus, Document Builder, Bulk Emailer) show records that live in
the client portal's Supabase project. Control reads them on the server with that project's secret key,
`PORTAL_SUPABASE_SECRET_KEY`.

- The key is set only in the hosting environment. It is not in the repository, not in `.env.example` with a
  value, and not in any `NEXT_PUBLIC_` variable. Without it the twelve sections say "not connected".
- It is used in one file, `src/lib/server/portal-db.ts`, which is marked `server-only`: importing it into
  browser code fails the build.
- The key bypasses the portal's row-level security, so **the portal's database does not check who is
  asking**. The check is Control's and happens before the key is used: `requirePortal(capability)`
  establishes the caller as active staff (`supabase.auth.getUser()` and the `staff` row) and asks this
  project's database for their capabilities (`my_capabilities`, `0021_portal_sections.sql`). A page that
  forgets that call cannot obtain the client at all.
- Ten of the twelve sections only read. Two make decisions, and those are the only writes Control makes in
  the portal's database (`src/app/control/actions-portal.ts`):
  - KYC: accept or reject one document awaiting review (`kyc.decide`: admin, compliance);
  - Funds & Settlement: approve or reject one pending deposit or withdrawal (`funds.settle`: admin, finance).
  Each is one call to a function in the portal's database that only the secret key can execute
  (`control_review_kyc_document`, `control_settle_wallet_transaction`), acts on one record, and does nothing
  if that record has already been decided. Before the call, the server action writes the audit entry in this
  database as the signed-in member of staff (`portal_action_record`, `0022_portal_actions.sql`, which checks
  the capability again): no audit entry, no decision. If the portal then refuses, a second entry says so. The
  portal records the person's name as text beside the record, since they have no account there.
- **Configuration** (`0024_portal_config.sql`): fee schedules and rules (`fees.manage`), commission plans
  (`partners.manage`) and account types (`trading.manage`) are added, changed and retired from Control
  through one portal function, `control_config_write`, which accepts only those four tables and their listed
  columns, checks the values, never deletes, and records each write. The audit entry is written here first
  (`portal_config_record`). One person makes a configuration change; it moves no money by itself.
- **Two more secrets, same rules.** `RAPTOR_BRIDGE_SERVICE_KEY` (with `RAPTOR_BRIDGE_URL`) reaches the
  trading terminal's database for per-symbol settings and trading blocks: used only in
  `src/lib/server/terminal-db.ts`, after `requireTerminal(capability)`. `RESEND_API_KEY` sends service
  e-mail: used only in `src/lib/server/mailer.ts`. Both files are `server-only`. Without either, its screen
  says "not connected" / "not set up" and does nothing.
- **Clients, fees by hand, marketing** (`0027_portal_clients_fees.sql`): a client's status is changed by
  one person (`clients.manage`); a fee charged by hand and a fee reversed move a client's money and take
  two people (`fees.charge`, `portal_two_person`, which keeps what was asked for so the second person
  confirms exactly that); marketing materials and campaign links are `partners.manage`.
- **Trade entered by hand, service e-mail** (`0028_portal_trade_email.sql`): `trading.manage` and
  `emailer.send`. An e-mail goes to one of three audiences fixed in the portal's database; no address is
  typed, shown or written to this database's audit log (audience, subject and count only), and the sender
  must type the number of recipients to confirm.
- **The other sections** (`0026_portal_ops.sql`): provider and fund status (`partners.manage`), ledger
  accounts and manual journal entries (`ledger.manage`), legal documents (`documents.manage`) and a run of
  the event queue (`events.manage`) go through one portal function, `control_ops`, which names each
  operation and what it may do; the audit entry is written first (`portal_ops_record`). One person; none
  moves client money. Trade Log and Bulk Emailer stay read-only.
- **IB network** (`0025_portal_ib.sql`): roles, links and plans are changed by one person holding
  `partners.manage`, each through its own portal function (`control_ib_*`), with the audit entry written
  first (`portal_ib_record`). Paying commission credits a wallet, so it follows the two-person rule below
  (`partners.settle`, `portal_ib_settlement`).
- **Two people on money** (`0023_portal_four_eyes.sql`). Approving a deposit or a withdrawal changes a
  balance, so the first person only asks (`portal_approval_request`) and a second, different person holding
  `funds.settle` confirms (`portal_approval_confirm`); the database refuses the requester, and the change in
  the portal is made only after the confirmation. A rejection takes one person. The stated exception, the
  same as for staff access: when no other active member of staff holds `funds.settle`, the request is
  approved at once and the audit entry is marked `unreviewed`.
- **Opening a KYC file** (`/control/kyc/file/<id>`): staff holding `kyc.read`, from a Control page only,
  and recorded in the audit log (`kyc.view`) before a link is made. The link goes to the portal's private
  storage and works for one minute. The storage path comes from the document's record, never from the
  request.
- Reads are not written to the audit log. Who may read is decided by role; what was read is not recorded.
- The portal's own weaknesses listed in `docs/BACKOFFICE-PLAN.md` (section 1, items 1 to 5 and 7) were closed
  in its database on 3 October 2026 (`portal/supabase/migrations/20261003120000_close_known_security_holes.sql`,
  applied with a self-test of 19 checks that ran inside the migration and was rolled back). Item 6, the shared
  staff login of the portal's own console, is not a database matter and remains.
- Consequence to accept: anyone who obtains this key can read and change everything in the portal's
  database. If it is ever exposed, rotate it in the portal's Supabase project and replace the variable.

## 9. Not built yet (deliberately)

| Not built | Consequence today |
|---|---|
| MFA enforcement for staff | A stolen password is enough to sign in. |
| Four-eyes approval, privileged re-authentication | An admin acts alone; exports need no second person. |
| Service-role operations | No unsubscribe, re-subscribe, deletion or correction through the application; these are done in SQL by the owner. |
| Email sending | No acknowledgement to the enquirer, no notification to staff. |
| File uploads | None accepted anywhere. |
| CAPTCHA / challenge | Bot defence is honeypot, timing and rate limits only. |
| Per-client limiting at the edge, WAF rules | A distributed flood trips the global breaker and makes the forms unavailable. |
| Retention and deletion schedule; privacy-request workflow | Rows are kept until removed in SQL. |
| Staff management in the console | Staff are added and removed in SQL (`docs/CONTROL.md`). |
| Session list / sign out everywhere / inactivity timeout | Sign-out ends the current session only. |
| International (non-ASCII) email addresses | Rejected by the form. |

## 10. Recommended next steps, in order

1. In Supabase Auth: turn **off** public sign-ups; turn **on** leaked-password protection; set a strong
   minimum password length; keep email confirmation on.
2. Enrol every admin in **MFA (TOTP)**, then enforce it: require `aal2` in the staff policies and in
   `staff.ts`.
3. Set session time-box and inactivity timeout in Supabase Auth.
4. Run the Supabase security and performance advisors after every migration.
5. If abuse appears: add Cloudflare Turnstile (or equivalent) to the forms, verified on the server, and a
   per-IP rate-limit rule at the edge.
6. Move the public inserts behind a service-role key held only by the server, then remove the public INSERT
   policies and grants entirely, so the publishable key can do nothing at all.
7. Add email (acknowledgement and staff notification) with SPF, DKIM and DMARC configured first.
8. Define retention periods and build the privacy-request workflow (access, correction, deletion).
9. Before launch: an independent review of the policies and a penetration test.

## 11. The visit counter (`0014_pulse.sql`, `src/lib/pulse.ts`, `src/lib/server/pulse.ts`)

The website counts its own page views, accepted forms and searches. What exists is a set of daily totals
and nothing else; the public statement is `/legal/cookies`, "Counting visits", and its wording is the constant
`PULSE_STATEMENT`, shown word for word to staff at `/control/analytics`.

**Stored:** `pulse_pages (day, path, ref_class, views)`, `pulse_forms (day, form, count)`,
`pulse_search (day, term, count)`, and one throttle row in `pulse_state`. There is no row per visit and no
column that could describe a visitor. A path is one of the site's published paths or `(other)`; a referrer is
one of four words; a search term is one of the site's own words or `(unmatched)`.

**Not stored, not logged:** IP address, user agent, referrer address, query string, fragment, time of day,
any identifier. No cookie is read or set and nothing is written to the browser.

**How a view arrives:** `src/components/shell/Pulse.tsx` (public shell only, never `/control`) sends one
`POST /api/pulse` with `{ path, ref }` once the page is idle: no credentials, no `Referer`. The referrer is
reduced to its class in the browser, so the referring address never reaches the server. A search sends
`POST /api/pulse/search` with `{ term }`, where the term was matched in the browser against the site's own
index; what was typed is not sent. Form totals are added on the server by `/api/contact`, `/api/support` and
`/api/newsletter` at the moment a submission is stored, and cannot fail it.

**Respecting a refusal:** nothing is sent when the browser reports Global Privacy Control or Do Not Track, or
when "Count my visits" is off on `/preferences` (`countVisits` in `gx:prefs`, on by default). The server
checks `Sec-GPC` and `DNT` again, for views, searches and form totals.

| Abuse case | Controls | Honest limit |
|---|---|---|
| Storing something personal through the counter | Exact field allow-list (an extra field is a 400); path checked against the site's own pages, query and fragment removed; term checked against the site's own vocabulary; the database repeats a strict character set and length, which excludes `@`, `?`, `=`, `&`, `%` and upper case | Anyone holding the publishable key can call `pulse_hit`, `pulse_form_hit` and `pulse_search_hit` directly, skipping the API's allow-lists. They can then store a lower-case path-shaped or word-shaped string of their own choosing (bounded: 120 and 48 characters), and inflate any total. The figures are counts for orientation, not audited figures, and the console says so. |
| Filling the tables | Per-address limiter in the API (240 views and 60 searches per 10 minutes); a global database throttle of 600 counted events a minute; at most 1500 distinct paths and 1000 distinct terms a day, the rest added to `(other)`; rows older than 400 days deleted | Under a flood the counter drops events (it does not queue them), so real views in that minute are under-counted. |
| Another site making a visitor's browser count | `Origin` must be this site and `Sec-Fetch-Site`, when present, must be `same-origin` | A non-browser client can send any header. |
| Reading the totals | No table privilege and no policy for any API role; `pulse_summary()` requires `analytics.read` (admin, sales, compliance) | |
| Learning what was counted | Every accepted request is answered `204` with no body, whether it was counted, skipped or could not be recorded | In development only, a response header `X-Pulse-Debug` states the decision so that it can be tested. |

The counter also runs in development against the same database, for browsers that are not automated.
Checks: `node scripts/test-pulse.mjs` (the path normaliser and the term matcher, against the real index and
sitemaps) and `supabase/tests/0014_pulse.sql`.
