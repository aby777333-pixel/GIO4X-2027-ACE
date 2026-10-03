"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { createTask, completeTask } from "@/lib/crm-actions";
import { PRIORITIES, type Priority, type TaskStatus } from "@/lib/crm-constants";

export type LeadTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_at: string | null;
};

export function LeadTasks({ leadId, tasks }: { leadId: string; tasks: LeadTask[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createTask({
        title,
        lead_id: leadId,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      if (res.ok) {
        setTitle("");
        setDueAt("");
        setPriority("normal");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onComplete(taskId: string) {
    setError(null);
    startTransition(async () => {
      const res = await completeTask(taskId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const openTasks = tasks.filter((t) => t.status === "open");
  const doneTasks = tasks.filter((t) => t.status !== "open");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">Tasks</h3>

      <form onSubmit={onCreate} className="mb-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Follow up call…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-dark disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
      </form>

      <div className="space-y-1.5">
        {openTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="py-2 text-center text-xs text-steel-light">No tasks yet.</p>
        ) : null}

        {openTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-navy">{t.title}</div>
              <div className="text-[11px] text-steel-light">
                <span className="capitalize">{t.priority}</span>
                {t.due_at ? <span> · due {new Date(t.due_at).toLocaleString()}</span> : null}
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => onComplete(t.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check size={12} /> Done
            </button>
          </div>
        ))}

        {doneTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-steel-light"
          >
            <div className="truncate text-sm line-through">{t.title}</div>
            <span className="text-[11px] capitalize">{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
