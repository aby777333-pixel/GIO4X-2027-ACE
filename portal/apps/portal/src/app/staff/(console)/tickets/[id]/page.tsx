import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { ArrowLeft, ShieldCheck, UserCircle2 } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase-server";
import { StaffTicketPanel } from "./ticket-panel";

type Status = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";

function statusTone(status: Status): StatusTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}

export const dynamic = "force-dynamic";

export default async function StaffTicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_ref, subject, status, priority, category, created_at, updated_at, user_id, assigned_staff, resolution_code, resolution_note, resolved_at, csat_score")
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket) return notFound();

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("id, body, is_staff_reply, created_at, author_id")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, email, country")
    .eq("id", ticket.user_id)
    .maybeSingle();

  const customerName = customer?.full_name?.trim() || customer?.email || "Customer";
  const status = ticket.status as Status;

  return (
    <>
      <Link
        href="/staff/tickets"
        className="mb-4 inline-flex items-center gap-1 text-xs text-steel hover:text-navy"
      >
        <ArrowLeft size={12} /> Back to tickets
      </Link>

      <PageHeader
        title={ticket.subject}
        subtitle={`${ticket.ticket_ref} · ${customerName} · ${ticket.category}`}
        actions={<StatusBadge tone={statusTone(status)}>{status.replace("_", " ")}</StatusBadge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {(messages ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-steel">No messages yet.</p>
            ) : (
              (messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={
                    m.is_staff_reply
                      ? "flex gap-3 rounded-xl border border-sky/20 bg-sky/5 p-4"
                      : "flex gap-3 rounded-xl border border-slate-100 p-4"
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sky">
                    {m.is_staff_reply ? <ShieldCheck size={16} /> : <UserCircle2 size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-steel">
                      <span className="font-semibold text-navy">
                        {m.is_staff_reply ? "GIO4X Support" : customerName}
                      </span>
                      <span>·</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-navy">{m.body}</div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <StaffTicketPanel
          ticketId={ticket.id}
          status={status}
          priority={ticket.priority as "low" | "normal" | "high" | "urgent"}
          assigned={!!ticket.assigned_staff}
          resolutionCode={ticket.resolution_code ?? ""}
          resolutionNote={ticket.resolution_note ?? ""}
          resolvedAt={ticket.resolved_at ?? null}
          csatScore={ticket.csat_score ?? null}
          customer={{
            name: customerName,
            email: customer?.email ?? null,
            country: customer?.country ?? null,
          }}
        />
      </div>
    </>
  );
}
