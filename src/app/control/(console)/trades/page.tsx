import Link from "next/link";
import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { RecordTradeForm, TerminalNotice } from "@/components/control/portal/TerminalBits";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Trade Log", "/control/trades");

const TITLE = "Trade Log";
const BASE = "/control/trades";
const PER_PAGE = 50;
const STATUSES = ["open", "closed", "cancelled"] as const;

type Numeric = number | string | null;

type TradeRow = {
  id: string;
  ticket: number | string | null;
  trading_account_id: string | null;
  user_id: string | null;
  symbol: string;
  side: string;
  lots: Numeric;
  open_price: Numeric;
  close_price: Numeric;
  pnl: Numeric;
  commission: Numeric;
  swap: Numeric;
  currency: string | null;
  status: string;
  source: string | null;
  platform: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
};

type AccountRow = { id: string; account_number: string | null };

/** A symbol as typed, reduced to what a symbol can be: A-Z, 0-9, "." and "_", at most 20 characters. */
function cleanSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9._]/g, "")
    .slice(0, 20);
}

/**
 * Trades, as the client portal holds them: one row per ticket, newest opened
 * first. Reads only (trading.read): a trade is not opened, closed or amended
 * from this screen. Every figure is a count of the portal's rows; prices and
 * amounts are shown as stored.
 */
export default async function TradesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("trading.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "trading.manage");

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), STATUSES, "");
  const symbol = cleanSymbol(firstParam(params.symbol));
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let tradesQuery = db
    .from("trades")
    .select("id, ticket, trading_account_id, user_id, symbol, side, lots, open_price, close_price, pnl, commission, swap, currency, status, source, platform, opened_at, closed_at, created_at", { count: "exact" })
    .order("opened_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) tradesQuery = tradesQuery.eq("status", status);
  if (symbol) tradesQuery = tradesQuery.eq("symbol", symbol);

  const tradeCount = () => db.from("trades").select("id", { count: "exact", head: true });
  const accountCount = (kind: "live" | "demo") => db.from("trading_accounts").select("id", { count: "exact", head: true }).eq("account_kind", kind);
  const [trades, open, closed, all, live, demo] = await Promise.all([tradesQuery, tradeCount().eq("status", "open"), tradeCount().eq("status", "closed"), tradeCount(), accountCount("live"), accountCount("demo")]);

  const rows = (trades.data ?? []) as TradeRow[];
  const total = trades.count ?? 0;

  const accountIds = [...new Set(rows.map((r) => r.trading_account_id).filter((v): v is string => !!v))];
  const [people, accounts] = await Promise.all([
    portalPeople(
      db,
      rows.map((r) => r.user_id),
    ),
    accountIds.length ? db.from("trading_accounts").select("id, account_number").in("id", accountIds) : Promise.resolve({ data: [] as AccountRow[], error: null }),
  ]);
  const accountNumber = new Map<string, string>();
  for (const a of (accounts.data ?? []) as AccountRow[]) if (a.account_number) accountNumber.set(a.id, a.account_number);

  const failed = !!trades.error || !!open.error || !!closed.error || !!all.error || !!live.error || !!demo.error || !!accounts.error;
  const n = (r: { error: unknown; count: number | null }) => (r.error ? "–" : String(r.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (symbol) sp.set("symbol", symbol);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  // active accounts for the hand-entered trade, named by number, kind and holder
  type AccountOption = { id: string; account_number: string | null; account_kind: string; user_id: string };
  const optionRead = manages ? await db.from("trading_accounts").select("id, account_number, account_kind, user_id").eq("status", "active").order("created_at", { ascending: false }).limit(300) : null;
  const optionRows = (optionRead?.data ?? []) as AccountOption[];
  const holders = optionRows.length ? await portalPeople(db, optionRows.map((r) => r.user_id)) : new Map();
  const accountOptions = optionRows.map((r) => ({ id: r.id, label: `${r.account_number ?? r.id.slice(0, 8)} · ${label(r.account_kind)} · ${holders.get(r.user_id)?.name || holders.get(r.user_id)?.email || "client"}` }));

  return (
    <>
      <ControlHead title={TITLE} lead="Every trade the portal has recorded against a client’s trading account. Newest opened first." />
      <PortalSource decides={manages}>Prices, lots and amounts are shown as the portal stored them.{manages ? " Trades come from the platform; one can be entered by hand beneath the figures when the platform did not deliver it." : ""}</PortalSource>
      <TerminalNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Open trades", value: n(open) },
          { label: "Closed trades", value: n(closed) },
          { label: "Total trades", value: n(all), note: "Open, closed and cancelled" },
          { label: "Trading accounts", value: `${n(live)} live · ${n(demo)} demo`, note: "Other kinds are not counted here" },
        ]}
      />

      <form method="get" action={BASE} role="search" aria-label="Search trades by symbol" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="field">
          <label htmlFor="trades-symbol">Symbol</label>
          <input id="trades-symbol" name="symbol" type="search" className="input" defaultValue={symbol} maxLength={20} placeholder="The whole symbol, as the portal records it" autoComplete="off" spellCheck={false} aria-describedby="trades-symbol-hint" />
          <p id="trades-symbol-hint" className="field-hint">
            Exact match. Letters, digits, full stop and underscore only; anything else is removed. Choosing a status below clears the symbol.
          </p>
        </div>
        <div className="flex gap-8 sm:pb-[1.625rem]">
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {symbol && (
            <Link href={status ? `${BASE}?status=${status}` : BASE} className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      <FilterTabs base={BASE} param="status" current={status} options={STATUSES} allLabel="All trades" />

      {manages && <RecordTradeForm accounts={accountOptions} />}

      <Section title="Trades" aside={[status ? label(status) : "All statuses", symbol || null].filter(Boolean).join(" · ")}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status || symbol ? "No trades match this filter" : "No trades have been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[96rem] text-sm">
              <caption className="sr-only">Trades, newest opened first</caption>
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Client</th>
                  <th scope="col">Account</th>
                  <th scope="col">Symbol</th>
                  <th scope="col">Side</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Open price</th>
                  <th scope="col">Close price</th>
                  <th scope="col">P&amp;L</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Swap</th>
                  <th scope="col">Status</th>
                  <th scope="col">Opened</th>
                  <th scope="col">Closed</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.ticket ?? "–"}</td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id ?? "")} id={row.user_id} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{accountNumber.get(row.trading_account_id ?? "") ?? "–"}</td>
                    <td className="num whitespace-nowrap text-ink">{row.symbol}</td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.side)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtNum(row.lots)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtNum(row.open_price)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtNum(row.close_price)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.pnl, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.commission)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.swap)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.opened_at)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.closed_at)}</td>
                    <td className="whitespace-nowrap text-ink-2">{row.platform === "mt5" ? "MetaTrader 5" : "777 Raptor"}</td>
                    <td className="whitespace-nowrap text-ink-2">{row.source || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "trade" : "trades"} href={href} />
      </Section>
    </>
  );
}
