# GIO4X Control

The internal console at `/control`. It reads and triages enquiries, runs the sales pipeline and its
follow-ups, reads newsletter subscriptions and the audit log, and manages who is on staff. It is not linked from the public site and is never indexed, but neither of
those is the protection: access is decided on the server for every request and enforced again by the
database. See `docs/SECURITY.md` for the model.

## What is in it

| Route | Purpose | Who |
|---|---|---|
| `/control/sign-in` | Email and password. No sign-up. | anyone |
| `/control` | Enquiries by status, new enquiries without an owner, the newest eight, subscription count | staff |
| `/control/pipeline` | One column per stage with its count and highest-scoring enquiries | `leads.read` |
| `/control/leads` | All enquiries; filter by status, stage and topic, order by date or score, search by reference or email; 25 per page | `leads.read` |
| `/control/leads/[id]` | The enquiry, consent evidence, status, stage, score with its reasons, assignment, follow-ups, internal notes, history, other enquiries from the same address | `leads.read` (changes: `leads.write`, `tasks.write`) |
| `/control/tasks` | Follow-ups: mine or everyone's, open or completed; 50 per page | `leads.read` (complete: `tasks.write`) |
| `/control/staff` | Who is on staff, requests to change that, and their approval | `staff.read` (changes: `staff.manage`) |
| `/control/subscribers` | Subscriptions with consent evidence; 50 per page | staff |
| `/control/subscribers/export` (POST) | CSV export, recorded in the audit log | admin |
| `/control/audit` | The audit log; 50 per page | staff |

Times are shown in UTC, for everyone.

## Roles and capabilities

A role is a named set of capabilities. Policies and actions never name a role: they ask
`staff_can('leads.write')`. The mapping lives in the table `role_capabilities` (migration `0004`), which no
API role can read or write. A new module adds its capabilities with an `INSERT` in its own migration.

| Role | Can today |
|---|---|
| `admin` | Everything: all of the below, assign to anyone, export subscribers, manage staff. |
| `compliance` | Read enquiries, subscribers, the audit log and the staff list. Change nothing. |
| `sales`, `agent` | Read enquiries, subscribers and the audit log; change status and stage, take or release an enquiry, add notes and follow-ups. |
| `support` | As sales, without subscribers. |
| `finance`, `dealing` | Read the audit log. Their modules are not built yet. |
| `viewer` | Read enquiries, subscribers and the audit log. Change nothing. |

Capabilities: `leads.read`, `leads.write`, `leads.assign`, `tasks.write`, `subscribers.read`,
`subscribers.export`, `audit.read`, `staff.read`, `staff.manage`. The TypeScript list is
`CAPABILITIES` in `src/lib/server/constants.ts`; the console's menu is filtered by them in
`src/components/control/nav-items.ts`.

A member of staff can be switched off (`active = false`) instead of deleted. An inactive row grants
nothing, and the person's name stays on the notes and audit entries they wrote.

## Status, stage and score

- **Status** says where the conversation is: New, Open, Waiting, Resolved, Spam.
- **Stage** says where the relationship is: Enquiry, Contacted, Qualified, Applying, Client, Lost. A lost
  enquiry always carries a reason; the database refuses one without it and clears the reason when the
  stage moves on.
- **Score** is 0 to 100, a generated column computed by the database from what the enquirer told us
  (topic, account type named, phone, country, marketing consent, campaign link). Complaints, press,
  privacy, security and technical enquiries score 0: they are matters to resolve, not sales leads. The
  lead page lists the reasons. The rules are in `0005_crm.sql` and restated in
  `src/components/control/score.ts`; change both together.

## Follow-ups

A follow-up is one line, a due time (UTC) and an owner, added on the enquiry it belongs to. It is created
for oneself unless the person holds `leads.assign`. Completing and reopening record who and when. The
overview shows your own follow-ups that are overdue or due within 24 hours.

## Staff changes and four eyes

Every change to staff access made in the console is a **request** (`staff_changes`). It is applied when a
second person holding `staff.manage` approves it. The database refuses anyone approving their own request
or a request about themselves, and refuses a change that would leave nobody able to manage staff.

One exception, stated plainly: when no active manager exists other than the requester and the person the
request is about, nobody could approve, so the request is applied at once and marked **unreviewed**. That is
how the first colleague is added, and how one of two admins can still remove the other. Each such case is
shown on the Staff page and in the audit log.

The console cannot create a sign-in account: it holds no key that could. Create the user in Supabase under
Authentication, Users, then use "Give someone access" on the Staff page with the same address.

Nobody can edit or delete an enquiry, a note, a subscription or an audit entry through the console or the
API. Those are SQL operations for the owner.

## How an enquiry flows

1. A visitor submits the contact form or the account-interest form. `POST /api/contact` validates it and
   stores it with status **New** and a reference such as `GX-7K2MQ4XA`, which the visitor is shown.
2. It appears on the overview and in Leads. A member of staff opens it and takes it (**Assign to me**) or an
   admin assigns it.
3. Status moves as the work does: **Open** (being handled), **Waiting** (waiting for the enquirer),
   **Resolved** (closed), or **Spam**.
4. Notes record what was done. They are internal and are never sent to the enquirer.
5. Every status change, assignment and note is written to the audit log by the database, with who and when.

The console does not send email. Reply from your own mailbox (the email address on the enquiry is a
`mailto:` link) and note what you sent.

Consent: each enquiry records that the privacy notice was accepted, when, and against which policy version.
Marketing consent is separate and is off unless the visitor ticked it. **Do not add an address to any mailing
unless "Marketing: Opted in" is shown.**

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (safe in a browser) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin; also accepted by the forms' same-origin check |
| `PRIVACY_POLICY_VERSION` | The version of the published Privacy Policy recorded with each consent (letters, digits, `. _ -`, max 40). Until it is set, rows are recorded as `unversioned`. Change it whenever the policy changes. |

If the Supabase variables are missing, the forms answer 503 with a generic message and `/control` shows
"Not configured".

## Applying the migrations

Files, in order:

1. `supabase/migrations/0001_init.sql`: tables, constraints, indexes; RLS enabled and forced; all API
   privileges revoked.
2. `supabase/migrations/0002_security.sql`: helper functions, precise grants, policies.
3. `supabase/migrations/0003_triggers.sql`: throttles, timestamps, audit triggers, append-only guard.
4. `supabase/migrations/0004_capabilities.sql`: roles by capability, the active switch, staff requests
   and the functions that apply them.
5. `supabase/migrations/0005_crm.sql`: pipeline stage, lost reason, score, follow-up tasks.

Apply them as the `postgres` role (the Supabase SQL editor, `supabase db push`, or the Supabase MCP
`apply_migration`). `0002` stops with a clear error if the applying role cannot bypass RLS, because the
helper functions depend on it. Each file can be re-run. The database is safe after each step: after `0001`
alone, nothing is reachable through the API at all.

Afterwards run the checks in `docs/SECURITY.md`, section 3, and the Supabase security advisor.

Recommended Supabase Auth settings before the first account is created: public sign-ups **off**, email
confirmation on, leaked-password protection on.

## Managing staff in SQL (owner only)

The Staff page is the normal route. SQL remains for the cases it cannot cover: the first admin, changing
your own row, or recovering access. SQL changes are not requests and are not reviewed; the audit log
records them with the actor "Database (SQL)".

```sql
-- add a colleague (create their user in Authentication → Users first)
insert into public.staff (user_id, role, display_name)
select id, 'agent', 'Colleague Name' from auth.users where email = 'colleague@example.com';

-- change a role
update public.staff set role = 'viewer'
where user_id = (select id from auth.users where email = 'colleague@example.com');

-- remove access (their enquiries become unassigned; their notes and audit entries remain)
delete from public.staff
where user_id = (select id from auth.users where email = 'colleague@example.com');
```

Each of these is recorded in the audit log automatically. To end a person's access completely, also delete
or ban the user in **Authentication → Users**, which invalidates their sessions.

Keep at least two admins once there is a second trusted person, so that one lost password does not lock
the console.

## Creating the first admin

There are no default accounts and no passwords in the repository.

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter your email address and a strong,
   unique password (use a password manager), and mark the email as confirmed.
2. In the **SQL editor**, run this once, with your own email address and name:

```sql
insert into public.staff (user_id, role, display_name)
select id, 'admin', 'Your Name'
from auth.users
where email = 'you@example.com';

-- confirm: exactly one row, role admin
select s.user_id, u.email, s.role, s.display_name, s.created_at
from public.staff s
join auth.users u on u.id = s.user_id;
```

If the `insert` reports `INSERT 0 0`, the email address did not match a user: check step 1.

3. Open `/control/sign-in` and sign in. Then enrol in MFA when it is enabled (see `docs/SECURITY.md`,
   section 10).
