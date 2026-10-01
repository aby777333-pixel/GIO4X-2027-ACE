import type { ReactNode } from "react";
import type { Availability, Fact } from "@/data/platforms";

/**
 * The fourth state. A fact the owner has not confirmed is neither a tick nor
 * a cross: it is "Not yet published", drawn as a dashed outline so it can
 * never be mistaken for "available" or "not available" (shape + words, not
 * colour).
 */
export function NotPublished({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-8 text-xs font-medium text-ink-3 [&>span:first-child]:translate-y-px ${className}`}>
      <span aria-hidden className="h-13 w-13 shrink-0 rounded-xs border border-dashed border-ink-3" />
      <span>{children ?? "Not yet published"}</span>
    </span>
  );
}

const glyph: Record<Availability, { mark: string; label: string }> = {
  available: { mark: "✓", label: "Available" },
  different: { mark: "○", label: "Different implementation" },
  none: { mark: "—", label: "Not available" },
};

/** One symbol from the comparison legend, with its meaning available to assistive technology. */
export function StateMark({ state }: { state: Availability }) {
  const g = glyph[state];
  return (
    <span className="inline-flex h-21 w-21 shrink-0 items-center justify-center text-[0.9375rem] font-semibold leading-none text-ink">
      <span aria-hidden>{g.mark}</span>
      <span className="sr-only">{g.label}:</span>
    </span>
  );
}

/** A matrix cell: verified facts show their symbol and wording; unverified ones show the fourth state. */
export function FactCell({ fact }: { fact: Fact }) {
  if (fact.status === "unverified") {
    return (
      <span className="grid gap-3">
        <NotPublished />
        {fact.note && <span className="text-xs text-ink-3">{fact.note}</span>}
      </span>
    );
  }
  return (
    <span className="flex items-start gap-8">
      <StateMark state={fact.state} />
      <span className="text-sm text-ink-2">{fact.value}</span>
    </span>
  );
}

/** The legend used above every platform matrix. */
export function MatrixLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-21 gap-y-8 text-xs text-ink-2 ${className}`} aria-label="Legend">
      {(Object.keys(glyph) as Availability[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-5">
          <span aria-hidden className="inline-flex w-13 justify-center font-semibold text-ink">
            {glyph[k].mark}
          </span>
          {glyph[k].label}
        </li>
      ))}
      <li>
        <NotPublished className="!text-ink-2" />
      </li>
    </ul>
  );
}
