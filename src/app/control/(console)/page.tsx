import { controlMeta, firstParam, ROLE_LABEL } from "@/components/control/format";
import { LEAD_LIST_COLUMNS, type LeadListItem } from "@/components/control/LeadsTable";
import { TASK_COLUMNS, type TaskItem } from "@/components/control/TaskList";
import { OverviewView } from "@/components/control/views/OverviewView";
import { VIEW_OUTCOME_PARAM } from "@/components/control/views-shared";
import { LEAD_STAGES, LEAD_STATUSES } from "@/lib/server/constants";
import { readDesk } from "@/lib/server/personal";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { leadsFor } from "@/lib/server/tasks";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Overview", "/control");

const DAY_MS = 24 * 60 * 60 * 1000;

const NOTICES: Record<string, string> = {
  done: "Follow-up completed.",
  reopened: "Follow-up reopened.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
};

/**
 * What needs attention now. Every figure is a count of real rows read as the
 * signed-in member of staff; there are no targets or estimates. Each block is
 * read only if the person's role includes it.
 */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  const { supabase } = ctx;
  const params = await searchParams;
  const now = Date.now();
  const signedInAs = `Signed in as ${ctx.displayName} · ${ROLE_LABEL[ctx.role]}`;
  const notice = NOTICES[firstParam(params.notice)];
  const error = ERRORS[firstParam(params.error)];

  const seesLeads = can(ctx, "leads.read");
  const seesSubscribers = can(ctx, "subscribers.read");
  const managesStaff = can(ctx, "staff.manage");

  // "Your desk": started here so that it is read alongside the figures below, not after them. It never
  // throws, and it is drawn only for somebody whose role includes at least one thing it could show.
  const hasDesk = seesLeads || can(ctx, "tickets.read") || can(ctx, "chats.read") || can(ctx, "blog.read");
  const deskWork = hasDesk ? readDesk(ctx, now) : null;

  const [byStatus, byStage, unassigned, newest, due, subscribers, pendingStaff, names] = await Promise.all([
    seesLeads ? Promise.all(LEAD_STATUSES.map((status) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", status))) : null,
    seesLeads ? Promise.all(LEAD_STAGES.map((stage) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", stage).neq("status", "spam"))) : null,
    seesLeads ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new").is("assigned_to", null) : null,
    seesLeads ? supabase.from("leads").select(LEAD_LIST_COLUMNS).order("created_at", { ascending: false }).limit(8) : null,
    // my open follow-ups that are overdue or due within a day
    seesLeads
      ? supabase
          .from("lead_tasks")
          .select(TASK_COLUMNS, { count: "exact" })
          .eq("assigned_to", ctx.userId)
          .eq("done", false)
          .lte("due_at", new Date(now + DAY_MS).toISOString())
          .order("due_at", { ascending: true })
          .limit(8)
      : null,
    seesSubscribers ? supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null) : null,
    managesStaff ? supabase.from("staff_changes").select("id", { count: "exact", head: true }).eq("status", "pending").neq("requested_by", ctx.userId).neq("target", ctx.userId) : null,
    staffDirectory(supabase),
  ]);

  const failed =
    !!byStatus?.some((r) => r.error) || !!byStage?.some((r) => r.error) || !!unassigned?.error || !!newest?.error || !!due?.error || !!subscribers?.error || !!pendingStaff?.error;
  const tasks = (due?.data ?? []) as TaskItem[];

  return (
    <OverviewView
      signedInAs={signedInAs}
      failed={failed}
      notice={notice}
      error={error}
      leads={
        seesLeads
          ? {
              counts: LEAD_STATUSES.map((status, i) => ({ status, count: byStatus?.[i]?.count ?? 0 })),
              stages: LEAD_STAGES.map((stage, i) => ({ stage, count: byStage?.[i]?.count ?? 0 })),
              waitingForPickup: unassigned?.count ?? 0,
              newest: (newest?.data ?? []) as LeadListItem[],
              tasks,
              taskTotal: due?.count ?? 0,
              taskLeads: await leadsFor(supabase, tasks),
              canTask: can(ctx, "tasks.write"),
            }
          : null
      }
      subscriberCount={seesSubscribers ? (subscribers?.count ?? 0) : null}
      staffToDecide={managesStaff ? (pendingStaff?.count ?? 0) : null}
      names={names}
      me={ctx.userId}
      now={now}
      desk={await deskWork}
      deskOutcome={firstParam(params[VIEW_OUTCOME_PARAM])}
    />
  );
}
