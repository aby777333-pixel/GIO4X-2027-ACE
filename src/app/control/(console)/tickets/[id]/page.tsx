import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { MACRO_OPTION_COLUMNS, type MacroOption } from "@/components/control/ticket-tools";
import { TicketView } from "@/components/control/views/TicketView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Ticket", "/control/tickets");

/** Canned replies offered in the picker. A select longer than this would not be usable anyway. */
const MACRO_LIMIT = 200;

const NOTICES: Record<string, string> = {
  status: "Status updated.",
  priority: "Priority updated.",
  category: "Category updated.",
  assigned: "Assignment updated.",
  reply: "Reply saved. The customer will see it when they look up this request on the website.",
  note: "Internal note added. The customer cannot see it.",
  reply_set: "Reply saved, and the changes ticked with it were made. The customer will see the reply when they look up this request on the website.",
  escalated: "Escalated. The priority went up one step and the escalation is recorded with your name.",
  flagged: "Escalated. The ticket was already Urgent, so the priority is unchanged; the escalation is recorded with your name.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  body: "A reply or a note must be between 1 and 5,000 characters. Nothing was saved.",
  reply_only: "The reply was saved, but the changes ticked with it could not be made. Make them under Triage.",
  escalated_already: "This ticket has already been escalated. A ticket can be escalated once; nothing was changed.",
  not_late: "This ticket is not late against its reply target (it has been answered, is not open, or is still in time). Nothing was changed.",
};

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "tickets.read")) return <NoAccess title="Ticket" />;
  const { supabase } = ctx;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const writable = can(ctx, "tickets.write");
  const [ticketResult, messagesResult, auditResult, names, macrosResult] = await Promise.all([
    supabase.from("tickets").select("*").eq("id", id).maybeSingle(),
    supabase.from("ticket_messages").select("id, created_at, author_kind, author, internal, body").eq("ticket_id", id).order("created_at", { ascending: true }).limit(500),
    supabase.from("audit_log").select("id, at, actor, action, detail").eq("entity", "ticket").eq("entity_id", id).order("at", { ascending: false }).limit(50),
    staffDirectory(supabase),
    // Canned replies are for the reply form, so only someone who can reply
    // asks for them. A failure here (for example 0013 not applied yet) must
    // not take the ticket down with it: the form simply has no picker.
    writable ? supabase.from("ticket_macros").select(MACRO_OPTION_COLUMNS).eq("active", true).order("title", { ascending: true }).limit(MACRO_LIMIT) : null,
  ]);

  if (ticketResult.error) {
    return (
      <>
        <ControlHead title="This ticket could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/tickets" className="link">
              all tickets
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  const ticket = ticketResult.data;
  // Not found and not permitted look the same on purpose.
  if (!ticket) notFound();

  const sp = await searchParams;

  return (
    <TicketView
      ticket={ticket}
      messages={messagesResult.data ?? []}
      messagesFailed={!!messagesResult.error}
      audit={auditResult.data ?? []}
      auditFailed={!!auditResult.error}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      writable={writable}
      canAssign={writable && can(ctx, "leads.assign")}
      macros={(macrosResult?.data ?? []) as MacroOption[]}
      macrosFailed={!!macrosResult?.error}
      manage={can(ctx, "tickets.manage")}
      notice={NOTICES[firstParam(sp.notice)]}
      error={ERRORS[firstParam(sp.error)]}
    />
  );
}
