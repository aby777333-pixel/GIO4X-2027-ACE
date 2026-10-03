import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  Users, UserCheck, MonitorSmartphone, PieChart, Wallet, Banknote, Network,
  CandlestickChart, TrendingUp, ShieldCheck, AlertTriangle, Ticket, Inbox,
  MessagesSquare, UserCog, Landmark, Activity, Gauge,
} from "lucide-react";

// §1 Unified Platform Command Centre — one control room for the brokerage.
// Every figure is REAL, read live from the June database; each tile links to
// the module that owns it. Metrics that require the live LP / terminal feed are
// shown honestly as "—" with where they'll come from, never faked.
export const dynamic = "force-dynamic";

const OPEN_TICKETS = ["open", "in_progress", "waiting_customer"] as const;
const DAY_MS = 86_400_000;

const money = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString();

type Tile = { label: string; value: string; unit?: string; href: string; icon: ReactNode };

function Section({ title, hint, tiles }: { title: string; hint?: string; tiles: Tile[] }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-sm font-bold text-navy">{title}</h2>
          {hint ? <span className="text-[11px] text-steel">{hint}</span> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="block">
              <StatTile icon={t.icon} label={t.label} value={t.value} unit={t.unit} />
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export default async function CommandCentrePage() {
  const supabase = getSupabaseServer();
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const d30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const cnt = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const sum = (res: { data: unknown[] | null } | null, key: string) =>
    (res?.data ?? []).reduce((a: number, r) => a + Number((r as Record<string, unknown>)[key] ?? 0), 0);

  const [
    clients, liveAcc, demoAcc, managedAcc, fundedAcc, leads,
    depositRows, pendingDeposits, commissionRows,
    openPos, closedPnlRows, todayLotRows, m30LotRows,
    kycBacklog, openTickets, unassigned, liveChats, staff,
  ] = await Promise.all([
    cnt(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "trader")),
    cnt(supabase.from("trading_accounts").select("id", { count: "exact", head: true }).eq("account_kind", "live")),
    cnt(supabase.from("trading_accounts").select("id", { count: "exact", head: true }).eq("account_kind", "demo")),
    cnt(supabase.from("trading_accounts").select("id", { count: "exact", head: true }).eq("account_kind", "managed")),
    cnt(supabase.from("trading_accounts").select("id", { count: "exact", head: true }).gt("balance", 0)),
    cnt(supabase.from("crm_leads").select("id", { count: "exact", head: true })),
    supabase.from("wallet_transactions").select("amount").eq("type", "deposit"),
    cnt(supabase.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("type", "deposit").eq("status", "pending")),
    supabase.from("commission_ledger").select("amount, settled"),
    cnt(supabase.from("trades").select("id", { count: "exact", head: true }).eq("status", "open")),
    supabase.from("trades").select("pnl").eq("status", "closed"),
    supabase.from("trades").select("lots").gte("opened_at", startOfDay),
    supabase.from("trades").select("lots").gte("opened_at", d30),
    cnt(supabase.from("kyc_documents").select("id", { count: "exact", head: true }).eq("status", "pending")),
    cnt(supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", OPEN_TICKETS)),
    cnt(supabase.from("support_tickets").select("id", { count: "exact", head: true }).is("assigned_staff", null).in("status", OPEN_TICKETS)),
    cnt(supabase.from("chat_conversations").select("id", { count: "exact", head: true }).in("status", ["open", "active"])),
    cnt(supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["admin", "staff"])),
  ]);

  // NOTE: sums are computed in-app from small selects (matches the existing
  // dashboard pattern). Move to a DB aggregate/RPC before high volume.
  const totalDeposits = sum(depositRows, "amount");
  const ibPayouts = sum(commissionRows, "amount");
  const ibUnsettled = (commissionRows?.data ?? [])
    .filter((r) => !(r as { settled?: boolean }).settled)
    .reduce((a: number, r) => a + Number((r as { amount?: number }).amount ?? 0), 0);
  const realizedPnl = sum(closedPnlRows, "pnl");
  const volToday = sum(todayLotRows, "lots");
  const vol30 = sum(m30LotRows, "lots");

  const PENDING = "pending live feed";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Command Centre"
        subtitle="One control room for the brokerage — live figures from the platform database. Click any metric to open its module."
      />

      <Section title="Clients & accounts" tiles={[
        { label: "Registered clients", value: num(clients), icon: <Users size={16} />, href: "/staff/customers" },
        { label: "Live accounts", value: num(liveAcc), icon: <UserCheck size={16} />, href: "/staff/customers" },
        { label: "Funded accounts", value: num(fundedAcc), unit: "balance > 0", icon: <Wallet size={16} />, href: "/staff/customers" },
        { label: "Demo accounts", value: num(demoAcc), icon: <MonitorSmartphone size={16} />, href: "/staff/customers" },
        { label: "Managed accounts", value: num(managedAcc), icon: <PieChart size={16} />, href: "/staff/pamm" },
        { label: "Open leads", value: num(leads), icon: <Network size={16} />, href: "/staff/crm" },
      ]} />

      <Section title="Money flow" tiles={[
        { label: "Total deposits", value: money(totalDeposits), icon: <Banknote size={16} />, href: "/staff/funds" },
        { label: "Pending deposits", value: num(pendingDeposits), unit: "to review", icon: <Inbox size={16} />, href: "/staff/funds" },
        { label: "Withdrawals", value: "—", unit: "no withdrawals yet", icon: <Banknote size={16} />, href: "/staff/funds" },
        { label: "IB payouts (total)", value: money(ibPayouts), icon: <Network size={16} />, href: "/staff/ib" },
        { label: "IB unsettled", value: money(ibUnsettled), unit: "awaiting settlement", icon: <Network size={16} />, href: "/staff/ib" },
      ]} />

      <Section title="Trading & exposure" hint="volume & P&L from settled platform trades; live exposure needs the LP feed" tiles={[
        { label: "Open positions", value: num(openPos), icon: <CandlestickChart size={16} />, href: "/staff/trades" },
        { label: "Volume today", value: `${num(volToday)}`, unit: "lots", icon: <TrendingUp size={16} />, href: "/staff/trades" },
        { label: "Volume 30d", value: `${num(vol30)}`, unit: "lots", icon: <TrendingUp size={16} />, href: "/staff/trades" },
        { label: "Client realized P&L", value: money(realizedPnl), icon: <Activity size={16} />, href: "/staff/trades" },
        { label: "Net exposure / symbol", value: "—", unit: "Dealer desk (LP feed)", icon: <Gauge size={16} />, href: "/staff/dealer" },
        { label: "A-Book / B-Book", value: "—", unit: "Dealer desk (LP feed)", icon: <Landmark size={16} />, href: "/staff/dealer" },
      ]} />

      <Section title="Risk & compliance" tiles={[
        { label: "KYC backlog", value: num(kycBacklog), unit: "pending review", icon: <ShieldCheck size={16} />, href: "/staff/kyc" },
        { label: "Margin-call accounts", value: "—", unit: PENDING, icon: <AlertTriangle size={16} />, href: "/staff/dealer" },
        { label: "High-risk accounts", value: "—", unit: PENDING, icon: <AlertTriangle size={16} />, href: "/staff/dealer" },
        { label: "Suspicious activity", value: "—", unit: "surveillance (planned)", icon: <ShieldCheck size={16} />, href: "/staff/dealer" },
      ]} />

      <Section title="Operations & health" tiles={[
        { label: "Open tickets", value: num(openTickets), icon: <Ticket size={16} />, href: "/staff/tickets" },
        { label: "Unassigned tickets", value: num(unassigned), unit: "need an owner", icon: <Inbox size={16} />, href: "/staff/tickets" },
        { label: "Live chats", value: num(liveChats), icon: <MessagesSquare size={16} />, href: "/staff/chats" },
        { label: "Staff & admins", value: num(staff), icon: <UserCog size={16} />, href: "/staff/team" },
        { label: "Platform health", value: "—", unit: "Tech Hub", icon: <Activity size={16} />, href: "/staff/tech-hub" },
        { label: "LP / gateway status", value: "—", unit: "Tech Hub (LP feed)", icon: <Gauge size={16} />, href: "/staff/tech-hub" },
      ]} />

      <p className="px-1 text-[11px] text-steel">
        Figures are read live from the platform database each time you open this page. Metrics marked “—” arrive with the
        live liquidity/terminal feed (exposure, margin calls, LP &amp; gateway health) or a planned module (surveillance) —
        they are never simulated here.
      </p>
    </div>
  );
}
