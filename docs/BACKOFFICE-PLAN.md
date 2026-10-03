# From GIO4X Control to a brokerage back office: plan

Written 2 October 2026, after reading the four reference repositories the owner named
(`GIO4X-JUNE-2026`, `Giocrm`, `GIO4X-NEW`, `GIO4X`) and GIO4X Control as built. Nothing in this
document is built yet. It records what was found, the order of work, and the decisions that are the
owner's to make before money-handling modules are written.

## 1. What exists today

| System | Database (Supabase project) | State |
|---|---|---|
| GIO4X Control, this repository | `GIO4X 2027 ACE` | 5 tables: staff, leads, lead notes, newsletter subscribers, audit log. 1 member of staff, 0 enquiries. Publishable key only, RLS forced, audit written by triggers. Small and sound. |
| June 2026 monorepo: client portal + "Service Console" | `GIO4X JUNE 2026` | 65 migrations, 22 console sections, client portal with sign-up, KYC, wallets, deposits, withdrawals, transfers, IB, copy trading, PAMM, tickets, chat. Much of it works end to end. |
| Giocrm | `GIOCRM` | A CRM front end over Supabase; screens worth borrowing, no access control worth keeping. |
| GIO4X-NEW, GIO4X | – | Marketing sites. No back office. |

The June system is the reference for **what** a GIO4X back office does. It cannot be the base for
**how**, because of what its own SQL allows:

1. Any signed-in client can credit any wallet (`process_wallet_transaction` has no caller check).
2. Demo money can be transferred into a real wallet.
3. Anyone can register as `admin` (the sign-up trigger copies the role from the form).
4. Any member of staff can make themselves admin; section permissions are only hidden menu items.
5. A client can insert their own KYC document as already approved.
6. Staff share one login, so the audit trail cannot say who did what.
7. Pending withdrawals do not reserve funds; balances are a mutable column, not derived from a ledger.

> **3 October 2026: decision D2 taken by the owner.** The June portal is kept. Its source was copied into
> `portal/` and it is served by the website at `/portal`, still on its own database (`GIO4X JUNE 2026`).
> Control's unbuilt sections link to the portal's staff console (`docs/PORTAL-GATEWAY.md`). Nothing in the
> portal's SQL was changed by that work: the seven problems above are still open and have to be closed
> before real client money or documents go through it. D3 was checked the same day: 12 accounts, 1 wallet
> transaction, 6 KYC documents, no tickets.

> **3 October 2026, later the same day: second decision by the owner.** Control gets its own screens for the
> twelve remaining sections, reading the portal's database with that project's secret key
> (`docs/SECURITY.md` 8a), in place of rebuilding them in this database first. Built so far: read-only
> screens for all twelve. Next: close the weaknesses listed above in the portal's database
> (`portal/supabase/migrations/20261003120000_close_known_security_holes.sql`, written for review, not
> applied), then add decisions and approvals to Control one reviewed function at a time.

## 2. Recommended shape

Build the back office **inside this repository and this database**, module by module, in the way
Control is already built (RLS and column grants as the signed-in member of staff, definer functions
for anything privileged, audit by trigger, no secret key in the application), using the June system
as the functional specification and its table shapes where they are sound. Client and trading data
that already exists in the June database is migrated in once the matching module exists here.

The alternative, pointing Control at the June database, would inherit the seven problems above and
would need a secret key in this application, which `docs/SECURITY.md` rules out.

## 3. Order of work

Each phase is one or more numbered migrations plus its pages, and is usable on its own.

| Phase | Modules (old console name in brackets) | Depends on |
|---|---|---|
| 0. Foundation | **Built (2 October 2026):** capability-based roles, per-person staff accounts with an on/off switch, staff management screen with four eyes, sectioned navigation, phone layout. **Still to do:** MFA required for staff (needs an enrolment screen, and a test account to check it) | Nothing |
| 1. CRM | **Built:** pipeline stages with lost reasons, lead score with its reasons, follow-up tasks, other enquiries from the same address. **Still to do:** automatic assignment rules, e-mail reminders (needs the sending domain) | Phase 0 |
| 2. Clients and KYC | Client records, document intake and viewer, per-document decisions, status derived from documents (Customers, KYC) | A client portal that creates clients: decision D2 |
| 3. Money | Double-entry ledger as the only source of balances, deposit and withdrawal requests with holds, verified payout methods, four-eyes approval, fee engine (Funds & Settlement, Fee Engine, General Ledger) | Phase 2; D3 |
| 4. Support | **Built (2 October 2026):** tickets opened and followed on the website at `/support` (reference plus e-mail, no client account needed), staff queue with internal reply targets, live chat offered only while staff are present. **Still to do:** e-mail notification of a reply (needs the sending domain), canned replies, linking tickets to client accounts | E-mail domain; Phase 2 for the client link |
| 5. Trading | Trading accounts, trade log, exposure, broker controls, trading-conditions manager (Trade Log, Broker Controls) | A trading-server connection: D4 |
| 6. Partners | IB network and commissions, copy trading, PAMM (IB Network, Copy Trading, PAMM / MAM) | Phases 3 and 5 |
| 7. Oversight | **Built (2 October 2026), over what exists today:** Customers (people who wrote in, not client accounts), a Compliance register of complaints, privacy and security matters, the Reporting Centre with an enquiries export, the Command Centre. **Still to do:** risk scoring, screening and case files; money and trading figures | Phases 2 to 6 for the rest |
| 8. Publishing | **Built (2 October 2026):** Configuration: the website's announcement line, the chat switch, support hours, and staff-written incident notices on the public Status page. **Still to do:** CMS, e-mail studio, SEO and content health | E-mail domain; independent of 2–7 |

Rules that apply from Phase 3 on, taken from the study of Control: amounts are `numeric` with a
currency and are never taken from a form after creation; ledgers are append-only and corrected by
reversal; every state change is a compare-and-set inside the database; the approver is never the
requester; every retryable operation carries an idempotency key.

## 4. Decisions for the owner

| # | Decision | Why it cannot be guessed |
|---|---|---|
| D1 | Confirm the recommended shape in section 2 | It decides where every later table lives. |
| D2 | Client portal: build a new one in this repository, or keep the June portal and re-point it? | Phases 2 to 6 have no data without clients. The June portal has the holes listed above. |
| D3 | Is there real client money or real client data in `GIO4X JUNE 2026` today? | If yes, migration and reconciliation come first and nothing there may be touched casually. |
| D4 | Trading server: MetaTrader 5 Manager API, the 777 Raptor bridge, or both, and the credentials | Trade log, exposure, margin and commissions have no source without it. |
| D5 | Payment providers and bank details for deposits and withdrawals | The June system settled by hand; card and crypto flows need a provider. |
| D6 | KYC and sanctions-screening vendor, or manual review only | Shapes the KYC and compliance tables. |
| D7 | A way to test signed-in Control screens: a staff test account on a separate test database | Staff screens cannot be checked without signing in, and the owner's account should not be used for tests. |
| D8 | The legal entity and licence the back office operates under | Limits, retention periods, and what the client agreement lets staff do. |

## 5. The 35 ideas: what can be built now, and what waits

Buildable with what is already in the repository: watchlist and saved articles on the device (8),
campaign landing pages with UTM attribution (15), `security.txt` (18, first part), display mode for
office screens (22), embeddable market clock and converter (23), CRM pipeline (24), staff management
(30), phone-friendly Control (35), content and link health dashboard (28, partly), automated
data-quality checks on the reference fixings (34).

Waiting for a licensed data provider (`WAITING-FOR-ABE` F2): live quotes (1), economic calendar (2),
policy rates and meeting dates (3), Market Pulse (4), Time Machine (5), Chart of the Day (7, partly).

Waiting for portals and the phases above: connected portals (9), online account opening and KYC
(10), MT5 server details and downloads (12), trading-conditions manager (31), ticketing (27).

Waiting for a credential or a third party: live chat staffing (13), GIO4X AI (14), e-mail studio and
newsletter (26, 7), status monitoring (17), analytics (29), independent security test (18, second
part), reviewed legal documents (19), accessibility audit (21), translations (16).

Waiting for owner-supplied content: Raptor feature library and release notes (11).
