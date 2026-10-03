"use server";

// §29 Reporting Centre — filterable, exportable reports over the real platform
// data. Staff-gated, read-only. Returns a plain { columns, rows } grid the
// client renders and exports to CSV. Scheduled email delivery reuses the Bulk
// Emailer (needs RESEND_API_KEY) — surfaced honestly in the UI, not faked here.

import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { RESOLUTION_LABEL } from "@/lib/ticket-constants";

export type ReportType = "trades" | "revenue" | "ib" | "funds" | "clients" | "support";

export type ReportResult = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  summary?: string;
  error?: string;
};

export const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: "trades", label: "Trades", desc: "Every deal in the window — volume, P&L, commission, swap." },
  { key: "revenue", label: "Revenue summary", desc: "Commission, swap and client P&L totals for the window." },
  { key: "ib", label: "IB commissions", desc: "Commission ledger lines accrued in the window." },
  { key: "funds", label: "Deposits & withdrawals", desc: "Cashier transactions in the window." },
  { key: "clients", label: "Clients", desc: "Registrations and KYC status in the window." },
  { key: "support", label: "Support & CSAT", desc: "Ticket volume, resolution mix, CSAT and time-to-resolution." },
];

const money = (n: unknown) => Number(n ?? 0);

async function requireStaff(): Promise<boolean> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  return role === "staff" || role === "admin";
}

export async function runReport(type: ReportType, fromDate: string, toDate: string): Promise<ReportResult> {
  if (!(await requireStaff())) return { title: "", columns: [], rows: [], error: "Staff access only." };

  // Normalize the window (inclusive). Defaults to the last 30 days.
  const now = new Date();
  const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : now;
  const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(now.getTime() - 30 * 86_400_000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const windowLabel = `${fromIso.slice(0, 10)} → ${toIso.slice(0, 10)}`;

  const supabase = getSupabaseServer();

  if (type === "trades") {
    const { data, error } = await supabase
      .from("trades")
      .select("ticket, symbol, side, lots, open_price, close_price, pnl, commission, swap, currency, status, opened_at, closed_at")
      .gte("opened_at", fromIso).lte("opened_at", toIso)
      .order("opened_at", { ascending: false }).limit(5000);
    if (error) return { title: "Trades", columns: [], rows: [], error: error.message };
    const rows = (data ?? []).map((t) => [
      t.ticket ?? "", t.symbol ?? "", t.side ?? "", Number(t.lots ?? 0), t.open_price ?? "", t.close_price ?? "",
      money(t.pnl), money(t.commission), money(t.swap), t.status ?? "",
      t.opened_at ? String(t.opened_at).slice(0, 19).replace("T", " ") : "",
      t.closed_at ? String(t.closed_at).slice(0, 19).replace("T", " ") : "",
    ]);
    return {
      title: "Trades", summary: `${rows.length} trade(s) · ${windowLabel}`,
      columns: ["Ticket", "Symbol", "Side", "Lots", "Open", "Close", "P&L", "Commission", "Swap", "Status", "Opened (UTC)", "Closed (UTC)"],
      rows,
    };
  }

  if (type === "revenue") {
    const { data, error } = await supabase
      .from("trades").select("lots, pnl, commission, swap, status")
      .gte("opened_at", fromIso).lte("opened_at", toIso).limit(20000);
    if (error) return { title: "Revenue summary", columns: [], rows: [], error: error.message };
    const t = data ?? [];
    const lots = t.reduce((a, r) => a + Number(r.lots ?? 0), 0);
    const commission = t.reduce((a, r) => a + money(r.commission), 0);
    const swap = t.reduce((a, r) => a + money(r.swap), 0);
    const clientPnl = t.reduce((a, r) => a + money(r.pnl), 0);
    const closed = t.filter((r) => r.status === "closed").length;
    return {
      title: "Revenue summary", summary: windowLabel,
      columns: ["Metric", "Value"],
      rows: [
        ["Trades", t.length],
        ["Closed trades", closed],
        ["Total volume (lots)", Number(lots.toFixed(2))],
        ["Commission income", Number(commission.toFixed(2))],
        ["Swap income", Number(swap.toFixed(2))],
        ["Client realized P&L", Number(clientPnl.toFixed(2))],
        ["Broker P&L (B-book proxy)", Number((-clientPnl).toFixed(2))],
      ],
    };
  }

  if (type === "ib") {
    const { data, error } = await supabase
      .from("commission_ledger")
      .select("ib_user_id, lots, amount, currency, settled, created_at")
      .gte("created_at", fromIso).lte("created_at", toIso)
      .order("created_at", { ascending: false }).limit(5000);
    if (error) return { title: "IB commissions", columns: [], rows: [], error: error.message };
    const rows = (data ?? []).map((r) => [
      r.ib_user_id ? String(r.ib_user_id).slice(0, 8) : "", Number(r.lots ?? 0), money(r.amount), r.currency ?? "",
      r.settled ? "settled" : "pending", r.created_at ? String(r.created_at).slice(0, 19).replace("T", " ") : "",
    ]);
    return {
      title: "IB commissions", summary: `${rows.length} line(s) · ${windowLabel}`,
      columns: ["IB (id)", "Lots", "Amount", "Currency", "Settled", "Created (UTC)"], rows,
    };
  }

  if (type === "funds") {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("type, amount, currency, status, gateway, created_at")
      .gte("created_at", fromIso).lte("created_at", toIso)
      .order("created_at", { ascending: false }).limit(5000);
    if (error) return { title: "Deposits & withdrawals", columns: [], rows: [], error: error.message };
    const rows = (data ?? []).map((r) => [
      r.type ?? "", money(r.amount), r.currency ?? "", r.status ?? "", r.gateway ?? "",
      r.created_at ? String(r.created_at).slice(0, 19).replace("T", " ") : "",
    ]);
    return {
      title: "Deposits & withdrawals", summary: `${rows.length} transaction(s) · ${windowLabel}`,
      columns: ["Type", "Amount", "Currency", "Status", "Gateway", "Created (UTC)"], rows,
    };
  }

  if (type === "support") {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("status, csat_score, resolution_code, created_at, resolved_at")
      .gte("created_at", fromIso).lte("created_at", toIso).limit(20000);
    if (error) return { title: "Support & CSAT", columns: [], rows: [], error: error.message };
    const t = data ?? [];
    const resolved = t.filter((r) => r.status === "resolved" || r.status === "closed");
    const rated = t.filter((r) => r.csat_score != null);
    const avgCsat = rated.length ? rated.reduce((a, r) => a + Number(r.csat_score ?? 0), 0) / rated.length : 0;
    const withRes = t.filter((r) => r.resolved_at);
    const avgHours = withRes.length
      ? withRes.reduce((a, r) => a + (new Date(r.resolved_at as string).getTime() - new Date(r.created_at).getTime()), 0) / withRes.length / 3_600_000
      : 0;
    // Resolution-code breakdown.
    const byCode = new Map<string, number>();
    for (const r of resolved) {
      const c = r.resolution_code ?? "(none)";
      byCode.set(c, (byCode.get(c) ?? 0) + 1);
    }
    const rows: (string | number)[][] = [
      ["Tickets created", t.length],
      ["Resolved / closed", resolved.length],
      ["CSAT responses", rated.length],
      ["Average CSAT (1-5)", rated.length ? Number(avgCsat.toFixed(2)) : "—"],
      ["Avg time to resolution (h)", withRes.length ? Number(avgHours.toFixed(1)) : "—"],
      ["—", "—"],
      ...[...byCode.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, n]) => [`Resolution · ${RESOLUTION_LABEL[code] ?? code}`, n] as (string | number)[]),
    ];
    return { title: "Support & CSAT", summary: windowLabel, columns: ["Metric", "Value"], rows };
  }

  // clients
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, country, kyc_status, status, created_at")
    .eq("role", "trader")
    .gte("created_at", fromIso).lte("created_at", toIso)
    .order("created_at", { ascending: false }).limit(5000);
  if (error) return { title: "Clients", columns: [], rows: [], error: error.message };
  const rows = (data ?? []).map((r) => [
    r.full_name ?? "", r.email ?? "", r.country ?? "", r.kyc_status ?? "not_started", r.status ?? "",
    r.created_at ? String(r.created_at).slice(0, 10) : "",
  ]);
  return {
    title: "Clients", summary: `${rows.length} registration(s) · ${windowLabel}`,
    columns: ["Name", "Email", "Country", "KYC", "Status", "Registered"], rows,
  };
}
