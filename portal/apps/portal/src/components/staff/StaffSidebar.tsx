"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gauge,
  ScanSearch,
  FileBarChart,
  SlidersHorizontal,
  MessagesSquare,
  Ticket,
  Users,
  ShieldCheck,
  Contact,
  Receipt,
  BookOpen,
  Banknote,
  Network,
  Copy,
  PieChart,
  Radio,
  CandlestickChart,
  UserCog,
  FileText,
  Mail,
  Landmark,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@gio4x/ui";
import { staffSignOut } from "@/lib/staff-auth-actions";
import { canAccessSection } from "@/lib/staff-sections";
import { withBase } from "@/lib/base-path";

type Item = { key: string; label: string; href: string; icon: LucideIcon };

const nav: Item[] = [
  { key: "dashboard", label: "Dashboard", href: "/staff", icon: LayoutDashboard },
  { key: "command", label: "Command Centre", href: "/staff/command", icon: Gauge },
  { key: "chats", label: "Live Chats", href: "/staff/chats", icon: MessagesSquare },
  { key: "tickets", label: "Tickets", href: "/staff/tickets", icon: Ticket },
  { key: "crm", label: "Leads & CRM", href: "/staff/crm", icon: Contact },
  { key: "customers", label: "Customers", href: "/staff/customers", icon: Users },
  { key: "kyc", label: "KYC", href: "/staff/kyc", icon: ShieldCheck },
  { key: "compliance", label: "Compliance", href: "/staff/compliance", icon: ScanSearch },
  { key: "funds", label: "Funds & Settlement", href: "/staff/funds", icon: Banknote },
  { key: "fees", label: "Fee Engine", href: "/staff/fees", icon: Receipt },
  { key: "ib", label: "IB Network", href: "/staff/ib", icon: Network },
  { key: "copy", label: "Copy Trading", href: "/staff/copy", icon: Copy },
  { key: "pamm", label: "PAMM / MAM", href: "/staff/pamm", icon: PieChart },
  { key: "trades", label: "Trade Log", href: "/staff/trades", icon: CandlestickChart },
  { key: "reports", label: "Reporting Centre", href: "/staff/reports", icon: FileBarChart },
  { key: "broker", label: "Broker Controls", href: "/staff/broker", icon: Landmark },
  { key: "ledger", label: "General Ledger", href: "/staff/ledger", icon: BookOpen },
  { key: "events", label: "Event Bus", href: "/staff/events", icon: Radio },
  { key: "documents", label: "Document Builder", href: "/staff/documents", icon: FileText },
  { key: "emailer", label: "Bulk Emailer", href: "/staff/emailer", icon: Mail },
  { key: "config", label: "Configuration", href: "/staff/config", icon: SlidersHorizontal },
  { key: "team", label: "Team & Access", href: "/staff/team", icon: UserCog },
];

export function StaffSidebar({
  name,
  role,
  sections,
}: {
  name: string;
  role: string;
  sections: string[] | null;
}) {
  const pathname = usePathname();
  const visibleNav = nav.filter((item) => canAccessSection(item.key, role, sections));
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "S";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-navy text-white">
      <div className="px-5 pb-4 pt-6">
        <div className="rounded-lg bg-white/95 px-3 py-2">
          <Image src={withBase("/logo.png")} alt="GIO4X" width={2924} height={976} priority className="h-9 w-auto" />
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/60">
          Service Console
        </div>
      </div>

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky to-emerald-400 text-[11px] font-bold text-navy">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="text-[11px] uppercase tracking-wide text-white/60">{role}</div>
          </div>
        </div>
      </div>

      <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {visibleNav.map(({ label, href, icon: Icon }) => {
          const active = href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active ? "bg-white text-navy font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        <form action={staffSignOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-rose-300"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
