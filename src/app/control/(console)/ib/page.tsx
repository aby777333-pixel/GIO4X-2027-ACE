import Link from "next/link";
import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate, fmtDateTime } from "@/components/control/format";
import { ConfigManager } from "@/components/control/portal/ConfigManager";
import { IbNotice, SettleControl, type IbListRow, type SettleRequest } from "@/components/control/portal/IbBits";
import { Figures, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("IB Network", "/control/ib");

const TITLE = "IB Network";
const BASE = "/control/ib";
const PER_PAGE = 50;
const LATEST = 50;
const REFERRED_CAP = 5000;
const SETTLED = ["yes", "no"] as const;
const SETTLED_LABEL: Record<(typeof SETTLED)[number], string> = { yes: "Settled", no: "Unsettled" };

type IbRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  kyc_status: string;
  country: string | null;
  referral_code: string | null;
  created_at: string;
};
type ReferredRow = { referred_by: string | null };
type RelationshipRow = {
  id: string;
  parent_id: string;
  child_id: string;
  level: number;
  commission_plan_id: string | null;
  share_override: number | null;
  created_at: string;
};
type PlanRow = {
  id: string;
  name: string;
  rate_per_lot: number | null;
  sub_ib_share_l1: number | null;
  sub_ib_share_l2: number | null;
  is_default: boolean;
  active: boolean;
  description: string | null;
  created_at: string;
};
type LedgerRow = {
  id: string;
  ib_user_id: string;
  source_user_id: string | null;
  lots: number | null;
  amount: number | null;
  currency: string | null;
  period_start: string | null;
  period_end: string | null;
  settled: boolean;
  created_at: string;
};
type ReferralRow = {
  id: string;
  code: string;
  owner_id: string;
  name: string | null;
  destination: string | null;
  clicks: number | null;
  conversions: number | null;
  created_at: string;
};

const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
/** A share the portal stores as a fraction (0.15 is 15%), as a percentage. */
function sharePct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  return Number.isFinite(n) ? `${pct.format(n * 100)}%` : "–";
}

/**
 * The partner network, as the client portal holds it: who introduces clients,
 * who sits under whom, the plans that set what they earn, the commission rows
 * the portal has written and the referral links in use (partners.read).
 * Each partner opens on a page of their own (/control/ib/<id>), where the
 * tree is changed. partners.manage also edits the commission plans here;
 * partners.settle pays commission awaiting settlement, with two people.
 * Counts are of the portal's rows; amounts are summed by the portal's
 * database (control_ib_list), never here.
 */
export default async function IbPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("partners.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "partners.manage");
  const settles = can(ctx, "partners.settle");

  const params = await searchParams;
  const settled = oneOf(firstParam(params.settled), SETTLED, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);
  // reduced to characters that can appear in a name or an address before it goes anywhere near a filter
  const find = cleanSearch(firstParam(params.find)).slice(0, 60);

  let ledgerQuery = db
    .from("commission_ledger")
    .select("id, ib_user_id, source_user_id, lots, amount, currency, period_start, period_end, settled, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (settled) ledgerQuery = ledgerQuery.eq("settled", settled === "yes");

  const [ibs, relationships, relationshipCount, plans, ledger, unsettled, referrals] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, role, status, kyc_status, country, referral_code, created_at", { count: "exact" })
      .in("role", ["ib", "affiliate"])
      .order("created_at", { ascending: false })
      .limit(LATEST),
    db.from("ib_relationships").select("id, parent_id, child_id, level, commission_plan_id, share_override, created_at").order("created_at", { ascending: false }).limit(LATEST),
    db.from("ib_relationships").select("id", { count: "exact", head: true }),
    db.from("commission_plans").select("id, name, rate_per_lot, sub_ib_share_l1, sub_ib_share_l2, is_default, active, description, created_at").order("created_at", { ascending: true }).limit(LATEST),
    ledgerQuery,
    db.from("commission_ledger").select("id", { count: "exact", head: true }).eq("settled", false),
    db.from("referrals").select("id, code, owner_id, name, destination, clicks, conversions, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(LATEST),
  ]);

  // The partners with their parent, plan, downline counts and what is owed; open payment
  // requests for them (Control's own database); and the people a search found.
  const [partners, found] = await Promise.all([
    db.rpc("control_ib_list"),
    find.length >= 2 ? db.from("profiles").select("id, full_name, email, role, status").or(`email.ilike.%${find}%,full_name.ilike.%${find}%`).order("created_at", { ascending: false }).limit(12) : null,
  ]);
  const partnerRows = (partners.data ?? []) as IbListRow[];
  const owing = partnerRows.filter((r) => r.unsettled.length > 0);
  const openRead = settles && owing.length ? await ctx.supabase.rpc("portal_approvals_open", { p_ids: owing.map((r) => r.id) }) : null;
  const requests = new Map((openRead?.data ?? []).map((r) => [r.tx_id, r as SettleRequest]));
  const foundRows = (found?.data ?? []) as { id: string; full_name: string | null; email: string | null; role: string; status: string }[];

  const ibRows = (ibs.data ?? []) as IbRow[];
  const relRows = (relationships.data ?? []) as RelationshipRow[];
  const planRows = (plans.data ?? []) as PlanRow[];
  const ledgerRows = (ledger.data ?? []) as LedgerRow[];
  const referralRows = (referrals.data ?? []) as ReferralRow[];
  const ledgerTotal = ledger.count ?? 0;

  // Clients referred by the partners on this page: one unpaged read, counted here.
  const ibIds = ibRows.map((r) => r.id);
  const [referred, people] = await Promise.all([
    ibIds.length ? db.from("profiles").select("referred_by", { count: "exact" }).in("referred_by", ibIds).limit(REFERRED_CAP) : Promise.resolve({ data: [] as ReferredRow[], error: null, count: 0 }),
    portalPeople(db, [...relRows.flatMap((r) => [r.parent_id, r.child_id]), ...ledgerRows.flatMap((r) => [r.ib_user_id, r.source_user_id]), ...referralRows.map((r) => r.owner_id)]),
  ]);
  const referredRows = (referred.data ?? []) as ReferredRow[];
  // Short of the whole set when the cap, or the database's own row limit, cut the read.
  const referredCut = referredRows.length >= REFERRED_CAP || (referred.count ?? 0) > referredRows.length;
  const referredBy = new Map<string, number>();
  for (const row of referredRows) if (row.referred_by) referredBy.set(row.referred_by, (referredBy.get(row.referred_by) ?? 0) + 1);
  const referredCount = (id: string) => (referred.error ? "–" : `${fmtNum(referredBy.get(id) ?? 0)}${referredCut ? "+" : ""}`);

  const failed = [ibs, relationships, relationshipCount, plans, ledger, unsettled, referrals, referred, partners].some((r) => !!r.error) || !!found?.error;
  const planName = new Map(planRows.map((p) => [p.id, p.name]));
  const figure = (r: { error: unknown; count: number | null }) => (r.error ? "–" : fmtNum(r.count ?? 0));

  const href = (p: number, s: string = settled) => {
    const sp = new URLSearchParams();
    if (s) sp.set("settled", s);
    if (p > 1) sp.set("page", String(p));
    const q = sp.toString();
    return q ? `${BASE}?${q}` : BASE;
  };
  const tab = (value: string, text: string) => (
    <Link key={value || "all"} href={href(1, value)} aria-current={settled === value ? "true" : undefined} className={`btn btn-sm ${settled === value ? "btn-primary" : "btn-ghost"}`}>
      {text}
    </Link>
  );

  return (
    <>
      <ControlHead title={TITLE} lead="Introducing brokers and affiliates in the portal, who sits under whom, the commission plans, the commission rows written so far and the referral links." />
      <PortalSource decides={manages || settles}>
        {manages
          ? "Open a partner to change who they sit under and on which plan. Commission plans are edited beneath their table. Paying commission takes two people."
          : "Open a partner to see their downline and commission."}
      </PortalSource>
      <IbNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "IBs and affiliates", value: figure(ibs), note: "Profiles with either role" },
          { label: "Relationships", value: figure(relationshipCount), note: "Parent and child pairs" },
          { label: "Unsettled commission rows", value: figure(unsettled) },
          { label: "Referral links", value: figure(referrals) },
        ]}
      />

      <Section title="Partners" aside={partners.error ? undefined : `${fmtNum(partnerRows.length)} with the IB or affiliate role, or with a downline${partnerRows.length >= 500 ? " (first 500)" : ""}`}>
        {partnerRows.length === 0 ? (
          <Empty title={partners.error ? "Nothing could be read" : "No introducing broker yet"}>
            {manages && !partners.error && "Find a client below and open their page to make them an introducing broker."}
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[68rem] text-sm">
              <caption className="sr-only">Introducing brokers and affiliates, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Partner</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Sits under</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Direct</th>
                  <th scope="col">Network</th>
                  <th scope="col">Referred</th>
                  <th scope="col">Awaiting settlement</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Link href={`${BASE}/${row.id}`} className="link block truncate">
                        {row.name || row.email || `${row.id.slice(0, 8)}…`}
                      </Link>
                      {row.name && row.email && <span className="block truncate text-xs text-ink-3">{row.email}</span>}
                      {row.referral_code && <span className="num block text-xs text-ink-3">Code {row.referral_code}</span>}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.role)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="max-w-[12rem] truncate text-ink-2">
                      {row.parent_id ? (
                        <Link href={`${BASE}/${row.parent_id}`} className="link">
                          {row.parent_name || `${row.parent_id.slice(0, 8)}…`}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="max-w-[10rem] truncate text-ink-2">{row.plan_name || "–"}</td>
                    <td className="num text-ink-2">{fmtNum(row.direct)}</td>
                    <td className="num text-ink-2">{fmtNum(row.network)}</td>
                    <td className="num text-ink-2">{referredBy.has(row.id) || ibIds.includes(row.id) ? referredCount(row.id) : "–"}</td>
                    <td>
                      {row.unsettled.length === 0 ? (
                        <span className="text-ink-3">–</span>
                      ) : (
                        <div className="grid gap-8">
                          {row.unsettled.map((u) => (
                            <div key={u.currency}>
                              <span className="num block whitespace-nowrap text-ink">{fmtMoney(u.amount, u.currency)}</span>
                              {settles && <SettleControl ib={row.id} currency={u.currency} amount={u.amount} request={requests.get(row.id)} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Find a person" aside="Any client or partner in the portal, by part of a name or an e-mail address">
        <form method="get" action={BASE} role="search" className="grid gap-13 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="field">
            <label htmlFor="ib-find">Name or e-mail</label>
            <input id="ib-find" name="find" type="search" className="input" defaultValue={find} maxLength={60} autoComplete="off" spellCheck={false} aria-describedby="ib-find-hint" />
            <p id="ib-find-hint" className="field-hint">
              At least two characters. Letters, digits and @ . _ + - only. Open a person to make them an introducing broker or place them under one.
            </p>
          </div>
          <div className="flex gap-8 sm:pb-[1.625rem]">
            <button type="submit" className="btn btn-primary">
              Find
            </button>
            {find && (
              <Link href={BASE} className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>
        </form>
        {find.length >= 2 &&
          (foundRows.length === 0 ? (
            <p className="mt-13 text-sm text-ink-2">{found?.error ? "The search could not be run just now." : "Nobody matches."}</p>
          ) : (
            <ul className="mt-13 border-t border-line">
              {foundRows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm last:border-b-0">
                  <Link href={`${BASE}/${r.id}`} className="link">
                    {r.full_name || r.email || `${r.id.slice(0, 8)}…`}
                  </Link>
                  <span className="text-xs text-ink-3">
                    {r.email ? `${r.email} · ` : ""}
                    {label(r.role)} · {label(r.status)}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </Section>

      <Section title="Relationships" aside={`Latest ${LATEST}`}>
        {relRows.length === 0 ? (
          <Empty title={relationships.error ? "Nothing could be read" : "No relationships have been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[56rem] text-sm">
              <caption className="sr-only">IB relationships, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Parent</th>
                  <th scope="col">Child</th>
                  <th scope="col">Level</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Share override</th>
                  <th scope="col">Since</th>
                </tr>
              </thead>
              <tbody>
                {relRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.parent_id)} id={row.parent_id} />
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.child_id)} id={row.child_id} />
                    </td>
                    <td className="num text-ink">{fmtNum(row.level)}</td>
                    <td className="text-ink-2">{row.commission_plan_id ? (planName.get(row.commission_plan_id) ?? <span className="num text-ink-3">{row.commission_plan_id.slice(0, 8)}…</span>) : "–"}</td>
                    <td className="num text-ink-2">{sharePct(row.share_override)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Commission plans" aside="Rate per lot is in US dollars; shares are of the rate">
        {planRows.length === 0 ? (
          <Empty title={plans.error ? "Nothing could be read" : "No commission plans exist"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[56rem] text-sm">
              <caption className="sr-only">Commission plans, oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Rate per lot</th>
                  <th scope="col">Sub-IB share, level 1</th>
                  <th scope="col">Sub-IB share, level 2</th>
                  <th scope="col">Default</th>
                  <th scope="col">State</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[18rem]">
                      <span className="block text-ink">{row.name}</span>
                      {row.description && <span className="block text-xs text-ink-3">{row.description}</span>}
                    </td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.rate_per_lot)}</td>
                    <td className="num text-ink-2">{sharePct(row.sub_ib_share_l1)}</td>
                    <td className="num text-ink-2">{sharePct(row.sub_ib_share_l2)}</td>
                    <td className="text-ink-2">{row.is_default ? "Yes" : "No"}</td>
                    <td>
                      <StateBadge value={row.active ? "active" : "inactive"} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {manages && !plans.error && (
        <ConfigManager
          table="commission_plans"
          title="Add or change a commission plan"
          rows={planRows.map((r) => ({ id: r.id, title: r.is_default ? `${r.name} (default)` : r.name, active: r.active !== false, values: { ...r } }))}
        />
      )}

      <nav aria-label="Filter" className="mt-21 flex flex-wrap gap-8">
        {tab("", "All commission rows")}
        {SETTLED.map((s) => tab(s, SETTLED_LABEL[s]))}
      </nav>

      <Section title="Commission ledger" aside={settled ? SETTLED_LABEL[settled] : "Settled and unsettled"}>
        {ledgerRows.length === 0 ? (
          <Empty title={ledger.error ? "Nothing could be read" : settled ? `No ${SETTLED_LABEL[settled].toLowerCase()} commission rows` : "No commission has been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Commission ledger rows, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">IB</th>
                  <th scope="col">Source client</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Period</th>
                  <th scope="col">Settled</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.ib_user_id)} id={row.ib_user_id} />
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.source_user_id ?? "")} id={row.source_user_id} />
                    </td>
                    <td className="num text-ink-2">{fmtNum(row.lots)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.amount, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.period_start || row.period_end ? `${fmtDate(row.period_start)} to ${fmtDate(row.period_end)}` : "–"}</td>
                    <td>
                      <StateBadge value={row.settled ? "settled" : "pending"} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(ledgerTotal / PER_PAGE))} total={ledgerTotal} noun={ledgerTotal === 1 ? "commission row" : "commission rows"} href={href} />
      </Section>

      <Section title="Referral links" aside={`Latest ${LATEST}`}>
        {referralRows.length === 0 ? (
          <Empty title={referrals.error ? "Nothing could be read" : "No referral links have been created"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Referral links, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Owner</th>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Clicks</th>
                  <th scope="col">Conversions</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {referralRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.owner_id)} id={row.owner_id} />
                    </td>
                    <td className="num whitespace-nowrap text-ink">{row.code}</td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{row.name ?? "–"}</span>
                    </td>
                    <td className="max-w-[16rem] text-ink-2">
                      <span className="block truncate">{row.destination ?? "–"}</span>
                    </td>
                    <td className="num text-ink-2">{fmtNum(row.clicks)}</td>
                    <td className="num text-ink-2">{fmtNum(row.conversions)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
