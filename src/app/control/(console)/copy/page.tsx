import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Copy Trading", "/control/copy");

const TITLE = "Copy Trading";
const BASE = "/control/copy";
const PER_PAGE = 50;
const LATEST = 50;
const PROVIDER_STATUSES = ["pending", "active", "paused", "closed"] as const;

type ProviderRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  risk: string | null;
  performance_fee_bps: number | null;
  provider_share_bps: number | null;
  min_allocation: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};
type ProviderNameRow = { id: string; display_name: string | null };
type SubscriptionRow = {
  id: string;
  follower_id: string;
  provider_id: string;
  allocation: number | null;
  copy_ratio: number | null;
  status: string;
  realized_pnl: number | null;
  fees_paid: number | null;
  currency: string | null;
  started_at: string | null;
};
type CopyTradeRow = {
  id: string;
  provider_id: string;
  follower_id: string;
  symbol: string | null;
  lots: number | null;
  pnl: number | null;
  currency: string | null;
  created_at: string;
};

const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
/** Basis points as a percentage: 2000 is 20%. */
function bpsPct(bps: number | string | null | undefined): string {
  if (bps === null || bps === undefined || bps === "") return "–";
  const n = Number(bps);
  return Number.isFinite(n) ? `${pct.format(n / 100)}%` : "–";
}

/**
 * Copy trading, as the client portal holds it: the signal providers, who
 * follows whom and with how much, and the trades the portal copied to
 * followers. Reads only (partners.read): a provider is not approved, paused
 * or closed from this screen. Every figure is a count of the portal's rows.
 */
export default async function CopyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("partners.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db } = access;

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), PROVIDER_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let providersQuery = db
    .from("signal_providers")
    .select("id, user_id, display_name, risk, performance_fee_bps, provider_share_bps, min_allocation, currency, status, created_at")
    .order("created_at", { ascending: false })
    .limit(LATEST);
  if (status) providersQuery = providersQuery.eq("status", status);

  const [providers, subscriptions, trades, activeProviders, pendingProviders, activeSubscriptions] = await Promise.all([
    providersQuery,
    db
      .from("copy_subscriptions")
      .select("id, follower_id, provider_id, allocation, copy_ratio, status, realized_pnl, fees_paid, currency, started_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    db.from("copy_trades").select("id, provider_id, follower_id, symbol, lots, pnl, currency, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(LATEST),
    db.from("signal_providers").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("signal_providers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("copy_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const providerRows = (providers.data ?? []) as ProviderRow[];
  const subscriptionRows = (subscriptions.data ?? []) as SubscriptionRow[];
  const tradeRows = (trades.data ?? []) as CopyTradeRow[];
  const subscriptionTotal = subscriptions.count ?? 0;

  // Provider names for the subscriptions and trades shown, which the filtered list above may not hold.
  const providerIds = [...new Set([...subscriptionRows.map((r) => r.provider_id), ...tradeRows.map((r) => r.provider_id)].filter(Boolean))];
  const [names, people] = await Promise.all([
    providerIds.length ? db.from("signal_providers").select("id, display_name").in("id", providerIds) : Promise.resolve({ data: [] as ProviderNameRow[], error: null }),
    portalPeople(db, [...providerRows.map((r) => r.user_id), ...subscriptionRows.map((r) => r.follower_id), ...tradeRows.map((r) => r.follower_id)]),
  ]);
  const providerName = new Map(((names.data ?? []) as ProviderNameRow[]).map((p) => [p.id, p.display_name ?? ""]));
  const provider = (id: string) => providerName.get(id) || <span className="num text-ink-3">{id ? `${id.slice(0, 8)}…` : "–"}</span>;

  const failed = [providers, subscriptions, trades, activeProviders, pendingProviders, activeSubscriptions, names].some((r) => !!r.error);
  const figure = (r: { error: unknown; count: number | null }) => (r.error ? "–" : fmtNum(r.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="Signal providers in the portal, the clients who follow them and the trades copied to those followers." />
      <PortalSource>Providers are approved, paused and closed in the portal’s own staff console, not here.</PortalSource>
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Active providers", value: figure(activeProviders) },
          { label: "Providers pending approval", value: figure(pendingProviders) },
          { label: "Active subscriptions", value: figure(activeSubscriptions) },
          { label: "Copied trades", value: figure(trades), note: "All time" },
        ]}
      />

      <FilterTabs base={BASE} param="status" current={status} options={PROVIDER_STATUSES} allLabel="All providers" />

      <Section title="Signal providers" aside={`${status ? label(status) : "All statuses"} · latest ${LATEST}`}>
        {providerRows.length === 0 ? (
          <Empty title={providers.error ? "Nothing could be read" : status ? "No providers with this status" : "No signal providers exist"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Signal providers, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Performance fee</th>
                  <th scope="col">Provider share</th>
                  <th scope="col">Minimum allocation</th>
                  <th scope="col">Status</th>
                  <th scope="col">Since</th>
                </tr>
              </thead>
              <tbody>
                {providerRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[14rem] text-ink">
                      <span className="block truncate">{row.display_name || "–"}</span>
                    </td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id)} id={row.user_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.risk)}</td>
                    <td className="num text-ink-2">{bpsPct(row.performance_fee_bps)}</td>
                    <td className="num text-ink-2">{bpsPct(row.provider_share_bps)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.min_allocation, row.currency)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Subscriptions" aside="All statuses, newest first">
        {subscriptionRows.length === 0 ? (
          <Empty title={subscriptions.error ? "Nothing could be read" : "Nobody has subscribed to a provider"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Copy subscriptions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Follower</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Allocation</th>
                  <th scope="col">Copy ratio</th>
                  <th scope="col">Status</th>
                  <th scope="col">Realised P&amp;L</th>
                  <th scope="col">Fees paid</th>
                  <th scope="col">Started</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.follower_id)} id={row.follower_id} />
                    </td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{provider(row.provider_id)}</span>
                    </td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.allocation, row.currency)}</td>
                    <td className="num text-ink-2">{fmtNum(row.copy_ratio)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.realized_pnl, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.fees_paid, row.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(subscriptionTotal / PER_PAGE))} total={subscriptionTotal} noun={subscriptionTotal === 1 ? "subscription" : "subscriptions"} href={href} />
      </Section>

      <Section title="Copied trades" aside={`Latest ${LATEST}`}>
        {tradeRows.length === 0 ? (
          <Empty title={trades.error ? "Nothing could be read" : "No trades have been copied"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[56rem] text-sm">
              <caption className="sr-only">Copied trades, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Follower</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Symbol</th>
                  <th scope="col">Lots</th>
                  <th scope="col">P&amp;L</th>
                  <th scope="col">Copied</th>
                </tr>
              </thead>
              <tbody>
                {tradeRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.follower_id)} id={row.follower_id} />
                    </td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{provider(row.provider_id)}</span>
                    </td>
                    <td className="num whitespace-nowrap text-ink">{row.symbol ?? "–"}</td>
                    <td className="num text-ink-2">{fmtNum(row.lots)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.pnl, row.currency)}</td>
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
