import Link from "next/link";
import { settleWalletTransaction } from "@/app/control/actions-portal";
import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Decide, DecisionNotice } from "@/components/control/portal/Decide";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Funds & Settlement", "/control/funds");

const TITLE = "Funds & Settlement";
const BASE = "/control/funds";
const PER_PAGE = 50;
const TRANSFERS_SHOWN = 20;
const TX_STATUSES = ["pending", "processing", "completed", "failed", "reversed", "cancelled"] as const;
const TX_TYPES = ["deposit", "withdraw", "transfer_in", "transfer_out", "bonus", "rebate", "commission", "fee", "adjustment"] as const;

type TxRow = {
  id: string;
  wallet_id: string;
  type: string;
  amount: number | string | null;
  currency: string | null;
  status: string;
  gateway: string | null;
  gateway_ref: string | null;
  reviewed_by: string | null;
  created_at: string;
};

type WalletRow = { id: string; wallet_id: string | null; user_id: string };

type TransferRow = {
  id: string;
  user_id: string;
  from_kind: string;
  from_currency: string | null;
  from_amount: number | string | null;
  to_kind: string;
  to_currency: string | null;
  to_amount: number | string | null;
  status: string;
  created_at: string;
};

/**
 * Money in and out of client wallets, as the client portal holds it: every
 * wallet transaction, and the transfers clients made between their own wallets
 * and trading accounts (funds.read). A person who holds funds.settle can
 * approve or reject a deposit or withdrawal that is still pending: one at a
 * time, through src/app/control/actions-portal.ts, which records the decision
 * in the audit log before it is made. Approving credits or debits the wallet
 * in the portal's database and takes two people: the first asks, a second
 * confirms (0023_portal_four_eyes.sql). A rejection takes one. Every figure is
 * a count of the portal's rows; no amounts are added up here.
 */
export default async function FundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("funds.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const decides = can(ctx, "funds.settle");

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), TX_STATUSES, "");
  const type = oneOf(firstParam(params.type), TX_TYPES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let txQuery = db
    .from("wallet_transactions")
    .select("id, wallet_id, type, amount, currency, status, gateway, gateway_ref, reviewed_by, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) txQuery = txQuery.eq("status", status);
  if (type) txQuery = txQuery.eq("type", type);

  const pendingOf = (t: "deposit" | "withdraw") => db.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("type", t).eq("status", "pending");
  const walletsOf = (s: "active" | "frozen") => db.from("wallets").select("id", { count: "exact", head: true }).eq("status", s);

  const [txs, transfers, withdrawalsPending, depositsPending, allTx, walletsActive, walletsFrozen] = await Promise.all([
    txQuery,
    db
      .from("account_transfers")
      .select("id, user_id, from_kind, from_currency, from_amount, to_kind, to_currency, to_amount, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(TRANSFERS_SHOWN),
    pendingOf("withdraw"),
    pendingOf("deposit"),
    db.from("wallet_transactions").select("id", { count: "exact", head: true }),
    walletsOf("active"),
    walletsOf("frozen"),
  ]);

  const rows = (txs.data ?? []) as TxRow[];
  const total = txs.count ?? 0;
  const transferRows = (transfers.data ?? []) as TransferRow[];
  const transferTotal = transfers.count ?? 0;

  // wallet → its owner, for the wallets on this page only
  const walletIds = [...new Set(rows.map((r) => r.wallet_id).filter(Boolean))];
  const walletsRead = walletIds.length ? await db.from("wallets").select("id, wallet_id, user_id").in("id", walletIds) : null;
  const wallets = new Map<string, WalletRow>();
  for (const w of (walletsRead?.data ?? []) as WalletRow[]) wallets.set(w.id, w);

  const failed = [txs, transfers, withdrawalsPending, depositsPending, allTx, walletsActive, walletsFrozen].some((r) => r.error) || !!walletsRead?.error;
  // open approval requests for the rows on this page, from Control's own database (0023)
  const openIds = rows.filter((r) => (r.type === "deposit" || r.type === "withdraw") && (r.status === "pending" || r.status === "processing")).map((r) => r.id);
  const requestsRead = decides && openIds.length ? await ctx.supabase.rpc("portal_approvals_open", { p_ids: openIds }) : null;
  const requests = new Map((requestsRead?.data ?? []).map((r) => [r.tx_id, r]));
  const people = await portalPeople(db, [...rows.flatMap((r) => [wallets.get(r.wallet_id)?.user_id, r.reviewed_by]), ...transferRows.map((r) => r.user_id)]);
  const n = (r: { error: unknown; count: number | null }) => (r.error ? "–" : String(r.count ?? 0));

  const url = (next: { status?: string; type?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (next.status) sp.set("status", next.status);
    if (next.type) sp.set("type", next.type);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };
  const href = (p: number) => url({ status, type, page: p });
  const typeTab = (value: string, text: string) => {
    const on = type === value;
    return (
      <Link key={value || "all"} href={url({ status, type: value })} aria-current={on ? "true" : undefined} className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`}>
        {text}
      </Link>
    );
  };

  return (
    <>
      <ControlHead title={TITLE} lead="Deposits, withdrawals and every other movement on client wallets in the portal, newest first, with the internal transfers beneath." />
      <PortalSource decides={decides}>
        {decides
          ? "Approving a deposit credits the wallet; approving a withdrawal debits it. It takes two people: one asks, another confirms. Check the payment itself before you do either."
          : "Settlement is done by finance."}
      </PortalSource>
      <DecisionNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Withdrawals pending", value: n(withdrawalsPending) },
          { label: "Deposits pending", value: n(depositsPending) },
          { label: "Wallet transactions", value: n(allTx), note: "All types and statuses" },
          { label: "Wallets active", value: n(walletsActive), note: `Frozen: ${n(walletsFrozen)}` },
        ]}
      />

      <FilterTabs base={BASE} param="status" current={status} options={TX_STATUSES} allLabel="All statuses" />
      <nav aria-label="Filter by type" className="mt-13 flex flex-wrap gap-8">
        {typeTab("", "All types")}
        {TX_TYPES.map((t) => typeTab(t, label(t)))}
      </nav>

      <Section title="Wallet transactions" aside={[status ? label(status) : "All statuses", type ? label(type) : "All types"].join(" · ")}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status || type ? "No transactions match this filter" : "No wallet transactions have been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[76rem] text-sm">
              <caption className="sr-only">Wallet transactions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Gateway / reference</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Reviewed by</th>
                  {decides && <th scope="col">Decision</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const wallet = wallets.get(row.wallet_id);
                  return (
                    <tr key={row.id}>
                      <td className="max-w-[16rem]">
                        {wallet ? <Person person={people.get(wallet.user_id)} id={wallet.user_id} /> : <span className="text-ink-3">–</span>}
                        <span className="num block truncate text-xs text-ink-3">Wallet {wallet?.wallet_id || `${row.wallet_id.slice(0, 8)}…`}</span>
                      </td>
                      <td className="whitespace-nowrap text-ink">{label(row.type)}</td>
                      <td className="num whitespace-nowrap text-ink">{fmtMoney(row.amount, row.currency)}</td>
                      <td>
                        <StateBadge value={row.status} />
                      </td>
                      <td className="max-w-[14rem] text-ink-2">
                        <span className="block truncate">{row.gateway || "–"}</span>
                        {row.gateway_ref && <span className="num block truncate text-xs text-ink-3">{row.gateway_ref}</span>}
                      </td>
                      <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                      <td className="max-w-[12rem] text-ink-2">{row.reviewed_by ? <Person person={people.get(row.reviewed_by)} id={row.reviewed_by} /> : "–"}</td>
                      {decides && (
                        <td>
                          {(row.type === "deposit" || row.type === "withdraw") && (row.status === "pending" || row.status === "processing") ? (
                            (() => {
                              const asked = requests.get(row.id);
                              const verb = row.type === "deposit" ? "credit" : "debit";
                              return (
                                <Decide
                                  action={settleWalletTransaction}
                                  id={row.id}
                                  what={`${label(row.type)} of ${fmtMoney(row.amount, row.currency)}`}
                                  reference={!asked}
                                  approve={!asked?.mine}
                                  approveValue={asked ? "confirm" : "approve"}
                                  approveLabel={asked ? `Confirm and ${verb} (2 of 2)` : "Approve (1 of 2)"}
                                  cancel={!!asked}
                                  note={
                                    asked
                                      ? asked.mine
                                        ? `You asked for approval on ${fmtDateTime(asked.requested_at)}. Somebody else must confirm it.`
                                        : `${asked.requested_by_name} asked for approval on ${fmtDateTime(asked.requested_at)}${asked.reference ? `, reference ${asked.reference}` : ""}.`
                                      : undefined
                                  }
                                />
                              );
                            })()
                          ) : (
                            <span className="text-ink-3">–</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "transaction" : "transactions"} href={href} />
      </Section>

      <Section title="Internal transfers" aside={transfers.error ? undefined : `Latest ${Math.min(TRANSFERS_SHOWN, transferTotal)} of ${transferTotal}`}>
        {transferRows.length === 0 ? (
          <Empty title={transfers.error ? "Nothing could be read" : "No internal transfers have been made"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Transfers between a client’s own wallets and trading accounts, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Status</th>
                  <th scope="col">Made</th>
                </tr>
              </thead>
              <tbody>
                {transferRows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id)} id={row.user_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      <span className="num block text-ink">{fmtMoney(row.from_amount, row.from_currency)}</span>
                      <span className="block text-xs text-ink-3">{label(row.from_kind)}</span>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      <span className="num block text-ink">{fmtMoney(row.to_amount, row.to_currency)}</span>
                      <span className="block text-xs text-ink-3">{label(row.to_kind)}</span>
                    </td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
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
