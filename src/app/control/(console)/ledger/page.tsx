import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, requirePortal } from "@/lib/server/portal-db";
import { can } from "@/lib/server/staff";
import { LedgerManager, OpsNotice } from "@/components/control/portal/OpsBits";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("General Ledger", "/control/ledger");

const TITLE = "General Ledger";
const BASE = "/control/ledger";
const PER_PAGE = 50;
const ACCOUNT_LIMIT = 500;
const LINE_LIMIT = 1000;
const ENTRY_STATUSES = ["posted", "void"] as const;

type AccountRow = {
  id: string;
  code: string;
  name: string | null;
  type: string;
  currency: string | null;
  is_system: boolean | null;
  active: boolean | null;
};

type EntryRow = {
  id: string;
  reference: string | null;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  status: string;
  posted_at: string | null;
};

type LineRow = {
  id: string;
  entry_id: string;
  account_id: string;
  direction: string;
  amount: number | string | null;
  currency: string | null;
  memo: string | null;
};

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? "–" : value ? "Yes" : "No");

/**
 * The portal's double-entry ledger: the chart of accounts, and the journal
 * entries with the debit and credit lines of each. Reads only (funds.read):
 * an entry is not posted or voided from this screen. Every figure is a count
 * of the portal's rows; account balances are not worked out here, because a
 * page of lines is not the whole ledger.
 */
export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("funds.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db, ctx } = access;
  const manages = can(ctx, "ledger.manage");

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), ENTRY_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let entriesQuery = db
    .from("journal_entries")
    .select("id, reference, description, source_type, source_id, status, posted_at", { count: "exact" })
    .order("posted_at", { ascending: false })
    .range(from, to);
  if (status) entriesQuery = entriesQuery.eq("status", status);

  const entryCount = (s?: (typeof ENTRY_STATUSES)[number]) => {
    const q = db.from("journal_entries").select("id", { count: "exact", head: true });
    return s ? q.eq("status", s) : q;
  };

  const [entries, accounts, allEntries, posted, voided] = await Promise.all([
    entriesQuery,
    db
      .from("ledger_accounts")
      .select("id, code, name, type, currency, is_system, active", { count: "exact" })
      .order("type", { ascending: true })
      .order("code", { ascending: true })
      .limit(ACCOUNT_LIMIT),
    entryCount(),
    entryCount("posted"),
    entryCount("void"),
  ]);

  const rows = (entries.data ?? []) as EntryRow[];
  const total = entries.count ?? 0;
  const accountRows = (accounts.data ?? []) as AccountRow[];
  const accountTotal = accounts.count ?? accountRows.length;

  // the lines of the entries on this page, in one read
  const entryIds = rows.map((r) => r.id);
  const linesRead = entryIds.length
    ? await db.from("journal_lines").select("id, entry_id, account_id, direction, amount, currency, memo").in("entry_id", entryIds).order("created_at", { ascending: true }).limit(LINE_LIMIT)
    : null;
  const lineRows = (linesRead?.data ?? []) as LineRow[];
  const linesCut = lineRows.length >= LINE_LIMIT;
  const linesOf = new Map<string, LineRow[]>();
  for (const line of lineRows) {
    const list = linesOf.get(line.entry_id);
    if (list) list.push(line);
    else linesOf.set(line.entry_id, [line]);
  }

  // account id → code: from the chart above, then one read for any account beyond its limit
  const accountCode = new Map(accountRows.map((a) => [a.id, a.code]));
  const unknown = [...new Set(lineRows.map((l) => l.account_id).filter((id) => !accountCode.has(id)))];
  const extraRead = unknown.length ? await db.from("ledger_accounts").select("id, code").in("id", unknown) : null;
  for (const a of (extraRead?.data ?? []) as Pick<AccountRow, "id" | "code">[]) accountCode.set(a.id, a.code);

  const failed = [entries, accounts, allEntries, posted, voided].some((r) => r.error) || !!linesRead?.error || !!extraRead?.error;
  const n = (r: { error: unknown; count: number | null }) => (r.error ? "–" : String(r.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="The portal’s chart of accounts, and the journal entries behind every money movement with their debit and credit lines. Newest entry first." />
      <PortalSource decides={manages}>Balances are not shown: they are not worked out on this screen.{manages ? " A manual entry is posted, and accounts are added or switched off, beneath the accounts table." : ""}</PortalSource>
      <OpsNotice notice={firstParam(params.notice)} error={firstParam(params.error)} />
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Journal entries", value: n(allEntries) },
          { label: "Entries posted", value: n(posted) },
          { label: "Entries void", value: n(voided) },
          { label: "Ledger accounts", value: accounts.error ? "–" : String(accountTotal) },
        ]}
      />

      <Section title="Ledger accounts" aside={accounts.error ? undefined : accountRows.length < accountTotal ? `First ${accountRows.length} of ${accountTotal}` : `${accountTotal} ${accountTotal === 1 ? "account" : "accounts"}`}>
        {accountRows.length === 0 ? (
          <Empty title={accounts.error ? "Nothing could be read" : "No ledger accounts have been set up"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Ledger accounts, by type then code</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Currency</th>
                  <th scope="col">System</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.code}</td>
                    <td className="max-w-[18rem] text-ink-2">{row.name || "–"}</td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.type)}</td>
                    <td className="num text-ink-2">{row.currency || "–"}</td>
                    <td className="text-ink-2">{yesNo(row.is_system)}</td>
                    <td className="text-ink-2">{yesNo(row.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {manages && !accounts.error && <LedgerManager accounts={accountRows} />}

      <FilterTabs base={BASE} param="status" current={status} options={ENTRY_STATUSES} allLabel="All entries" />

      <Section title="Journal entries" aside={status ? label(status) : "All statuses"}>
        {linesCut && <p className="text-xs text-ink-3">Only the first {LINE_LIMIT} lines of this page’s entries were read, so some entries below may show fewer lines than they have.</p>}
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status ? "No entries with this status" : "No journal entries have been posted"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Journal entries, newest first, each with its lines</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Description</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Posted</th>
                  <th scope="col">Lines</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const lines = linesOf.get(row.id) ?? [];
                  return (
                    <tr key={row.id}>
                      <td className="num max-w-[12rem] text-ink">
                        <span className="block truncate">{row.reference || "–"}</span>
                      </td>
                      <td className="max-w-[16rem] text-ink-2">{row.description || "–"}</td>
                      <td className="max-w-[12rem] text-ink-2">
                        <span className="block truncate">{label(row.source_type)}</span>
                        {row.source_id && <span className="num block truncate text-xs text-ink-3">{row.source_id}</span>}
                      </td>
                      <td>
                        <StateBadge value={row.status} />
                      </td>
                      <td className="num whitespace-nowrap text-ink-2">{row.posted_at ? fmtDateTime(row.posted_at) : "–"}</td>
                      <td className="text-ink-2">
                        {lines.length === 0 ? (
                          "–"
                        ) : (
                          <ul className="grid gap-3">
                            {lines.map((line) => (
                              <li key={line.id} className="whitespace-nowrap">
                                <span className="text-xs text-ink-3">{label(line.direction)}</span> <span className="num text-ink">{accountCode.get(line.account_id) ?? `${line.account_id.slice(0, 8)}…`}</span>{" "}
                                <span className="num">{fmtMoney(line.amount, line.currency)}</span>
                                {line.memo && <span className="text-xs text-ink-3"> · {line.memo}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "entry" : "entries"} href={href} />
      </Section>
    </>
  );
}
