"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Globe, ChevronDown, Search, ChartLine, Settings, LogOut, UserCircle2 } from "lucide-react";
import { LINKS } from "@/lib/constants";
import { useSession } from "@/lib/session-provider";
import { signOut } from "@/lib/auth-actions";

export function TopBar({ title, showDeposit = true }: { title: string; showDeposit?: boolean }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-semibold text-navy">{title}</h1>
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-light" />
          <input
            type="search"
            placeholder="Search accounts, trades, help..."
            className="w-72 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-sky/40 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-steel">
        {showDeposit ? (
          <Link
            href="/deposits"
            className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-light"
          >
            Deposit
          </Link>
        ) : null}
        <Link
          href={LINKS.raptor.terminal}
          target="_blank"
          rel="noreferrer"
          className="hidden md:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-navy hover:border-sky/40"
        >
          <ChartLine size={12} /> Open Raptor
        </Link>
        <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-slate-50">
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </Link>
        <button className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs hover:bg-slate-50">
          <Globe size={14} /> <span className="hidden sm:inline">EN</span>
        </button>

        <ProfileMenu open={profileOpen} setOpen={setProfileOpen} />
      </div>
    </header>
  );
}

function ProfileMenu({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { userId, email, profile } = useSession();
  const displayName = profile?.full_name?.trim() || email?.split("@")[0] || "Guest";
  const uidShort = userId ? userId.slice(0, 8) : "—";
  const roleLabel = profile?.role ? profile.role.toUpperCase() : "VISITOR";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "G";

  if (!userId) {
    return (
      <Link
        href="/auth/login"
        className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs hover:border-sky/40"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky to-navy text-[10px] font-bold text-white">
          {initials}
        </div>
        <span className="hidden text-navy sm:inline">{displayName}</span>
        <ChevronDown size={12} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-navy">{displayName}</div>
            <div className="text-[11px] text-steel">UID: {uidShort} · {roleLabel}</div>
            {email ? <div className="mt-0.5 truncate text-[10px] text-steel-light">{email}</div> : null}
          </div>
          <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-navy hover:bg-slate-50">
            <UserCircle2 size={14} /> Profile
          </Link>
          <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-navy hover:bg-slate-50">
            <Settings size={14} /> Settings
          </Link>
          <Link href="/security" className="flex items-center gap-2 px-4 py-2 text-sm text-navy hover:bg-slate-50">
            <Bell size={14} /> Security
          </Link>
          <form action={signOut} className="border-t border-slate-100">
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-slate-50"
            >
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
