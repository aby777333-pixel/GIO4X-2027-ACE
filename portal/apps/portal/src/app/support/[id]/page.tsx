import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ShieldCheck, UserCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ReplyForm } from "./reply-form";
import { CsatForm } from "./csat-form";

type Status = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Shell title="Ticket">
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-steel">
          <Link href={`/auth/login?redirect=/support/${params.id}`} className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to view this ticket.
        </div>
      </Shell>
    );
  }

  const supabase = getSupabaseServer();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_ref, subject, status, priority, category, created_at, updated_at, user_id, csat_score")
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket || ticket.user_id !== user.id) return notFound();

  const { data: messages } = await supabase
    .from("ticket_messages")
    .select("id, body, is_staff_reply, created_at, author_id")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  const status = ticket.status as Status;
  const isClosed = status === "resolved" || status === "closed";

  return (
    <Shell title={`Ticket ${ticket.ticket_ref}`}>
      <Link
        href="/support"
        className="mb-4 inline-flex items-center gap-1 text-xs text-steel hover:text-navy"
      >
        <ArrowLeft size={12} /> Back to tickets
      </Link>

      <PageHeader
        title={ticket.subject}
        subtitle={`${ticket.ticket_ref} · ${ticket.category} · priority ${ticket.priority}`}
        actions={
          <StatusBadge
            tone={
              isClosed
                ? "success"
                : status === "in_progress"
                ? "info"
                : status === "waiting_customer"
                ? "warning"
                : "warning"
            }
          >
            {status.replace("_", " ")}
          </StatusBadge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {(messages ?? []).map((m) => (
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
                    {m.is_staff_reply ? "GIO4X Support" : "You"}
                  </span>
                  <span>·</span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-navy">{m.body}</div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {status === "closed" ? (
        <Card className="mt-4">
          <CardBody>
            <CsatForm ticketId={ticket.id} existing={ticket.csat_score ?? null} />
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardBody>
          <ReplyForm ticketId={ticket.id} disabled={isClosed} />
        </CardBody>
      </Card>
    </Shell>
  );
}
