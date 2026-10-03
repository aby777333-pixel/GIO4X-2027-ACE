"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session-provider";
import { signOut } from "@/lib/auth-actions";
import {
  Home,
  ShieldCheck,
  Wallet,
  Users,
  PieChart,
  FileBarChart,
  Network,
  Link2,
  Megaphone,
  UserCircle2,
  LogOut,
  Briefcase,
  Star,
  Gift,
  Download,
  Wrench,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ChartLine,
  History,
  FileText,
  CreditCard,
  KeyRound,
  Bell,
  HelpCircle,
  Calendar,
  Settings,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@gio4x/ui";
import { withBase } from "@/lib/base-path";

type NavLeaf = {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: string;
};

type NavBranch = {
  label: string;
  icon: LucideIcon;
  badge?: string;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavBranch;

const isBranch = (item: NavItem): item is NavBranch =>
  (item as NavBranch).children !== undefined;

// ----- CLIENT NAV (mode = "client") -----
const clientNavMain: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Accounts", href: "/accounts", icon: Briefcase },
  { label: "Open Positions", href: "/positions", icon: ChartLine },
  { label: "Trade History", href: "/history", icon: History },
  {
    label: "Funds",
    icon: Wallet,
    children: [
      { label: "Wallet", href: "/wallet" },
      { label: "Deposit", href: "/deposits" },
      { label: "Withdrawal", href: "/withdrawals" },
      { label: "Transfer", href: "/transfers" },
      { label: "History", href: "/funds/history" },
      { label: "Statements", href: "/statements" },
      { label: "Payment methods", href: "/bank-accounts" },
    ],
  },
  { label: "GIO4X Trading", href: "/gio4x-trading", icon: Star, badge: "NEW" },
  {
    label: "GIO4X Copy",
    icon: Users,
    badge: "NEW",
    children: [
      { label: "Discover", href: "/copy/discover" },
      { label: "Copier", href: "/copy/copier" },
      { label: "Signal Provider", href: "/copy/signal-provider" },
    ],
  },
  { label: "PAMM", href: "/pamm", icon: PieChart },
];

const clientNavSecondary: NavItem[] = [
  { label: "Promotions", href: "/promotions", icon: Gift },
  // POINTS MALL temporarily removed from nav (page kept at /points for later use).
  { label: "Calendar & News", href: "/calendar", icon: Calendar },
  {
    label: "Tools",
    icon: Wrench,
    children: [
      { label: "CopyTrade", href: "/tools/copytrade" },
      { label: "GIO4X Matrix", href: "/tools/gio4x-matrix" },
      { label: "Notional Calculator", href: "/tools/notional-calc" },
    ],
  },
];

const clientNavAccount: NavItem[] = [
  { label: "Verification", href: "/verification", icon: ShieldCheck },
  { label: "Security", href: "/security", icon: KeyRound },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Downloads", href: "/downloads", icon: Download },
  { label: "Support", href: "/support", icon: HelpCircle },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Profile", href: "/profile", icon: UserCircle2 },
];

// ----- IB NAV (mode = "ib") -----
const ibNavMain: NavItem[] = [
  { label: "Dashboard", href: "/ib", icon: LayoutDashboard },
  { label: "IB Report", href: "/ib/report", icon: FileBarChart },
  { label: "Multi-Level IB", href: "/ib/tree", icon: Network },
  { label: "Account Report", href: "/ib/accounts", icon: Briefcase },
  { label: "Client Report", href: "/ib/clients", icon: Users },
  { label: "Sub-IB Management", href: "/ib/sub-ibs", icon: Network },
];

const ibNavSecondary: NavItem[] = [
  { label: "Funds", href: "/ib/funds", icon: Wallet },
  { label: "Referral Links", href: "/ib/referrals", icon: Link2 },
  { label: "Campaign Links", href: "/ib/campaigns", icon: Megaphone },
  { label: "Marketing Materials", href: "/ib/materials", icon: ImageIcon },
];

const ibNavAccount: NavItem[] = [
  { label: "IB Profile", href: "/ib/profile", icon: UserCircle2 },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Support", href: "/ib/support", icon: HelpCircle },
];

function NavBranchItem({ branch, pathname }: { branch: NavBranch; pathname: string }) {
  const hasActiveChild = branch.children.some((c) => pathname === c.href);
  const [open, setOpen] = useState(hasActiveChild);
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const Icon = branch.icon;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
          hasActiveChild ? "font-semibold text-navy" : "text-steel hover:bg-slate-50 hover:text-navy",
        )}
      >
        <Icon size={16} />
        <span className="flex-1 text-left">{branch.label}</span>
        {branch.badge ? (
          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
            {branch.badge}
          </span>
        ) : null}
        <Chevron size={14} className="text-steel-light" />
      </button>
      {open ? (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-slate-100 pl-3">
          {branch.children.map((leaf) => {
            const active = pathname === leaf.href;
            return (
              <Link
                key={leaf.href}
                href={leaf.href}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-xs transition",
                  active
                    ? "bg-sky/10 font-semibold text-sky"
                    : "text-steel hover:bg-slate-50 hover:text-navy",
                )}
              >
                {leaf.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavLeafItem({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) {
  const Icon = leaf.icon;
  const active = pathname === leaf.href;
  return (
    <Link
      href={leaf.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active ? "bg-sky/10 font-semibold text-sky" : "text-steel hover:bg-slate-50 hover:text-navy",
      )}
    >
      {Icon ? <Icon size={16} /> : null}
      <span className="flex-1">{leaf.label}</span>
      {leaf.badge ? (
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
          {leaf.badge}
        </span>
      ) : null}
    </Link>
  );
}

function Section({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="space-y-0.5">
      <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-steel-light">
        {title}
      </div>
      {items.map((item) =>
        isBranch(item) ? (
          <NavBranchItem key={item.label} branch={item} pathname={pathname} />
        ) : (
          <NavLeafItem key={item.href} leaf={item} pathname={pathname} />
        ),
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isIbRoute = pathname.startsWith("/ib");
  const [mode, setMode] = useState<"client" | "ib">(isIbRoute ? "ib" : "client");
  const { userId, profile, email } = useSession();

  useEffect(() => {
    setMode(isIbRoute ? "ib" : "client");
  }, [isIbRoute]);

  const homeHref = mode === "ib" ? "/ib" : "/";
  const displayName = profile?.full_name?.trim() || email?.split("@")[0] || "Guest";
  const uidShort = userId ? userId.slice(0, 8) : "—";
  const roleLabel = profile?.role ? profile.role.toUpperCase() : "VISITOR";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "G";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link href={homeHref} className="block px-5 pb-4 pt-6" aria-label="GIO4X home">
        <Image
          src={withBase("/logo.png")}
          alt="GIO4X"
          width={2924}
          height={976}
          priority
          // Larger lockup so the brand is the visual anchor of the sidebar.
          className="h-14 w-auto"
        />
        <div className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-steel">
          {mode === "ib" ? "IB Portal" : "Client Area"}
        </div>
      </Link>

      <div className="px-5">
        <Link
          href={userId ? "/profile" : "/auth/login"}
          className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky/30"
          aria-label={userId ? "Open profile" : "Sign in"}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky to-navy text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="leading-tight min-w-0">
            <div className="truncate text-sm font-semibold text-navy">{displayName}</div>
            <div className="text-[11px] text-steel">
              {userId ? `UID: ${uidShort} · ${roleLabel}` : "Not signed in"}
            </div>
          </div>
        </Link>

        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 text-xs font-medium">
          <Link
            href="/"
            onClick={() => setMode("client")}
            className={cn(
              "py-1.5 text-center transition",
              mode === "client" ? "bg-navy text-white" : "bg-white text-steel hover:bg-slate-50",
            )}
          >
            Client
          </Link>
          <Link
            href="/ib"
            onClick={() => setMode("ib")}
            className={cn(
              "py-1.5 text-center transition",
              mode === "ib" ? "bg-sky text-white" : "bg-white text-steel hover:bg-slate-50",
            )}
          >
            IB
          </Link>
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
        {mode === "client" ? (
          <>
            <Section title="Trading" items={clientNavMain} pathname={pathname} />
            <Section title="Engage" items={clientNavSecondary} pathname={pathname} />
            <Section title="Account" items={clientNavAccount} pathname={pathname} />
          </>
        ) : (
          <>
            <Section title="Performance" items={ibNavMain} pathname={pathname} />
            <Section title="Grow" items={ibNavSecondary} pathname={pathname} />
            <Section title="Account" items={ibNavAccount} pathname={pathname} />
          </>
        )}

        {userId ? (
          <form action={signOut} className="mt-4">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-steel transition hover:bg-slate-50 hover:text-danger"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </form>
        ) : (
          <Link
            href={`/auth/login${pathname && pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : ""}`}
            className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-steel transition hover:bg-slate-50 hover:text-sky"
          >
            <LogOut size={16} />
            <span>Sign in</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-steel-light">
        <Link
          href="https://lustrous-youtiao-52c8ea.netlify.app"
          target="_blank"
          rel="noreferrer"
          className="hover:text-sky"
        >
          gio4x.com →
        </Link>{" "}
        ·{" "}
        <Link
          href="https://dashing-hamster-0028ed.netlify.app/terminal"
          target="_blank"
          rel="noreferrer"
          className="hover:text-sky"
        >
          Trading terminal →
        </Link>
      </div>
    </aside>
  );
}
