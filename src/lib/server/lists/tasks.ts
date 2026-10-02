/**
 * The Follow-ups list's filters, in one place: the list screen
 * (/control/tasks) and a saved view pinned to the dashboard build their query
 * here, so a pinned view's count can never mean something different from the
 * list it opens.
 */
import { TASK_COLUMNS } from "@/components/control/TaskList";
import { viewParamsFrom, type ViewParams } from "@/components/control/views-shared";
import type { Db } from "@/lib/supabase/server";

export type TaskFilters = { who: "mine" | "all"; show: "open" | "done" };

/**
 * `lead_tasks` with the filters applied, read as the signed-in member of
 * staff. The caller adds the order and the range. With `head` the database
 * returns the count and no rows.
 */
export function tasksFiltered(supabase: Db, f: TaskFilters, me: string, head = false) {
  let query = supabase.from("lead_tasks").select(TASK_COLUMNS, { count: "exact", head }).eq("done", f.show === "done");
  if (f.who === "mine") query = query.eq("assigned_to", me);
  return query;
}

/** How many follow-ups a saved view matches now. Null when it could not be counted. */
export async function countTasksView(supabase: Db, stored: ViewParams, me: string): Promise<number | null> {
  const p = viewParamsFrom("tasks", stored);
  const { count, error } = await tasksFiltered(supabase, { who: p.who === "all" ? "all" : "mine", show: p.show === "done" ? "done" : "open" }, me, true);
  return error || count === null ? null : count;
}
