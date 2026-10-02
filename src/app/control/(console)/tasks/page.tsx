import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import type { TaskItem } from "@/components/control/TaskList";
import { TasksView } from "@/components/control/views/TasksView";
import { tasksFiltered } from "@/lib/server/lists/tasks";
import { readViews } from "@/lib/server/personal";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { leadsFor } from "@/lib/server/tasks";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Follow-ups", "/control/tasks");

const PER_PAGE = 50;

const NOTICES: Record<string, string> = {
  done: "Follow-up completed.",
  reopened: "Follow-up reopened.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.read")) return <NoAccess title="Follow-ups" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const who = firstParam(params.who) === "all" ? "all" : "mine";
  const show = firstParam(params.show) === "done" ? "done" : "open";
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  // the filters are applied in src/lib/server/lists/tasks.ts, which a saved view's count on the dashboard uses too
  let query = tasksFiltered(supabase, { who, show }, ctx.userId);
  query = show === "done" ? query.order("done_at", { ascending: false }) : query.order("due_at", { ascending: true });

  const [result, names, views] = await Promise.all([query.range((page - 1) * PER_PAGE, page * PER_PAGE - 1), staffDirectory(supabase), readViews(ctx, "tasks", params)]);
  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const tasks = (result.data ?? []) as TaskItem[];
  const total = result.count ?? 0;

  return (
    <TasksView
      who={who}
      show={show}
      tasks={tasks}
      leads={await leadsFor(supabase, tasks)}
      names={names}
      me={ctx.userId}
      now={Date.now()}
      writable={can(ctx, "tasks.write")}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PER_PAGE))}
      failed={failed}
      pastEnd={pastEnd}
      views={views}
      notice={NOTICES[firstParam(params.notice)]}
      error={ERRORS[firstParam(params.error)]}
    />
  );
}
