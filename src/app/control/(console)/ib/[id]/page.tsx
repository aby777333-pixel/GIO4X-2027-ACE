import Link from "next/link";
import { notFound } from "next/navigation";
import { linkIb, setIbPlan, setIbRole, unlinkIb } from "@/app/control/actions-portal";
import { createCampaignLink } from "@/app/control/actions-portal-more";
import { ControlHead, Empty, Facts, NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate, fmtDateTime } from "@/components/control/format";
import { IbNotice, SettleControl, type IbListRow, type SettleRequest } from "@/components/control/portal/IbBits";
import { LINK_DESTINATIONS, LINK_DESTINATION_LABEL, MoreNotice } from "@/components/control/portal/MoreBits";
import { Figures, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";
import { requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("IB", "/control/ib");

const TITLE = "IB Network";
type Num = number | string | null;

/** One partner as control_ib_detail() returns it (portal: 20261003150000_control_ib.sql). Sums are made by the database. */
type Detail = {
  profile: { id: string; name: string | null; email: string | null; role: string; status: string; kyc_status: string; country: string | null; referral_code: string | null; joined: string };
  parent: { id: string; name: string | null; email: string | null; plan_id: string | null; plan_name: string | null; share_override: Num; since: string } | null;
  downline: { id: string; level: number; name: string | null; email: string | null; role: string; status: string; kyc_status: string; accounts: number; lots: Num; commission: Num; last_activity: string | null }[];
  totals: { currency: string; unsettled: Num; settled: Num; lots: Num; rows: number }[];
  wallets: { currency: string; balance: Num; status: string }[];
  referrals: { code: string; name: string | null; destination: string | null; clicks: number | null; conversions: number | null; created_at: string }[];
};
type PlanOption = { id: string; name: string; is_default: boolean };

const positive = (v: Num) => Number(v ?? 0) > 0;
const percent = (v: Num) => (v === null || v === undefined || v === "" ? "–" : `${fmtNum(Math.round(Number(v) * 1e6) / 1e4)} %`);

/**
 * One person in the IB network, as the client portal holds them: who they
 * are, who they sit under and on which plan, everyone beneath them with the
 * lots and commission each has brought, what is owed and what has been paid.
 *
 * partners.read sees it. partners.manage makes a client an IB (or the
 * reverse), places them under an IB, moves or detaches them, and sets the plan
 * and share of the link to their parent. partners.settle pays commission
 * awaiting settlement, which takes two people. Every change goes through
 * src/app/control/actions-portal.ts and is in the audit log before it is made.
 * Amounts are summed by the portal's database, not here.
 */
export default async function IbPersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("partners.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "partners.manage");
  const settles = can(ctx, "partners.settle");

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;

  const [detail, plans, partners, open] = await Promise.all([
    db.rpc("control_ib_detail", { p_ib: id }),
    db.from("commission_plans").select("id, name, is_default").eq("active", true).order("name", { ascending: true }).limit(200),
    manages ? db.rpc("control_ib_list") : null,
    settles ? ctx.supabase.rpc("portal_approvals_open", { p_ids: [id] }) : null,
  ]);
  if (!detail.error && !detail.data) notFound();

  const d = detail.data as Detail | null;
  const planRows = (plans.data ?? []) as PlanOption[];
  const parents = ((partners?.data ?? []) as IbListRow[]).filter((p) => p.id !== id && (p.role === "ib" || p.role === "affiliate"));
  const request = (open?.data ?? [])[0] as SettleRequest | undefined;
  const failed = !!detail.error || !!plans.error || !!partners?.error;

  if (!d) {
    return (
      <>
        <ControlHead title={TITLE} />
        <PortalReadFailed />
      </>
    );
  }

  const p = d.profile;
  const isIb = p.role === "ib" || p.role === "affiliate";
  const who = p.name || p.email || `${p.id.slice(0, 8)}…`;
  const direct = d.downline.filter((m) => m.level === 1).length;
  const owed = d.totals.filter((t) => positive(t.unsettled));
  const at = <input type="hidden" name="at" value={id} />;

  return (
    <>
      <ControlHead
        title={who}
        lead={`${label(p.role)} in the client portal. Everything here is read from the portal’s records.`}
        actions={
          <Link href="/control/ib" className="btn btn-ghost btn-sm">
            Back to the IB network
          </Link>
        }
      />
      <PortalSource decides={manages || settles}>Amounts are summed by the portal’s database.</PortalSource>
      <IbNotice notice={firstParam(sp.notice)} error={firstParam(sp.error)} />
      {/* the two outcomes of "Add a campaign link" that IbNotice has no sentence for */}
      <MoreNotice notice={firstParam(sp.notice)} error={firstParam(sp.error)} only={["link_created", "not_ib"]} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Direct downline", value: fmtNum(direct), note: "Level 1" },
          { label: "Whole network", value: fmtNum(d.downline.length), note: "All levels beneath this person" },
          { label: "Commission awaiting settlement", value: owed.length ? owed.map((t) => fmtMoney(t.unsettled, t.currency)).join(" · ") : "None" },
          { label: "Commission paid so far", value: d.totals.some((t) => positive(t.settled)) ? d.totals.filter((t) => positive(t.settled)).map((t) => fmtMoney(t.settled, t.currency)).join(" · ") : "None" },
        ]}
      />

      <Section title="Profile">
        <Facts
          rows={[
            { label: "Name", value: p.name || "–" },
            { label: "E-mail", value: p.email || "–" },
            { label: "Role", value: <StateBadge value={p.role} /> },
            { label: "Account status", value: <StateBadge value={p.status} /> },
            { label: "KYC", value: <StateBadge value={p.kyc_status} /> },
            { label: "Country", value: p.country || "–" },
            { label: "Referral code", value: <span className="num">{p.referral_code || "–"}</span> },
            { label: "Joined", value: <span className="num">{fmtDate(p.joined)}</span> },
          ]}
        />
        {manages && p.role !== "staff" && p.role !== "admin" && (
          <form action={setIbRole} className="mt-13">
            {at}
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="make" value={isIb ? "client" : "ib"} />
            <SubmitButton pending="Recording…" className={isIb ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
              {isIb ? "Make this person a client again" : "Make this person an introducing broker"}
            </SubmitButton>
            {isIb && d.downline.length > 0 && <span className="ml-13 text-xs text-ink-3">Not possible while there are people beneath them.</span>}
          </form>
        )}
      </Section>

      <Section title="Parent and plan" aside={d.parent ? `Under this IB since ${fmtDate(d.parent.since)}` : "Sits under nobody"}>
        {d.parent ? (
          <Facts
            rows={[
              {
                label: "Sits under",
                value: (
                  <Link href={`/control/ib/${d.parent.id}`} className="link">
                    {d.parent.name || d.parent.email || `${d.parent.id.slice(0, 8)}…`}
                  </Link>
                ),
              },
              { label: "Commission plan", value: d.parent.plan_name || "–" },
              { label: "Share override", value: d.parent.share_override === null ? "None: the plan’s shares apply" : percent(d.parent.share_override) },
            ]}
          />
        ) : (
          <p className="text-sm text-ink-2">This person was not introduced by an IB, or has been detached.</p>
        )}

        {manages && (
          <div className="mt-13 grid gap-13">
            {d.parent && (
              <details>
                <summary className="cursor-pointer text-sm text-ink">Change the plan or share of this link</summary>
                <form action={setIbPlan} className="mt-13 grid gap-13 sm:grid-cols-3 sm:items-end">
                  {at}
                  <input type="hidden" name="child" value={id} />
                  <input type="hidden" name="parent" value={d.parent.id} />
                  <div className="field">
                    <label htmlFor="ib-plan">Commission plan</label>
                    <select id="ib-plan" name="plan" className="select" defaultValue={d.parent.plan_id ?? ""} required>
                      {planRows.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                          {pl.is_default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ib-share">Share override</label>
                    <input id="ib-share" name="share" type="text" inputMode="decimal" className="input" defaultValue={d.parent.share_override === null ? "" : String(d.parent.share_override)} autoComplete="off" aria-describedby="ib-share-hint" />
                    <p id="ib-share-hint" className="field-hint">
                      A fraction: 0.15 is 15%. Empty: the plan’s shares apply.
                    </p>
                  </div>
                  <div>
                    <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                      Save
                    </SubmitButton>
                  </div>
                </form>
              </details>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-ink">{d.parent ? "Move under a different IB" : "Place under an IB"}</summary>
              {parents.length === 0 ? (
                <p className="mt-8 text-sm text-ink-3">There is no other introducing broker to choose.</p>
              ) : (
                <form action={linkIb} className="mt-13 grid gap-13 sm:grid-cols-3 sm:items-end">
                  {at}
                  <input type="hidden" name="child" value={id} />
                  <div className="field">
                    <label htmlFor="ib-parent">Introducing broker</label>
                    <select id="ib-parent" name="parent" className="select" required defaultValue="">
                      <option value="" disabled>
                        Choose
                      </option>
                      {parents.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name || o.email || o.id.slice(0, 8)}
                          {o.email && o.name ? ` · ${o.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ib-link-plan">Commission plan</label>
                    <select id="ib-link-plan" name="plan" className="select" defaultValue="">
                      <option value="">The default plan</option>
                      {planRows.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                      {d.parent ? "Move, with everyone beneath them" : "Place under this IB"}
                    </SubmitButton>
                  </div>
                </form>
              )}
            </details>
            {d.parent && (
              <details>
                <summary className="cursor-pointer text-sm text-ink">Detach from the parent</summary>
                <form action={unlinkIb} className="mt-13">
                  {at}
                  <input type="hidden" name="child" value={id} />
                  <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
                    Detach
                  </SubmitButton>
                  <span className="ml-13 text-xs text-ink-3">The people beneath this person stay beneath them. Commission already written is not changed.</span>
                </form>
              </details>
            )}
          </div>
        )}
      </Section>

      <Section title="Commission" aside="By currency, as the portal’s commission ledger holds it">
        {d.totals.length === 0 ? (
          <Empty title="No commission has been written for this person" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[44rem] text-sm">
              <caption className="sr-only">Commission by currency</caption>
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col">Awaiting settlement</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Rows</th>
                  {settles && <th scope="col">Pay</th>}
                </tr>
              </thead>
              <tbody>
                {d.totals.map((t) => (
                  <tr key={t.currency}>
                    <td className="text-ink">{t.currency}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(t.unsettled, t.currency)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(t.settled, t.currency)}</td>
                    <td className="num text-ink-2">{fmtNum(t.lots)}</td>
                    <td className="num text-ink-2">{fmtNum(t.rows)}</td>
                    {settles && <td>{positive(t.unsettled) ? <SettleControl ib={id} at={id} currency={t.currency} amount={t.unsettled ?? 0} request={request} /> : <span className="text-ink-3">–</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.wallets.length > 0 && (
          <p className="mt-13 text-sm text-ink-2">
            Commission wallet: {d.wallets.map((w) => `${fmtMoney(w.balance, w.currency)}${w.status === "active" ? "" : ` (${label(w.status)})`}`).join(" · ")}
          </p>
        )}
      </Section>

      <Section title="Downline" aside={`${fmtNum(d.downline.length)} ${d.downline.length === 1 ? "person" : "people"}, nearest level first${d.downline.length >= 500 ? " (first 500)" : ""}`}>
        {d.downline.length === 0 ? (
          <Empty title="Nobody sits beneath this person" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Everyone beneath this person in the IB network</caption>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">KYC</th>
                  <th scope="col">Accounts</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Commission to this IB</th>
                  <th scope="col">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {d.downline.map((m) => (
                  <tr key={m.id}>
                    <td className="num text-ink-2">{m.level}</td>
                    <td className="max-w-[16rem]">
                      <Link href={`/control/ib/${m.id}`} className="link block truncate">
                        {m.name || m.email || `${m.id.slice(0, 8)}…`}
                      </Link>
                      {m.name && m.email && <span className="block truncate text-xs text-ink-3">{m.email}</span>}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(m.role)}</td>
                    <td>
                      <StateBadge value={m.status} />
                    </td>
                    <td>
                      <StateBadge value={m.kyc_status} />
                    </td>
                    <td className="num text-ink-2">{fmtNum(m.accounts)}</td>
                    <td className="num text-ink-2">{fmtNum(m.lots)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtNum(m.commission)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(m.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-8 text-xs text-ink-3">Commission is shown as the ledger’s amounts added across currencies only when there is one currency; see the Commission table for each currency.</p>
      </Section>

      <Section title="Referral links" aside={`${fmtNum(d.referrals.length)} in the portal`}>
        {d.referrals.length === 0 ? (
          <Empty title="This person has made no referral link" />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[44rem] text-sm">
              <caption className="sr-only">Referral links of this person</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Clicks</th>
                  <th scope="col">Conversions</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {d.referrals.map((r) => (
                  <tr key={r.code}>
                    <td className="num text-ink">{r.code}</td>
                    <td className="max-w-[14rem] truncate text-ink-2">{r.name || "–"}</td>
                    <td className="text-ink-2">{r.destination ? (LINK_DESTINATION_LABEL[r.destination] ?? r.destination) : "–"}</td>
                    <td className="num text-ink-2">{fmtNum(r.clicks)}</td>
                    <td className="num text-ink-2">{fmtNum(r.conversions)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {manages && isIb && (
          <details className="mt-13 border-t border-line pt-13">
            <summary className="cursor-pointer text-sm text-ink">Add a campaign link</summary>
            <form action={createCampaignLink} className="mt-13 grid gap-13 sm:grid-cols-3 sm:items-end">
              {at}
              <input type="hidden" name="owner" value={id} />
              <div className="field">
                <label htmlFor="ib-link-name">Name</label>
                <input id="ib-link-name" name="name" type="text" className="input" required maxLength={80} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="ib-link-sub">Channel tag (optional)</label>
                <input id="ib-link-sub" name="sub_id" type="text" className="input" pattern="[A-Za-z0-9_\-]{1,40}" maxLength={40} autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <label htmlFor="ib-link-destination">Destination</label>
                <select id="ib-link-destination" name="destination" className="select" required defaultValue="register">
                  {LINK_DESTINATIONS.map((v) => (
                    <option key={v} value={v}>
                      {LINK_DESTINATION_LABEL[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
                  Create the link
                </SubmitButton>
                <span className="ml-13 text-xs text-ink-3">The portal makes the code. A channel tag is letters, digits, dashes and underscores: for example, telegram or newsletter-may. The IB sees the link under Campaign Links.</span>
              </div>
            </form>
          </details>
        )}
      </Section>
    </>
  );
}
