import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { OpsNotice, StatusManager } from "@/components/control/portal/OpsBits";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("PAMM / MAM", "/control/pamm");

const TITLE = "PAMM / MAM";
const BASE = "/control/pamm";
const PER_PAGE = 50;
const LATEST = 50;
const FUND_STATUSES = ["pending", "active", "paused", "closed"] as const;

type FundRow = {
  id: string;
  manager_id: string;
  name: string;
  currency: string | null;
  management_fee_bps: number | null;
  performance_fee_bps: number | null;
  manager_share_bps: number | null;
  min_investment: number | null;
  lockup_days: number | null;
  nav_per_unit: number | null;
  units_outstanding: number | null;
  aum: number | null;
  status: string;
  created_at: string;
};
type FundNameRow = { id: string; name: string | null };
type InvestmentRow = {
  id: string;
  fund_id: string;
  investor_id: string;
  units: number | null;
  invested_amount: number | null;
  realized_pnl: number | null;
  fees_paid: number | null;
  currency: string | null;
  status: string;
  locked_until: string | null;
};
type TransactionRow = {
  id: string;
  fund_id: string;
  investor_id: string | null;
  kind: string;
  units_delta: number | null;
  amount: number | null;
  nav_at: number | null;
  currency: string | null;
  created_at: string;
};

const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
/** Basis points as a percentage: 200 is 2%. */
function bpsPct(bps: number | string | null | undefined): string {
  if (bps === null || bps === undefined || bps === "") return "–";
  const n = Number(bps);
  return Number.isFinite(n) ? `${pct.format(n / 100)}%` : "–";
}

/**
 * Managed funds, as the client portal holds them: each fund and its terms,
 * who has invested in it, and the fund's transactions. Reads only
 * (partners.read): a fund is not approved, its NAV is not set and nothing is
 * redeemed from this screen. NAV, units and AUM are shown as the portal
 * stored them, not recalculated. Every figure is a count of the portal's rows.
 */
export default async function PammPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("partners.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "partners.manage");

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), FUND_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let fundsQuery = db
    .from("pamm_funds")
    .select("id, manager_id, name, currency, management_fee_bps, performance_fee_bps, manager_share_bps, min_investment, lockup_days, nav_per_unit, units_outstanding, aum, status, created_at")
    .order("created_at", { ascending: false })
    .limit(LATEST);
  if (status) fundsQuery = fundsQuery.eq("status", status);

  const fundCount = (value: (typeof FUND_STATUSES)[number]) => db.from("pamm_funds").select("id", { count: "exact", head: true }).eq("status", value);
  const [funds, investments, transactions, activeInvestments, ...byStatus] = await Promise.all([
    fundsQuery,
    db
      .from("pamm_investments")
      .select("id, fund_id, investor_id, units, invested_amount, realized_pnl, fees_paid, currency, status, locked_until", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    db.from("pamm_transactions").select("id, fund_id, investor_id, kind, units_delta, amount, nav_at, currency, created_at").order("created_at", { ascending: false }).limit(LATEST),
    db.from("pamm_investments").select("id", { count: "exact", head: true }).eq("status", "active"),
    ...FUND_STATUSES.map((s) => fundCount(s)),
  ]);

  const fundRows = (funds.data ?? []) as FundRow[];
  const investmentRows = (investments.data ?? []) as InvestmentRow[];
  const transactionRows = (transactions.data ?? []) as TransactionRow[];
  const investmentTotal = investments.count ?? 0;

  // Fund names for the investments and transactions shown, which the filtered list above may not hold.
  const fundIds = [...new Set([...investmentRows.map((r) => r.fund_id), ...transactionRows.map((r) => r.fund_id)].filter(Boolean))];
  const [names, people] = await Promise.all([
    fundIds.length ? db.from("pamm_funds").select("id, name").in("id", fundIds) : Promise.resolve({ data: [] as FundNameRow[], error: null }),
    portalPeople(db, [...fundRows.map((r) => r.manager_id), ...investmentRows.map((r) => r.investor_id), ...transactionRows.map((r) => r.investor_id)]),
  ]);
  const fundName = new Map(((names.data ?? []) as FundNameRow[]).map((f) => [f.id, f.name ?? ""]));
  const fund = (id: string) => fundName.get(id) || <span className="num text-ink-3">{id ? `${id.slice(0, 8)}…` : "–"}</span>;

  const failed = [funds, investments, transactions, activeInvestments, names, ...byStatus].some((r) => !!r.error);
  const n = (i: number) => (byStatus[i]?.error ? "–" : fmtNum(byStatus[i]?.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="Managed funds in the portal and their terms, the clients invested in them and each fund’s transactions." />
      <PortalSource decides={manages}>NAV, units and AUM are the portal’s stored values, not recalculated here.{manages ? " A fund is approved, paused, resumed or closed beneath the table." : ""}</PortalSource>
      <OpsNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Active funds", value: n(1) },
          { label: "Funds pending approval", value: n(0) },
          { label: "Paused funds", value: n(2), note: `Closed: ${n(3)}` },
          { label: "Active investments", value: activeInvestments.error ? "–" : fmtNum(activeInvestments.count ?? 0) },
        ]}
      />

      <FilterTabs base={BASE} param="status" current={status} options={FUND_STATUSES} allLabel="All funds" />

      <Section title="Funds" aside={`${status ? label(status) : "All statuses"} · latest ${LATEST}`}>
        {fundRows.length === 0 ? (
          <Empty title={funds.error ? "Nothing could be read" : status ? "No funds with this status" : "No funds exist"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[88rem] text-sm">
              <caption className="sr-only">PAMM and MAM funds, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Fund</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Management fee</th>
                  <th scope="col">Performance fee</th>
                  <th scope="col">Manager share</th>
                  <th scope="col">Minimum investment</th>
                  <th scope="col">Lock-up</th>
                  <th scope="col">NAV per unit</th>
                  <th scope="col">Units outstanding</th>
                  <th scope="col">AUM as stored</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {fundRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[14rem] text-ink">
                      <span className="block truncate">{row.name || "–"}</span>
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.manager_id)} id={row.manager_id} />
                    </td>
                    <td className="num text-ink-2">{row.currency ?? "–"}</td>
                    <td className="num text-ink-2">{bpsPct(row.management_fee_bps)}</td>
                    <td className="num text-ink-2">{bpsPct(row.performance_fee_bps)}</td>
                    <td className="num text-ink-2">{bpsPct(row.manager_share_bps)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.min_investment, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.lockup_days === null || row.lockup_days === undefined ? "–" : `${fmtNum(row.lockup_days)} ${Number(row.lockup_days) === 1 ? "day" : "days"}`}</td>
                    <td className="num text-ink-2">{fmtNum(row.nav_per_unit)}</td>
                    <td className="num text-ink-2">{fmtNum(row.units_outstanding)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.aum, row.currency)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {manages && !funds.error && <StatusManager kind="fund" rows={fundRows.map((r) => ({ id: r.id, title: r.name || `${r.id.slice(0, 8)}…`, status: r.status }))} />}

      <Section title="Investments" aside="All statuses, newest first">
        {investmentRows.length === 0 ? (
          <Empty title={investments.error ? "Nothing could be read" : "Nobody has invested in a fund"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Fund investments, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Fund</th>
                  <th scope="col">Investor</th>
                  <th scope="col">Units</th>
                  <th scope="col">Invested</th>
                  <th scope="col">Realised P&amp;L</th>
                  <th scope="col">Fees paid</th>
                  <th scope="col">Status</th>
                  <th scope="col">Locked until</th>
                </tr>
              </thead>
              <tbody>
                {investmentRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[14rem] text-ink">
                      <span className="block truncate">{fund(row.fund_id)}</span>
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.investor_id)} id={row.investor_id} />
                    </td>
                    <td className="num text-ink-2">{fmtNum(row.units)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.invested_amount, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.realized_pnl, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.fees_paid, row.currency)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.locked_until)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(investmentTotal / PER_PAGE))} total={investmentTotal} noun={investmentTotal === 1 ? "investment" : "investments"} href={href} />
      </Section>

      <Section title="Transactions" aside={`Latest ${LATEST}`}>
        {transactionRows.length === 0 ? (
          <Empty title={transactions.error ? "Nothing could be read" : "No fund transactions have been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Fund transactions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Fund</th>
                  <th scope="col">Investor</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Units change</th>
                  <th scope="col">Amount</th>
                  <th scope="col">NAV at the time</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {transactionRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[14rem] text-ink">
                      <span className="block truncate">{fund(row.fund_id)}</span>
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.investor_id ?? "")} id={row.investor_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{row.kind === "nav" ? "NAV" : label(row.kind)}</td>
                    <td className="num text-ink-2">{fmtNum(row.units_delta)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.amount, row.currency)}</td>
                    <td className="num text-ink-2">{fmtNum(row.nav_at)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
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
