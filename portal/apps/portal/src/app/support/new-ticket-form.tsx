"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Plus, X } from "lucide-react";
import { createSupportTicket } from "@/lib/support-actions";

type Category = "account" | "kyc" | "deposit" | "withdraw" | "trading" | "ib" | "technical" | "other";
type Priority = "low" | "normal" | "high" | "urgent";

const CATEGORIES: Category[] = ["account", "kyc", "deposit", "withdraw", "trading", "ib", "technical", "other"];
const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export function NewTicketForm({ signedIn, defaultCategory = "account" }: { signedIn: boolean; defaultCategory?: Category }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!signedIn) {
      setError("Sign in to open a ticket.");
      return;
    }
    startTransition(async () => {
      const res = await createSupportTicket({ subject, body, category, priority });
      if (res.ok) {
        setOpen(false);
        setSubject("");
        setBody("");
        router.refresh();
        if (res.id) router.push(`/support/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1" /> New ticket
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy">Open a new ticket</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-steel hover:bg-slate-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-steel">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="One-line summary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Describe what's happening, what you've tried, and the affected account number if any."
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy"
            >
              Cancel
            </button>
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
