import Link from "next/link";
import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDate } from "@/components/control/format";
import { MoreNotice } from "@/components/control/portal/MoreBits";
import { Figures, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, requirePortal } from "@/lib/server/portal-db";
import { cleanSearch } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Clients", "/control/clients");

const TITLE = "Clients";
const BASE = "/control/clients";
const PER_PAGE = 50;
const CLIENT_ROLES = ["trader", "ib", "affiliate"] as const;
const STATUSES = ["pending_verification", "active", "suspended", "closed"] as const;
const KYC_STATUSES = ["not_started", "in_progress", "in_review", "approved", "rejected"] as const;

type ClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  kyc_status: string;
  country: string | null;
  created_at: string;
};

/**
 * The client accounts in the portal: every profile that is a trader, an
 * introducing broker or an affiliate, newest first (clients.read). These are
 * people who registered in the portal, as distinct from Customers, who wrote
 * in to the website. Each opens on a page of their own (/control/clients/<id>),
 * where their status is changed and a fee is charged by hand. This list only
 * reads. Every figure is a count of the portal's rows.
 */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("clients.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db } = access;

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), STATUSES, "");
  const kyc = oneOf(firstParam(params.kyc), KYC_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);
  // reduced to characters that can appear in a name or an address before it goes anywhere near a filter
  const q = cleanSearch(firstParam(params.q)).slice(0, 60);
  const searching = q.length >= 2;

  let listQuery = db
    .from("profiles")
    .select("id, full_name, email, role, status, kyc_status, country, created_at", { count: "exact" })
    .in("role", CLIENT_ROLES)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) listQuery = listQuery.eq("status", status);
  if (kyc) listQuery = listQuery.eq("kyc_status", kyc);
  if (searching) listQuery = listQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

  const countOf = (column: "status" | "kyc_status", value: string) => db.from("profiles").select("id", { count: "exact", head: true }).in("role", CLIENT_ROLES).eq(column, value);

  const [list, active, suspended, pending, approved] = await Promise.all([listQuery, countOf("status", "active"), countOf("status", "suspended"), countOf("status", "pending_verification"), countOf("kyc_status", "approved")]);

  const failed = [list, active, suspended, pending, approved].some((r) => !!r.error);
  const rows = (list.data ?? []) as ClientRow[];
  const total = list.count ?? 0;
  const n = (r: { error: unknown; count: number | null }) => (r.error ? "–" : String(r.count ?? 0));

  const url = (next: { status?: string; kyc?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (next.status) sp.set("status", next.status);
    if (next.kyc) sp.set("kyc", next.kyc);
    if (searching) sp.set("q", q);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };
  const href = (p: number) => url({ status, kyc, page: p });
  const tab = (on: boolean, to: string, key: string, text: string) => (
    <Link key={key} href={to} aria-current={on ? "true" : undefined} className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`}>
      {text}
    </Link>
  );

  return (
    <>
      <ControlHead
        title={TITLE}
        lead="Client accounts in the portal: traders, introducing brokers and affiliates, newest first. These are people who registered in the portal, as distinct from Customers, who are people who wrote in to the website."
      />
      <PortalSource>Open a client to see their wallets, accounts, documents and activity.</PortalSource>
      <MoreNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Clients active", value: n(active) },
          { label: "Clients suspended", value: n(suspended) },
          { label: "Pending verification", value: n(pending) },
          { label: "KYC approved", value: n(approved) },
        ]}
      />

      <Section title="Find a client" aside="By part of a name or an e-mail address">
        <form method="get" action={BASE} role="search" className="grid gap-13 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          {status && <input type="hidden" name="status" value={status} />}
          {kyc && <input type="hidden" name="kyc" value={kyc} />}
          <div className="field">
            <label htmlFor="clients-q">Name or e-mail</label>
            <input id="clients-q" name="q" type="search" className="input" defaultValue={q} maxLength={60} autoComplete="off" spellCheck={false} aria-describedby="clients-q-hint" />
            <p id="clients-q-hint" className="field-hint">
              At least two characters. Letters, digits and @ . _ + - only.
            </p>
          </div>
          <div className="flex gap-8 sm:pb-[1.625rem]">
            <button type="submit" className="btn btn-primary">
              Find
            </button>
            {q && (
              <Link href={BASE} className="btn btn-quiet">
                Clear
              </Link>
            )}
          </div>
        </form>
      </Section>

      <nav aria-label="Filter by account status" className="mt-21 flex flex-wrap gap-8">
        {tab(status === "", url({ kyc }), "all", "All statuses")}
        {STATUSES.map((s) => tab(status === s, url({ status: s, kyc }), s, label(s)))}
      </nav>
      <nav aria-label="Filter by KYC status" className="mt-13 flex flex-wrap gap-8">
        {tab(kyc === "", url({ status }), "all", "Any KYC")}
        {KYC_STATUSES.map((k) => tab(kyc === k, url({ status, kyc: k }), k, `KYC ${label(k).toLowerCase()}`))}
      </nav>

      <Section title="Client accounts" aside={[status ? label(status) : "All statuses", kyc ? `KYC ${label(kyc).toLowerCase()}` : "Any KYC", ...(searching ? ["Matching the search"] : [])].join(" · ")}>
        {rows.length === 0 ? (
          <Empty title={list.error ? "Nothing could be read" : status || kyc || searching ? "No clients match this filter" : "Nobody has registered in the portal yet"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[60rem] text-sm">
              <caption className="sr-only">Client accounts in the portal, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">KYC</th>
                  <th scope="col">Country</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[18rem]">
                      <Link href={`${BASE}/${row.id}`} className="link block truncate">
                        {row.full_name || row.email || `${row.id.slice(0, 8)}…`}
                      </Link>
                      {row.full_name && row.email && <span className="block truncate text-xs text-ink-3">{row.email}</span>}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.role)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td>
                      <StateBadge value={row.kyc_status} />
                    </td>
                    <td className="text-ink-2">{row.country || "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "client" : "clients"} href={href} />
      </Section>
    </>
  );
}
