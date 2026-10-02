import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { TaskList, type TaskItem } from "@/components/control/TaskList";

export type TasksViewProps = {
  who: "mine" | "all";
  show: "open" | "done";
  tasks: TaskItem[];
  leads: Map<string, { reference: string; name: string }>;
  names: Map<string, string>;
  me: string;
  now: number;
  writable: boolean;
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
  pastEnd: boolean;
  notice?: string;
  error?: string;
};

/** Presentation only. Open follow-ups are ordered by due time, so what is overdue is always at the top. */
export function TasksView({ who, show, tasks, leads, names, me, now, writable, total, page, pageCount, failed, pastEnd, notice, error }: TasksViewProps) {
  const href = (next: { who?: "mine" | "all"; show?: "open" | "done"; page?: number }) => {
    const sp = new URLSearchParams();
    const w = next.who ?? who;
    const s = next.show ?? show;
    if (w === "all") sp.set("who", "all");
    if (s === "done") sp.set("show", "done");
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const q = sp.toString();
    return q ? `/control/tasks?${q}` : "/control/tasks";
  };
  const tab = (current: boolean) =>
    `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

  return (
    <>
      <ControlHead eyebrow="Clients" title="Follow-ups" lead="What was promised, to whom, and by when. A follow-up is added on the enquiry it belongs to." />

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
      </div>

      <div className="mt-13 flex flex-wrap items-end justify-between gap-x-34 border-b border-line">
        <nav aria-label="Whose follow-ups" className="flex">
          <Link href={href({ who: "mine", page: 1 })} aria-current={who === "mine" ? "page" : undefined} className={tab(who === "mine")}>
            Mine
          </Link>
          <Link href={href({ who: "all", page: 1 })} aria-current={who === "all" ? "page" : undefined} className={tab(who === "all")}>
            Everyone’s
          </Link>
        </nav>
        <nav aria-label="Open or completed" className="flex">
          <Link href={href({ show: "open", page: 1 })} aria-current={show === "open" ? "page" : undefined} className={tab(show === "open")}>
            Open
          </Link>
          <Link href={href({ show: "done", page: 1 })} aria-current={show === "done" ? "page" : undefined} className={tab(show === "done")}>
            Completed
          </Link>
        </nav>
      </div>

      <div className="mt-13">
        {failed ? (
          <Notice title="The follow-ups could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : tasks.length ? (
          <TaskList tasks={tasks} leads={leads} names={names} me={me} now={now} from="tasks" writable={writable} label={show === "open" ? "Open follow-ups, soonest first" : "Completed follow-ups, newest first"} />
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href({ page: 1 })} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : show === "done" ? (
          <Empty title="Nothing completed yet" />
        ) : (
          <Empty title={who === "mine" ? "You have nothing to follow up" : "Nothing is waiting for anyone"}>
            <p>
              Open an enquiry in{" "}
              <Link href="/control/leads" className="link">
                Leads
              </Link>{" "}
              and add a follow-up there: one line, and a time.
            </p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "follow-up" : "follow-ups"} href={(p) => href({ page: p })} />}
    </>
  );
}
