"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Laptop } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { revokeDeviceSession } from "@/lib/security-actions";

export type SessionRow = {
  id: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_seen_at: string;
  revoked_at: string | null;
};

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function DeviceSessionRow({ s }: { s: SessionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRevoke() {
    startTransition(async () => {
      await revokeDeviceSession(s.id);
      router.refresh();
    });
  }

  const label = s.device_label ?? s.user_agent ?? "Unknown device";
  const revoked = !!s.revoked_at;

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
      <div className="flex items-center gap-3">
        <Laptop size={16} className="text-steel" />
        <div className="min-w-0">
          <div className="truncate text-navy">{label}</div>
          <div className="text-[11px] text-steel">
            {s.ip_address ? `${s.ip_address} · ` : ""}
            {revoked ? "Revoked" : `Last seen ${relative(s.last_seen_at)}`}
          </div>
        </div>
      </div>
      {revoked ? (
        <StatusBadge tone="neutral">Revoked</StatusBadge>
      ) : (
        <button
          onClick={onRevoke}
          disabled={pending}
          className="text-xs text-rose-600 hover:underline disabled:opacity-60"
        >
          {pending ? "Revoking…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
