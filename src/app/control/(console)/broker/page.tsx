import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Broker Controls", "/control/broker");

const TITLE = "Broker Controls";
const BASE = "/control/broker";
const PER_PAGE = 50;
const ACCOUNT_STATUSES = ["active", "archived", "suspended"] as const;
const ACCOUNT_KINDS = ["live", "demo", "copy", "prop", "managed"] as const;

type Numeric = number | string | null;

type AccountTypeRow = {
  id: string;
  name: string;
  leverage: number | null;
  min_deposit: Numeric;
  base_currency: string | null;
  spread_from: string | null;
  commission: string | null;
  sort: number | null;
  active: boolean | null;
};

type TradingAccountRow = {
  id: string;
  account_number: string | null;
  user_id: string | null;
  account_kind: string;
  leverage: number | null;
  base_currency: string | null;
  balance: Numeric;
  equity: Numeric;
  margin_free: Numeric;
  status: string;
  plan_name: string | null;
  server: string | null;
  created_at: string;
};

type FlagRow = {
  key: string;
  enabled: boolean | null;
  description: string | null;
  updated_at: string | null;
};

const leverage = (value: number | null): string => (value && value > 0 ? `1:${value}` : "–");
const yesNo = (value: boolean | null, yes: string, no: string): string => (value === null ? "–" : value ? yes : no);

/**
 * The trading conditions the client portal holds: the account types on offer,
 * the trading accounts opened under them, and the portal's switches. Reads
 * only (trading.read): nothing is switched, suspended or re-priced from this
 * screen. The portal's per-symbol controls and trading blocks act on the
 * trading terminal and are not shown here.
 */
export default async function BrokerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("trading.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} />;
  const { db } = access;

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), ACCOUNT_STATUSES, "");
  const kind = oneOf(firstParam(params.kind), ACCOUNT_KINDS, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let accountsQuery = db
    .from("trading_accounts")
    .select("id, account_number, user_id, account_kind, leverage, base_currency, balance, equity, margin_free, status, plan_name, server, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) accountsQuery = accountsQuery.eq("status", status);
  if (kind) accountsQuery = accountsQuery.eq("account_kind", kind);

  const [types, accounts, flags] = await Promise.all([
    db.from("account_types").select("id, name, leverage, min_deposit, base_currency, spread_from, commission, sort, active").order("sort", { ascending: true }).limit(200),
    accountsQuery,
    db.from("feature_flags").select("key, enabled, description, updated_at").order("key", { ascending: true }).limit(200),
  ]);

  const failed = !!types.error || !!accounts.error || !!flags.error;
  const typeRows = (types.data ?? []) as AccountTypeRow[];
  const rows = (accounts.data ?? []) as TradingAccountRow[];
  const flagRows = (flags.data ?? []) as FlagRow[];
  const total = accounts.count ?? 0;
  const people = await portalPeople(
    db,
    rows.map((r) => r.user_id),
  );

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (kind) sp.set("kind", kind);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="The account types the portal offers, the trading accounts opened under them, and the portal’s switches." />
      <PortalSource>Per-symbol controls and trading blocks are set in the portal and are not listed here.</PortalSource>
      {failed && <PortalReadFailed />}

      <Section title="Account types" aside="In the portal’s order">
        {typeRows.length === 0 ? (
          <Empty title={types.error ? "Nothing could be read" : "No account types have been set up"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Account types, in the portal’s order</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Leverage</th>
                  <th scope="col">Minimum deposit</th>
                  <th scope="col">Spread from</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Offered</th>
                </tr>
              </thead>
              <tbody>
                {typeRows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-ink">{row.name}</td>
                    <td className="num whitespace-nowrap text-ink-2">{leverage(row.leverage)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.min_deposit, row.base_currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.spread_from || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.commission || "–"}</td>
                    <td className="whitespace-nowrap text-ink-2">{yesNo(row.active, "Active", "Not active")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <FilterTabs base={BASE} param="status" current={status} options={ACCOUNT_STATUSES} allLabel="All statuses" />
      <FilterTabs base={BASE} param="kind" current={kind} options={ACCOUNT_KINDS} allLabel="All kinds" />
      <p className="mt-8 text-xs text-ink-3">The two filters above apply to the trading accounts. Choosing one clears the other.</p>

      <Section title="Trading accounts" aside={`${status ? label(status) : "All statuses"} · ${kind ? label(kind) : "All kinds"}`}>
        {rows.length === 0 ? (
          <Empty title={accounts.error ? "Nothing could be read" : status || kind ? "No trading accounts match this filter" : "No trading accounts have been opened"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[84rem] text-sm">
              <caption className="sr-only">Trading accounts, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Client</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Leverage</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Equity</th>
                  <th scope="col">Free margin</th>
                  <th scope="col">Status</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Server</th>
                  <th scope="col">Opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.account_number || "–"}</td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id ?? "")} id={row.user_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.account_kind)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{leverage(row.leverage)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.base_currency || "–"}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.balance)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.equity)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.margin_free)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{row.plan_name || "–"}</td>
                    <td className="whitespace-nowrap text-ink-2">{row.server || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "trading account" : "trading accounts"} href={href} />
      </Section>

      <Section title="Switches" aside={flags.error ? undefined : `${fmtNum(flagRows.length)} in the portal`}>
        {flagRows.length === 0 ? (
          <Empty title={flags.error ? "Nothing could be read" : "The portal has no switches"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">The portal’s switches, by key</caption>
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">State</th>
                  <th scope="col">Description</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {flagRows.map((row) => (
                  <tr key={row.key}>
                    <td className="num whitespace-nowrap text-ink">{row.key}</td>
                    <td className="whitespace-nowrap text-ink-2">{yesNo(row.enabled, "On", "Off")}</td>
                    <td className="max-w-[28rem] text-ink-2">{row.description || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.updated_at)}</td>
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
