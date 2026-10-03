"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@gio4x/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ChipFilter } from "@/components/ChipFilter";
import {
  ArrowDownToLine,
  Award,
  CheckCircle,
  ChartLine,
  Info,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notification-actions";

type Kind = "account" | "kyc" | "funds" | "trade" | "ib" | "promo" | "system" | "security";

export type NotificationRow = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

const filters = ["All", "Unread", "Funds", "Trade", "KYC", "Promo", "IB", "Security"] as const;

const iconFor: Record<Kind, LucideIcon> = {
  trade: ChartLine,
  funds: ArrowDownToLine,
  kyc: CheckCircle,
  promo: Award,
  system: Info,
  ib: Users,
  account: Info,
  security: ShieldCheck,
};

const toneFor: Record<Kind, "success" | "info" | "warning" | "neutral"> = {
  trade: "success",
  funds: "info",
  kyc: "warning",
  promo: "warning",
  system: "neutral",
  ib: "info",
  account: "neutral",
  security: "warning",
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsList({ rows }: { rows: NotificationRow[] }) {
  const router = useRouter();
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const [, startTransition] = useTransition();

  const filtered = rows.filter((n) => {
    if (f === "All") return true;
    if (f === "Unread") return !n.read_at;
    return n.kind === (f.toLowerCase() as Kind);
  });
  const unread = rows.filter((n) => !n.read_at).length;

  function onMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  function onMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto text-xs text-steel">
          You have <span className="font-semibold text-navy">{unread}</span> unread notification
          {unread === 1 ? "" : "s"}.
        </div>
        <button
          onClick={onMarkAll}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40"
        >
          Mark all read
        </button>
        <ChipFilter options={filters} value={f} onChange={setF} />
      </div>

      <Card>
        <CardBody className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-steel">No notifications.</div>
          ) : (
            filtered.map((n) => {
              const Icon = iconFor[n.kind] ?? Info;
              const unread = !n.read_at;
              const body = (
                <div
                  key={n.id}
                  className={
                    unread
                      ? "flex items-start gap-3 rounded-lg border border-sky/20 bg-sky/5 p-4"
                      : "flex items-start gap-3 rounded-lg border border-slate-100 p-4"
                  }
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sky">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy">{n.title}</span>
                      <StatusBadge tone={toneFor[n.kind] ?? "neutral"}>{n.kind}</StatusBadge>
                      {unread ? <span className="h-2 w-2 rounded-full bg-sky" /> : null}
                    </div>
                    {n.body ? <p className="mt-0.5 text-sm text-steel">{n.body}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-steel-light">{timeAgo(n.created_at)}</span>
                    {unread ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onMarkRead(n.id);
                        }}
                        className="text-[10px] font-medium text-sky hover:underline"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => unread && onMarkRead(n.id)}
                  className="block"
                >
                  {body}
                </Link>
              ) : (
                body
              );
            })
          )}
        </CardBody>
      </Card>
    </>
  );
}
