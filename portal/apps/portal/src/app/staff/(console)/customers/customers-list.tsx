"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserCircle2 } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import type { CustomerRow } from "@/lib/customer-actions";

function kycTone(s: string): StatusTone {
  if (s === "approved" || s === "verified") return "success";
  if (s === "rejected") return "danger";
  if (s === "in_review" || s === "in_progress") return "warning";
  return "neutral";
}
function statusTone(s: string): StatusTone {
  if (s === "active") return "success";
  if (s === "suspended" || s === "closed") return "danger";
  return "warning";
}

const sel = "rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-navy";

export function CustomersList({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [kyc, setKyc] = useState("all");
  const [status, setStatus] = useState("all");

  const roles = useMemo(() => Array.from(new Set(customers.map((c) => c.role))).sort(), [customers]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (role !== "all" && c.role !== role) return false;
      if (kyc !== "all" && c.kyc_status !== kyc) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!needle) return true;
      return (
        (c.full_name ?? "").toLowerCase().includes(needle) ||
        (c.email ?? "").toLowerCase().includes(needle) ||
        (c.referral_code ?? "").toLowerCase().includes(needle) ||
        (c.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [customers, q, role, kyc, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-steel-light" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone or referral code…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select className={sel} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className={sel} value={kyc} onChange={(e) => setKyc(e.target.value)}>
          <option value="all">All KYC</option>
          <option value="not_started">not started</option>
          <option value="in_review">in review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="closed">closed</option>
          <option value="pending_verification">pending</option>
        </select>
      </div>

      <div className="text-[11px] text-steel-light">
        {filtered.length} of {customers.length} customers
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-steel">No customers match.</p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/staff/customers/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition hover:border-sky/40 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-steel">
                  <UserCircle2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-navy">
                    {c.full_name?.trim() || c.email || "Unnamed"}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-steel-light">
                    {c.email ? <span className="truncate">{c.email}</span> : null}
                    {c.country ? <><span>·</span><span>{c.country}</span></> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge tone="neutral">{c.role}</StatusBadge>
                <StatusBadge tone={statusTone(c.status)}>{c.status.replace("_", " ")}</StatusBadge>
                <StatusBadge tone={kycTone(c.kyc_status)}>{c.kyc_status.replace("_", " ")}</StatusBadge>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
