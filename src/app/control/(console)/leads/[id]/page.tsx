import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { LEAD_LIST_COLUMNS, type LeadListItem } from "@/components/control/LeadsTable";
import { TASK_COLUMNS, type TaskItem } from "@/components/control/TaskList";
import { LeadView } from "@/components/control/views/LeadView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Lead", "/control/leads");

const NOTICES: Record<string, string> = {
  status: "Status updated.",
  assigned: "Assignment updated.",
  note: "Note added.",
  stage: "Stage updated.",
  task: "Follow-up added.",
  done: "Follow-up completed.",
  reopened: "Follow-up reopened.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  note: "A note must be between 1 and 4,000 characters.",
  reason: "Choose a reason when the stage is Lost. Nothing was changed.",
  task: "A follow-up needs a description of up to 200 characters.",
  due: "The due date must be a real date between today and three years from now.",
};

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.read")) return <NoAccess title="Lead" />;
  const { supabase } = ctx;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [leadResult, notesResult, auditResult, tasksResult, names] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_notes").select("id, author, body, created_at").eq("lead_id", id).order("created_at", { ascending: true }).limit(200),
    supabase.from("audit_log").select("id, at, actor, action, detail").eq("entity", "lead").eq("entity_id", id).order("at", { ascending: false }).limit(50),
    supabase.from("lead_tasks").select(TASK_COLUMNS).eq("lead_id", id).order("due_at", { ascending: true }).limit(200),
    staffDirectory(supabase),
  ]);

  if (leadResult.error) {
    return (
      <>
        <ControlHead eyebrow="Lead" title="This lead could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/leads" className="link">
              all leads
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  const lead = leadResult.data;
  // Not found and not permitted look the same on purpose.
  if (!lead) notFound();

  // the same person may have written before
  const relatedResult = await supabase.from("leads").select(LEAD_LIST_COLUMNS).eq("email", lead.email).neq("id", lead.id).order("created_at", { ascending: false }).limit(10);

  const sp = await searchParams;
  const notice = NOTICES[firstParam(sp.notice)];
  const error = ERRORS[firstParam(sp.error)];

  return (
    <LeadView
      lead={lead}
      notes={notesResult.data ?? []}
      notesFailed={!!notesResult.error}
      audit={auditResult.data ?? []}
      tasks={(tasksResult.data ?? []) as TaskItem[]}
      tasksFailed={!!tasksResult.error}
      related={(relatedResult.data ?? []) as LeadListItem[]}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      writable={can(ctx, "leads.write")}
      canAssign={can(ctx, "leads.assign")}
      canTask={can(ctx, "tasks.write")}
      notice={notice}
      error={error}
    />
  );
}
