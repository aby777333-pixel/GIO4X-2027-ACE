"use client";

import Link from "next/link";
import { useNow } from "@/hooks/useNow";
import { allCentreStatus, centres, formatDuration, fxOverview, SCHEDULE_NOTE, stateLabel, type CentreState } from "@/lib/sessions";

const stateClass: Record<CentreState, string> = {
  open: "state-open",
  pre: "state-pre",
  lunch: "state-pre",
  closed: "state-off",
};

/**
 * "Markets are open": the first data the visitor meets. A single quiet line of
 * the nine financial centres with their status and local time. On small
 * screens it becomes a horizontally scrollable rail (snap), not a stack.
 */
export function SessionStrip() {
  const now = useNow(20_000);
  const statuses = now ? allCentreStatus(now) : null;
  const fx = now ? fxOverview(now) : null;
  const openCount = statuses?.filter((s) => s.state === "open").length ?? 0;

  return (
    <section aria-label="Market sessions right now" className="hairline hairline-b bg-paper">
      <div className="wrap flex flex-col gap-13 py-13 lg:flex-row lg:items-center lg:gap-34">
        <div className="flex shrink-0 items-baseline gap-13 lg:w-[14.5rem] lg:flex-col lg:gap-3">
          <p className="label">Right now</p>
          <p className="text-sm font-medium text-ink" aria-live="polite">
            {!statuses
              ? "Reading your clock…"
              : fx?.overlap
                ? `${fx.overlap} overlap`
                : openCount > 0
                  ? `${openCount} of ${centres.length} centres open`
                  : fx?.weekOpen
                    ? "Between exchange sessions"
                    : "Weekend: markets closed"}
          </p>
        </div>
        <ul className="scroll-x -mx-[var(--gutter)] flex snap-x scroll-px-[var(--gutter)] gap-21 px-[var(--gutter)] lg:mx-0 lg:flex-1 lg:justify-between lg:gap-13 lg:px-0">
          {centres.map((c, i) => {
            const s = statuses?.[i];
            return (
              <li key={c.key} className="shrink-0 snap-start">
                <span className={`state ${s ? stateClass[s.state] : "state-off"}`}>{c.city}</span>
                <span className="num mt-2 block pl-[0.8125rem] text-xs text-ink-3">
                  {s ? (
                    <>
                      {s.local.label}
                      <span className="sr-only">
                        , {stateLabel[s.state]}, {formatDuration(s.nextChangeIn)} {s.nextLabel}
                      </span>
                    </>
                  ) : (
                    "--:--"
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/markets/clock" className="go shrink-0" title={SCHEDULE_NOTE}>
          Market clock
        </Link>
      </div>
    </section>
  );
}
