import Link from "next/link";
import { notFound } from "next/navigation";
import { chargeFeeByHand, setClientStatus } from "@/app/control/actions-portal-more";
import { Notice, ControlHead, Empty, Facts, NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate, fmtDateTime } from "@/components/control/format";
import { FEE_TYPES } from "@/components/control/portal/config-fields";
import { MoreNotice } from "@/components/control/portal/MoreBits";
import { Figures, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";
import { requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** What client_close_blockers() can report (portal: 20261003200000_client_close_guard.sql), in words. */
const CLOSE_BLOCKERS: Record<string, string> = {
  wallet_balance: "A wallet still holds a balance: it has to be withdrawn first.",
  pending_transactions: "A deposit or withdrawal is still pending: approve or reject it in Funds & Settlement.",
  account_balance: "A live trading account still holds balance or equity: it has to be transferred to the wallet and withdrawn.",
  open_trades: "A trade is still open.",
  copy: "A copy-trading subscription is still active, as follower or as the provider being followed.",
  pamm: "A fund investment is still active, or a fund they manage still has units outstanding.",
  ib_unsettled: "IB commission is awaiting settlement: pay it from their IB page.",
  downline: "People sit beneath them in the IB network: move or detach them first.",
};
export const metadata = controlMeta("Clients", "/control/clients");

const TITLE = "Clients";
const STATUS_CHOICES = [
  { value: "active", text: "Activate" },
  { value: "suspended", text: "Suspend" },
  { value: "closed", text: "Close" },
] as const;
type Num = number | string | null;

/** One client as control_client_detail() returns them (portal: 20261003170000_control_more.sql). The reserved sum is made by the database. */
type Detail = {
  profile: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    role: string;
    status: string;
    kyc_status: string;
    referral_code: string | null;
    joined: string;
    referred_by: string | null;
    referred_by_name: string | null;
  };
  wallets: { id: string; wallet_id: string | null; type: string; currency: string; balance: Num; status: string; reserved: Num }[];
  accounts: { id: string; account_number: string | number | null; kind: string | null; leverage: Num; currency: string | null; balance: Num; equity: Num; status: string; plan: string | null; opened: string }[];
  kyc: { id: string; doc_type: string; file_name: string | null; status: string; uploaded: string; reviewed_at: string | null; rejection_reason: string | null }[];
  transactions: { id: string; type: string; amount: Num; currency: string | null; status: string; gateway: string | null; created_at: string }[];
  trades: { id: string; ticket: string | number | null; symbol: string | null; side: string | null; lots: Num; pnl: Num; currency: string | null; status: string; at: string | null }[];
  counts: { trades: number; transactions: number };
};

/**
 * One client of the portal, as a back office needs to see them: who they are
 * and who referred them, their wallets (with what is reserved for withdrawals
 * still pending), trading accounts, KYC documents, and the latest wallet
 * transactions and trades (clients.read).
 *
 * clients.manage activates, suspends or closes the account; a portal staff or
 * admin profile is not changed from here. fees.charge asks for a fee to be
 * charged by hand, which debits the client's main USD wallet and takes two
 * people; the second confirms on the Fee Engine screen. Both go through
 * src/app/control/actions-portal-more.ts and are in the audit log before
 * anything is changed. A KYC file opens through /control/kyc/file/<id>, which
 * records the opening.
 */
export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("clients.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "clients.manage");
  const charges = can(ctx, "fees.charge");
  const opensFiles = can(ctx, "kyc.read");

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;

  const detail = await db.rpc("control_client_detail", { p_id: id });
  if (!detail.error && !detail.data) notFound();
  const d = detail.data as Detail | null;

  if (!d) {
    return (
      <>
        <ControlHead title={TITLE} />
        <PortalReadFailed />
      </>
    );
  }

  const p = d.profile;
  const who = p.name || p.email || `${p.id.slice(0, 8)}…`;
  const isStaffProfile = p.role === "staff" || p.role === "admin";
  const isPartner = p.role === "ib" || p.role === "affiliate";
  const onward = [
    ...((isPartner || p.referred_by) && can(ctx, "partners.read") ? [{ href: `/control/ib/${p.id}`, text: "In the IB network" }] : []),
    ...(can(ctx, "funds.read") ? [{ href: "/control/funds", text: "Funds & Settlement" }] : []),
    ...(opensFiles ? [{ href: "/control/kyc", text: "KYC" }] : []),
    ...(can(ctx, "trading.read") ? [{ href: "/control/trades", text: "Trade Log" }] : []),
  ];

  return (
    <>
      <ControlHead
        title={who}
        lead={`${label(p.role)} in the client portal. Everything here is read from the portal’s records.`}
        actions={
          <Link href="/control/clients" className="btn btn-ghost btn-sm">
            Back to the clients
          </Link>
        }
      />
      <PortalSource decides={(manages && !isStaffProfile) || charges}>Balances are as the portal holds them; the reserved amounts are summed by the portal’s database.</PortalSource>
      <MoreNotice notice={firstParam(sp.notice)} error={firstParam(sp.error)} />
      {firstParam(sp.error) === "blocked" && (
        <div className="mt-21">
          <Notice tone="error" title="This account cannot be closed yet">
            Nothing was changed. An account is closed only when nothing is left in it and nothing is in motion. What stands in the way:
            <ul className="mt-5 list-disc pl-21">
              {firstParam(sp.why)
                .split(".")
                .filter((code) => Object.prototype.hasOwnProperty.call(CLOSE_BLOCKERS, code))
                .map((code) => (
                  <li key={code}>{CLOSE_BLOCKERS[code]}</li>
                ))}
            </ul>
            The client can be suspended at once in the meantime.
          </Notice>
        </div>
      )}

      <Figures
        items={[
          { label: "Wallets", value: fmtNum(d.wallets.length) },
          { label: "Trading accounts", value: fmtNum(d.accounts.length) },
          { label: "Wallet transactions", value: fmtNum(d.counts.transactions), note: "All types and statuses" },
          { label: "Trades", value: fmtNum(d.counts.trades), note: "Open and closed" },
        ]}
      />

      <Section title="Profile">
        <Facts
          rows={[
            { label: "Name", value: p.name || "–" },
            { label: "E-mail", value: p.email || "–" },
            { label: "Telephone", value: <span className="num">{p.phone || "–"}</span> },
            { label: "Country", value: p.country || "–" },
            { label: "Role", value: <StateBadge value={p.role} /> },
            { label: "Account status", value: <StateBadge value={p.status} /> },
            { label: "KYC", value: <StateBadge value={p.kyc_status} /> },
            { label: "Referral code", value: <span className="num">{p.referral_code || "–"}</span> },
            {
              label: "Referred by",
              value: p.referred_by ? (
                <Link href={`/control/clients/${p.referred_by}`} className="link">
                  {p.referred_by_name || `${p.referred_by.slice(0, 8)}…`}
                </Link>
              ) : (
                "Nobody"
              ),
            },
            { label: "Joined", value: <span className="num">{fmtDate(p.joined)}</span> },
          ]}
        />
        {onward.length > 0 && (
          <p className="mt-13 flex flex-wrap gap-8">
            {onward.map((o) => (
              <Link key={o.href} href={o.href} className="btn btn-ghost btn-sm">
                {o.text}
              </Link>
            ))}
          </p>
        )}
      </Section>

      {manages && !isStaffProfile && (
        <Section title="Change the account status" aside="Recorded in the audit log with your name">
          <details>
            <summary className="cursor-pointer text-sm text-ink">
              Activate, suspend or close this account <span className="text-ink-3">· now {label(p.status).toLowerCase()}</span>
            </summary>
            <form action={setClientStatus} className="mt-13 grid gap-13 sm:grid-cols-3 sm:items-end">
              <input type="hidden" name="id" value={p.id} />
              <div className="field">
                <label htmlFor="client-status">New status</label>
                <select id="client-status" name="status" className="select" required defaultValue="">
                  <option value="" disabled>
                    Choose
                  </option>
                  {STATUS_CHOICES.filter((c) => c.value !== p.status).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="client-reason">Reason</label>
                <input id="client-reason" name="reason" type="text" className="input" maxLength={300} autoComplete="off" aria-describedby="client-reason-hint" />
                <p id="client-reason-hint" className="field-hint">
                  Required to suspend or close: at least five characters. It is kept with the change in both audit logs.
                </p>
              </div>
              <div>
                <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                  Change the status
                </SubmitButton>
              </div>
            </form>
            <p className="mt-8 text-xs text-ink-3">The status alone is changed. Balances, open positions and pending withdrawals are not touched: check them below before closing an account.</p>
          </details>
        </Section>
      )}

      <Section title="Wallets" aside={`${fmtNum(d.wallets.length)} in the portal`}>
        {d.wallets.length === 0 ? (
          <Empty title="This person has no wallet" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Wallets of this client</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Reserved for pending withdrawals</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.wallets.map((w) => (
                  <tr key={w.id}>
                    <td className="text-ink">
                      {label(w.type)}
                      {w.wallet_id && <span className="num block text-xs text-ink-3">Wallet {w.wallet_id}</span>}
                    </td>
                    <td className="num text-ink-2">{w.currency}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(w.balance, w.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(w.reserved, w.currency)}</td>
                    <td>
                      <StateBadge value={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {charges && (
          <details className="mt-13 border-t border-line pt-13">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Charge a fee by hand</summary>
            <form action={chargeFeeByHand} className="mt-13 grid gap-13 sm:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="decision" value="request" />
              <input type="hidden" name="user_id" value={p.id} />
              <input type="hidden" name="at" value={p.id} />
              <div className="field">
                <label htmlFor="fee-type">Fee type</label>
                <select id="fee-type" name="fee_type" className="select" required defaultValue="">
                  <option value="" disabled>
                    Choose
                  </option>
                  {FEE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {label(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fee-amount">Amount (USD)</label>
                <input id="fee-amount" name="amount" type="text" inputMode="decimal" pattern="[0-9]{1,9}([.][0-9]{1,2})?" className="input" required autoComplete="off" aria-describedby="fee-amount-hint" />
                <p id="fee-amount-hint" className="field-hint">
                  Greater than zero, at most two decimal places.
                </p>
              </div>
              <div className="field sm:col-span-2 xl:col-span-3">
                <label htmlFor="fee-notes">What it is for</label>
                <input id="fee-notes" name="notes" type="text" className="input" required minLength={5} maxLength={300} autoComplete="off" />
              </div>
              <div className="sm:col-span-2 xl:col-span-3">
                <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                  Ask for the charge (1 of 2)
                </SubmitButton>
                <span className="ml-13 text-xs text-ink-3">
                  It debits this client’s main USD wallet and takes two people: you ask here, and a different person confirms it on the Fee Engine screen. Nothing moves until then.
                </span>
              </div>
            </form>
          </details>
        )}
      </Section>

      <Section title="Trading accounts" aside={`${fmtNum(d.accounts.length)} in the portal, newest first`}>
        {d.accounts.length === 0 ? (
          <Empty title="This person has no trading account" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[56rem] text-sm">
              <caption className="sr-only">Trading accounts of this client</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Leverage</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Equity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Opened</th>
                </tr>
              </thead>
              <tbody>
                {d.accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="num whitespace-nowrap text-ink">{a.account_number ?? `${a.id.slice(0, 8)}…`}</td>
                    <td className="whitespace-nowrap text-ink-2">{label(a.kind)}</td>
                    <td className="max-w-[12rem] truncate text-ink-2">{a.plan || "–"}</td>
                    <td className="num text-ink-2">{a.leverage === null || a.leverage === "" ? "–" : `1:${fmtNum(a.leverage)}`}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(a.balance, a.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(a.equity, a.currency)}</td>
                    <td>
                      <StateBadge value={a.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(a.opened)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="KYC documents" aside={`${fmtNum(d.kyc.length)} uploaded, newest first`}>
        {d.kyc.length === 0 ? (
          <Empty title="This person has uploaded no document" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[52rem] text-sm">
              <caption className="sr-only">KYC documents of this client</caption>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">File</th>
                  <th scope="col">Status</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {d.kyc.map((k) => (
                  <tr key={k.id}>
                    <td className="whitespace-nowrap text-ink">{label(k.doc_type)}</td>
                    <td className="max-w-[16rem] text-ink-2">
                      {opensFiles ? (
                        // a plain link, not next/link: it must not be prefetched, since opening a document is recorded
                        <a href={`/control/kyc/file/${k.id}`} target="_blank" rel="noopener" className="link block truncate">
                          {k.file_name ?? "Open the file"}
                          <span className="sr-only"> (opens the document in a new tab; recorded in the audit log)</span>
                        </a>
                      ) : (
                        <span className="block truncate">{k.file_name ?? "–"}</span>
                      )}
                    </td>
                    <td>
                      <StateBadge value={k.status} />
                      {k.rejection_reason && <span className="mt-3 block max-w-[16rem] text-xs text-ink-3">{k.rejection_reason}</span>}
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(k.uploaded)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{k.reviewed_at ? fmtDateTime(k.reviewed_at) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Wallet transactions" aside={`Latest ${fmtNum(d.transactions.length)} of ${fmtNum(d.counts.transactions)}`}>
        {d.transactions.length === 0 ? (
          <Empty title="No wallet transaction has been recorded for this person" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Latest wallet transactions of this client, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Gateway</th>
                  <th scope="col">Requested</th>
                </tr>
              </thead>
              <tbody>
                {d.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-ink">{label(t.type)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(t.amount, t.currency)}</td>
                    <td>
                      <StateBadge value={t.status} />
                    </td>
                    <td className="max-w-[14rem] truncate text-ink-2">{t.gateway || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Trades" aside={`Latest ${fmtNum(d.trades.length)} of ${fmtNum(d.counts.trades)}`}>
        {d.trades.length === 0 ? (
          <Empty title="This person has not traded" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[52rem] text-sm">
              <caption className="sr-only">Latest trades of this client, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Symbol</th>
                  <th scope="col">Side</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Profit or loss</th>
                  <th scope="col">Status</th>
                  <th scope="col">Closed or opened</th>
                </tr>
              </thead>
              <tbody>
                {d.trades.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap text-ink-2">{t.ticket ?? "–"}</td>
                    <td className="num whitespace-nowrap text-ink">{t.symbol || "–"}</td>
                    <td className="whitespace-nowrap text-ink-2">{label(t.side)}</td>
                    <td className="num text-ink-2">{fmtNum(t.lots)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(t.pnl, t.currency)}</td>
                    <td>
                      <StateBadge value={t.status} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{t.at ? fmtDateTime(t.at) : "–"}</td>
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
