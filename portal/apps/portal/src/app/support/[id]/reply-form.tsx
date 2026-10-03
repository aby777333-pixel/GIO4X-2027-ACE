"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { replyToTicket } from "@/lib/support-actions";

export function ReplyForm({ ticketId, disabled }: { ticketId: string; disabled?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Reply cannot be empty.");
      return;
    }
    startTransition(async () => {
      const res = await replyToTicket(ticketId, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-steel">
        This ticket is closed. Open a new ticket if you need more help.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Type your reply…"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
