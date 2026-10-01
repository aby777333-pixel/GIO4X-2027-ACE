"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useNow } from "@/hooks/useNow";
import { fxOverview, fxSessionOpen, fxSessions, localTime, SCHEDULE_NOTE, windowInUtc } from "@/lib/sessions";

export type Depth = "quick" | "standard" | "deep";
const DEPTHS: { key: Depth; label: string; line: string }[] = [
  { key: "quick", label: "Quick", line: "The headline of each module. About a minute." },
  { key: "standard", label: "Standard", line: "Each module with its context." },
  { key: "deep", label: "Deep", line: "Everything, including sources and method." },
];
const STORE = "gx:morning-depth";

/**
 * Depth control for the Morning Room. The modules are the same at every
 * depth; elements marked `data-show="standard"` or `data-show="deep"` are
 * simply hidden below that depth (see knowledge.css). The choice is kept on
 * this device only.
 */
export function DepthRoom({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState<Depth>("standard");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE);
      if (saved === "quick" || saved === "standard" || saved === "deep") setDepth(saved);
    } catch {
      // storage unavailable: the default depth stands
    }
  }, []);

  const choose = (d: Depth) => {
    setDepth(d);
    try {
      window.localStorage.setItem(STORE, d);
    } catch {
      // not persisted, still applied
    }
  };
  const current = DEPTHS.find((d) => d.key === depth) ?? DEPTHS[1];

  return (
    <div data-depth={depth}>
      <div className="no-print hairline-b bg-paper">
        <div className="wrap flex flex-wrap items-center gap-x-21 gap-y-8 py-13">
          <span className="label" id="depth-label">
            Depth
          </span>
          <div className="seg" role="group" aria-labelledby="depth-label">
            {DEPTHS.map((d) => (
              <button key={d.key} type="button" aria-pressed={depth === d.key} onClick={() => choose(d.key)} className="!h-[2.75rem] sm:!h-[2.125rem]">
                {d.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-ink-3" aria-live="polite">
            {current.line}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

const hhmm = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * The four conventional FX sessions, shown in the visitor's own time.
 * A schedule computed from the device clock, not a data feed.
 */
export function FxSessionsToday() {
  const now = useNow(30_000);
  const overview = now ? fxOverview(now) : null;
  // minutes the visitor's clock is ahead of UTC
  const offset = now ? -now.getTimezoneOffset() : 0;

  return (
    <div>
      <p className="h4" aria-live="polite">
        {!now || !overview ? "Reading your clock…" : !overview.weekOpen ? "The FX week is closed. It reopens on Sunday at 17:00 New York time." : overview.overlap ? `${overview.overlap}: two sessions overlap now.` : overview.open.length ? `The ${overview.open[0].name} session is open.` : "Between sessions."}
      </p>
      <div className="scroll-x mt-13" data-show="standard">
        <table className="table-gx sm:min-w-[30rem]">
          <caption className="sr-only">Conventional foreign-exchange session hours, in the session’s own time and in your local time</caption>
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Local hours</th>
              <th scope="col">In your time</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            {fxSessions.map((s) => {
              const w = now ? windowInUtc(s.tz, s.open, s.close, now) : null;
              const open = now ? fxSessionOpen(s, now) : false;
              return (
                <tr key={s.key}>
                  <th scope="row" className="!border-line !text-[0.9375rem] !font-medium !normal-case !tracking-normal !text-ink">
                    {s.name}
                  </th>
                  <td className="num text-sm text-ink-2">
                    {hhmm(s.open)}–{hhmm(s.close)}
                    {now && <span className="ml-8 hidden text-xs text-ink-3 sm:inline">now {localTime(now, s.tz).label}</span>}
                  </td>
                  <td className="num text-sm">{w ? `${hhmm(w.start + offset)}–${hhmm(w.end + offset)}` : "--:--"}</td>
                  <td>
                    <span className={`state ${open ? "state-open" : "state-off"}`}>{!now ? "…" : open ? "Open" : "Closed"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-13 max-w-measure text-xs text-ink-3" data-show="deep">
        Session windows are conventions (08:00 to 17:00 in each centre; Tokyo 09:00 to 18:00), not exchange timetables: foreign exchange trades continuously from Monday morning in Sydney to Friday 17:00 in New York. {SCHEDULE_NOTE}
      </p>
    </div>
  );
}
