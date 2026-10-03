"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Mail, Globe } from "lucide-react";
import {
  staffReplyToTicket,
  setTicketStatus,
  setTicketPriority,
  assignTicketToMe,
  setTicketResolution,
} from "@/lib/staff-actions";
import { RESOLUTION_CODES } from "@/lib/ticket-constants";

type Status = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";

const STATUSES: Status[] = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export function StaffTicketPanel({
  ticketId,
  status,
  priority,
  assigned,
  resolutionCode,
  resolutionNote,
  resolvedAt,
  csatScore,
  customer,
}: {
  ticketId: string;
  status: Status;
  priority: Priority;
  assigned: boolean;
  resolutionCode: string;
  resolutionNote: string;
  resolvedAt: string | null;
  csatScore: number | null;
  customer: { name: string; email: string | null; country: string | null };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rCode, setRCode] = useState(resolutionCode);
  const [rNote, setRNote] = useState(resolutionNote);
  const [rSaved, setRSaved] = useState(false);
  const terminal = status === "resolved" || status === "closed";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  function onReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Reply cannot be empty.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await staffReplyToTicket(ticketId, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-navy">{customer.name}</div>
        {customer.email ? (
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-steel">
            <Mail size={12} /> {customer.email}
          </div>
        ) : null}
        {customer.country ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-steel">
            <Globe size={12} /> {customer.country}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Status
          </label>
          <select
            value={status}
            disabled={pending}
            onChange={(e) => run(() => setTicketStatus(ticketId, e.target.value as Status))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Priority
          </label>
          <select
            value={priority}
            disabled={pending}
            onChange={(e) => run(() => setTicketPriority(ticketId, e.target.value as Priority))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {!assigned ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => assignTicketToMe(ticketId))}
            className="w-full rounded-lg border border-sky/30 px-3 py-1.5 text-sm font-medium text-sky transition hover:bg-sky/5 disabled:opacity-50"
          >
            Assign to me
          </button>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-center text-[12px] text-steel">
            Assigned
          </div>
        )}
      </div>

      {terminal ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Resolution
          </label>
          <select
            value={rCode}
            disabled={pending}
            onChange={(e) => { setRCode(e.target.value); setRSaved(false); }}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">— select a resolution code —</option>
            {RESOLUTION_CODES.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={rNote}
            onChange={(e) => { setRNote(e.target.value); setRSaved(false); }}
            rows={2}
            placeholder="Resolution note (optional, internal)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(async () => { const r = await setTicketResolution(ticketId, rCode, rNote); if (r.ok) setRSaved(true); return r; })}
            className="w-full rounded-lg border border-sky/30 px-3 py-1.5 text-sm font-medium text-sky transition hover:bg-sky/5 disabled:opacity-50"
          >
            {rSaved ? "Saved ✓" : "Save resolution"}
          </button>
          {resolvedAt ? (
            <p className="text-[11px] text-steel">Resolved {new Date(resolvedAt).toLocaleString()}</p>
          ) : null}
          {csatScore != null ? (
            <p className="text-[11px] font-medium text-navy">Customer rating: {csatScore}/5 ★</p>
          ) : (
            <p className="text-[11px] text-steel">No customer rating yet.</p>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form onSubmit={onReply} className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
            Reply to customer
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Type your reply…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
          <Button variant="primary" type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      </div>
    </div>
  );
}
