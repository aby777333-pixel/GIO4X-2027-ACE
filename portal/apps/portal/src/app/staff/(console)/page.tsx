import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getSupabaseServer } from "@/lib/supabase-server";
import { MessagesSquare, Ticket, Inbox, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const OPEN_TICKET_STATUSES = ["open", "in_progress", "waiting_customer"] as const;

export default async function StaffDashboard() {
  const supabase = getSupabaseServer();

  const [openChats, openTickets, unassigned, customers, recentTickets, activeChats] =
    await Promise.all([
      supabase
        .from("chat_conversations")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "active"]),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", OPEN_TICKET_STATUSES),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .is("assigned_staff", null)
        .in("status", OPEN_TICKET_STATUSES),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("support_tickets")
        .select("id, ticket_ref, subject, status, priority, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("chat_conversations")
        .select("id, subject, status, last_message_at")
        .in("status", ["open", "active"])
        .order("last_message_at", { ascending: false })
        .limit(6),
    ]);

  const tiles = [
    { label: "Live chats", value: String(openChats.count ?? 0), icon: <MessagesSquare size={16} />, href: "/staff/chats" },
    { label: "Open tickets", value: String(openTickets.count ?? 0), icon: <Ticket size={16} />, href: "/staff/tickets" },
    { label: "Unassigned", value: String(unassigned.count ?? 0), icon: <Inbox size={16} />, href: "/staff/tickets" },
    { label: "Customers", value: String(customers.count ?? 0), icon: <Users size={16} />, href: "/staff/customers" },
  ];

  return (
    <>
      <PageHeader title="Service Console" subtitle="Live chats, tickets and customers at a glance." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="block">
            <StatTile icon={t.icon} label={t.label} value={t.value} />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent tickets</CardTitle>
            <Link href="/staff/tickets" className="text-xs font-medium text-sky hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardBody className="space-y-2 pt-2">
            {(recentTickets.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-steel">No tickets yet.</p>
            ) : (
              (recentTickets.data ?? []).map((t) => (
                <Link
                  key={t.id}
                  href={`/staff/tickets/${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 transition hover:border-sky/30 hover:bg-sky/5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-navy">{t.subject}</div>
                    <div className="font-mono text-[11px] text-steel-light">{t.ticket_ref}</div>
                  </div>
                  <StatusBadge tone={ticketTone(t.status)}>{t.status.replace("_", " ")}</StatusBadge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active live chats</CardTitle>
            <Link href="/staff/chats" className="text-xs font-medium text-sky hover:underline">
              Open console →
            </Link>
          </CardHeader>
          <CardBody className="space-y-2 pt-2">
            {(activeChats.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-steel">No active chats right now.</p>
            ) : (
              (activeChats.data ?? []).map((c) => (
                <Link
                  key={c.id}
                  href={`/staff/chats?c=${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 transition hover:border-sky/30 hover:bg-sky/5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-navy">{c.subject}</div>
                    <div className="text-[11px] text-steel-light">
                      {new Date(c.last_message_at).toLocaleString()}
                    </div>
                  </div>
                  <StatusBadge tone={c.status === "active" ? "info" : "warning"}>{c.status}</StatusBadge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ticketTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}
