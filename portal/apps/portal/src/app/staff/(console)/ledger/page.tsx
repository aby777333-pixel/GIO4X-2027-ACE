import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { loadLedgerAccounts, loadJournal } from "@/lib/fee-actions";
import {
  LEDGER_ACCOUNT_TYPE_LABEL,
  ledgerTypeTone,
  journalStatusTone,
  formatMoney,
  type LedgerAccountType,
  type JournalStatus,
} from "@/lib/fee-constants";
import { NewAccountButton, PostJournalButton } from "./ledger-tools";
import { Receipt, Landmark, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StaffLedgerPage() {
  const [user, accounts, journal] = await Promise.all([
    getCurrentUser(),
    loadLedgerAccounts(),
    loadJournal(40),
  ]);
  const isAdmin = user?.profile?.role === "admin";

  const accountCodes = accounts
    .map((a) => a.code)
    .filter((c): c is string => !!c);

  // Group accounts by type for the chart of accounts.
  const order: LedgerAccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
  const byType = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const k = a.type ?? "asset";
    const list = byType.get(k) ?? [];
    list.push(a);
    byType.set(k, list);
  }

  const tiles = [
    { label: "Accounts", value: String(accounts.length), icon: <Landmark size={16} /> },
    { label: "Journal entries", value: String(journal.length), icon: <Receipt size={16} /> },
    {
      label: "Posted",
      value: String(journal.filter((j) => j.status === "posted").length),
      icon: <Scale size={16} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="General Ledger"
        subtitle="Double-entry chart of accounts and the immutable journal behind every money movement."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/staff/fees"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-steel transition hover:border-sky/30 hover:text-navy"
            >
              <Receipt size={16} /> Fee Engine
            </Link>
            <PostJournalButton accountCodes={accountCodes} />
            {isAdmin ? <NewAccountButton /> : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} />
        ))}
      </div>

      {/* Chart of accounts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Chart of accounts</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {accounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">No ledger accounts yet.</p>
          ) : (
            order
              .filter((t) => byType.has(t))
              .map((t) => (
                <div key={t}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <StatusBadge tone={ledgerTypeTone(t)}>{LEDGER_ACCOUNT_TYPE_LABEL[t]}</StatusBadge>
                  </div>
                  <div className="space-y-1">
                    {(byType.get(t) ?? []).map((a) => (
                      <div
                        key={a.id ?? a.code}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-navy">{a.name}</span>{" "}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-steel">
                            {a.code}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-navy">
                          {formatMoney(a.balance ?? 0, a.currency ?? undefined)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </CardBody>
      </Card>

      {/* Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Recent journal</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {journal.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">No journal entries yet.</p>
          ) : (
            journal.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-navy">{e.description || "—"}</span>
                      {e.reference ? (
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-steel">
                          {e.reference}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-steel-light">
                      {new Date(e.posted_at).toLocaleString()} · {e.source_type}
                    </div>
                  </div>
                  <StatusBadge tone={journalStatusTone(e.status as JournalStatus)}>
                    {e.status}
                  </StatusBadge>
                </div>
                <div className="divide-y divide-slate-50">
                  {e.lines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
                      <span className="text-steel">
                        {l.account_code ?? l.account_id}
                        {l.memo ? <span className="text-steel-light"> · {l.memo}</span> : null}
                      </span>
                      <span
                        className={
                          l.direction === "debit"
                            ? "font-medium text-navy"
                            : "font-medium text-sky"
                        }
                      >
                        {l.direction === "debit" ? "Dr" : "Cr"} {formatMoney(l.amount, l.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
