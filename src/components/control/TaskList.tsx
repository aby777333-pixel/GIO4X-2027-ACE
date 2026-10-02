import Link from "next/link";
import { setTaskDone } from "@/app/control/actions";
import { Due } from "@/components/control/bits";
import { dueState, fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import type { LeadTaskRow } from "@/lib/supabase/types";

export type TaskItem = Pick<LeadTaskRow, "id" | "lead_id" | "title" | "due_at" | "assigned_to" | "done" | "done_at" | "done_by">;

export const TASK_COLUMNS = "id, lead_id, title, due_at, assigned_to, done, done_at, done_by";

/**
 * Follow-ups as rows: what, for which enquiry, when, whose, and one button.
 * `from` tells the action where to return to. `leads` maps a lead id to its
 * reference and name; it is omitted on the lead's own page.
 */
export function TaskList({
  tasks,
  leads,
  names,
  me,
  now,
  from,
  writable,
  label,
}: {
  tasks: TaskItem[];
  leads?: Map<string, { reference: string; name: string }>;
  names: Map<string, string>;
  me: string;
  now: number;
  from: "lead" | "tasks" | "overview";
  writable: boolean;
  label: string;
}) {
  const who = (userId: string | null) => (!userId ? "Nobody" : userId === me ? "You" : (names.get(userId) ?? "A member of staff"));
  return (
    <ul aria-label={label} className="border-t border-line">
      {tasks.map((task) => {
        const lead = leads?.get(task.lead_id);
        return (
          <li key={task.id} className="grid gap-x-21 gap-y-5 border-b border-line py-13 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className={`break-words text-sm ${task.done ? "text-ink-3 line-through" : "text-ink"}`}>{task.title}</p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-13 gap-y-2 text-xs text-ink-3">
                {leads && (
                  <Link href={`/control/leads/${task.lead_id}#tasks`} className="link num">
                    {lead ? lead.reference : "Open the enquiry"}
                  </Link>
                )}
                {lead && <span className="max-w-[14rem] truncate">{lead.name}</span>}
                {task.done ? (
                  <span>
                    Done by {task.done_by === me ? "you" : who(task.done_by)} · <span className="num">{fmtDateTime(task.done_at)}</span>
                  </span>
                ) : (
                  <Due iso={task.due_at} state={dueState(task.due_at, now)} />
                )}
                <span>{who(task.assigned_to)}</span>
              </p>
            </div>
            {writable && (
              <form action={setTaskDone}>
                <input type="hidden" name="task" value={task.id} />
                <input type="hidden" name="done" value={task.done ? "0" : "1"} />
                <input type="hidden" name="from" value={from} />
                <SubmitButton pending="Saving…" className="btn btn-ghost btn-sm">
                  {task.done ? "Reopen" : "Mark done"}
                </SubmitButton>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
