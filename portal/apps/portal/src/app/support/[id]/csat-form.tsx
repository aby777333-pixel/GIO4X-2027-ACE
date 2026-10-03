"use client";

// §22 CSAT — the customer rates a resolved ticket 1–5. Writes to
// support_tickets.csat_score (RLS allows the owner on a closed ticket).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { submitCsat } from "@/lib/support-actions";

export function CsatForm({ ticketId, existing }: { ticketId: string; existing: number | null }) {
  const router = useRouter();
  const [score, setScore] = useState<number>(existing ?? 0);
  const [hover, setHover] = useState(0);
  const [done, setDone] = useState(existing != null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (value: number) => {
    setScore(value);
    start(async () => {
      const r = await submitCsat(ticketId, value);
      if (r.ok) { setDone(true); setError(null); router.refresh(); }
      else setError(r.error);
    });
  };

  const active = hover || score;

  return (
    <div className="text-center">
      <div className="text-sm font-semibold text-navy">
        {done ? "Thanks for your feedback!" : "How was our support?"}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending || done}
            onClick={() => submit(n)}
            onMouseEnter={() => !done && setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="p-1 disabled:cursor-default"
          >
            <Star
              size={26}
              className={n <= active ? "fill-amber-400 text-amber-400" : "text-slate-300"}
            />
          </button>
        ))}
      </div>
      {done && score > 0 ? (
        <p className="mt-1 text-[11px] text-steel">You rated this {score}/5.</p>
      ) : (
        <p className="mt-1 text-[11px] text-steel">Tap a star to rate this resolution.</p>
      )}
      {error ? <p className="mt-1 text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
