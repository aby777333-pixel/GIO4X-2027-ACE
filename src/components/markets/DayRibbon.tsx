"use client";

import { useEffect, useMemo, useRef } from "react";
import { DataNote } from "@/components/ui/Page";
import { useNow } from "@/hooks/useNow";
import { centres, centreStatus, fxSessionOpen, fxSessions, fxWeekOpen, SCHEDULE_NOTE, stateLabel, windowInUtc, type CentreState } from "@/lib/sessions";
import { hhmm, intersect, offsetLabel, splitDay, utcMinutes, wrapDay, zoneId, zoneMeta, zoneOffset, type Seg } from "./time";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pct = (m: number) => `${(m / 1440) * 100}%`;

const stateClass: Record<CentreState, string> = { open: "state-open", pre: "state-pre", lunch: "state-pre", closed: "state-off" };

type Row = { key: string; name: string; sub?: string; segs: Seg[]; span?: Seg[]; open: boolean; state?: CentreState; text: string };
type Overlap = { key: string; label: string; segs: Seg[]; live: boolean };

function Bar({ seg, className }: { seg: Seg; className: string }) {
  return <span className={`absolute top-1/2 -translate-y-1/2 ${className}`} style={{ left: pct(seg[0]), width: pct(seg[1] - seg[0]) }} />;
}

/**
 * THE MARKET DAY RIBBON
 *
 * One regular weekday laid out on a 24-hour axis: the four conventional FX
 * session windows, the hours in which two of them overlap (emphasised and
 * named), and the regular trading hours of nine exchanges as thin bars. A
 * marker shows the present moment.
 *
 * The windows are fixed in each centre's own local time, so their position on
 * the axis depends on daylight saving at the visitor's date: the ribbon is
 * therefore filled in on the client. The server renders the empty frame.
 */
export function DayRibbon({ zone = "UTC", id = "day-ribbon" }: { zone?: string; id?: string }) {
  const now = useNow(30_000);
  const scroller = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
  const meta = zoneMeta(zone);

  const model = useMemo(() => {
    if (!now) return null;
    const tz = zoneId(zone);
    const off = zoneOffset(now, tz);
    const place = (tzLocal: string, open: number, close: number): Seg[] => {
      const w = windowInUtc(tzLocal, open, close, now);
      return splitDay(wrapDay(w.start + off), wrapDay(w.end + off));
    };
    const describe = (segs: Seg[]) => {
      if (!segs.length) return "";
      const start = segs[0][0];
      const end = segs[segs.length - 1][1];
      return `${hhmm(start)} to ${hhmm(end)}`;
    };

    const fx: Row[] = fxSessions.map((s) => {
      const segs = place(s.tz, s.open, s.close);
      const open = fxWeekOpen(now) && fxSessionOpen(s, now);
      return { key: s.key, name: s.name, segs, open, text: `${s.name} FX session: ${describe(segs)}${open ? ", open now" : ""}` };
    });

    const overlaps: Overlap[] = [];
    for (let a = 0; a < fx.length; a++)
      for (let b = a + 1; b < fx.length; b++) {
        const segs = intersect(fx[a].segs, fx[b].segs);
        if (!segs.length) continue;
        // name the overlap in the order the trading day meets it
        const first = fxSessions[a].key === "sydney" && fxSessions[b].key === "new-york" ? [fx[b], fx[a]] : [fx[a], fx[b]];
        overlaps.push({ key: `${fx[a].key}-${fx[b].key}`, label: `${first[0].name} × ${first[1].name}`, segs, live: fx[a].open && fx[b].open });
      }

    const venues: Row[] = centres.map((c) => {
      const st = centreStatus(c, now);
      const span = place(c.tz, c.open, c.close);
      const segs = c.lunch ? [...place(c.tz, c.open, c.lunch[0]), ...place(c.tz, c.lunch[1], c.close)] : span;
      return {
        key: c.key,
        name: c.city,
        sub: c.venue,
        segs,
        span,
        open: st.state === "open",
        state: st.state,
        text: `${c.city}, ${c.venue}: ${describe(span)}${c.lunch ? ", with a midday break" : ""}. ${stateLabel[st.state]} now`,
      };
    });

    const nowAt = wrapDay(utcMinutes(now) + off);
    return { fx, overlaps, venues, nowAt, off, weekOpen: fxWeekOpen(now) };
  }, [now, zone]);

  // On narrow screens the ribbon scrolls inside its own container: bring "now" into view once.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !model || centred.current) return;
    centred.current = true;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const labelCol = 162;
    const track = el.scrollWidth - labelCol;
    el.scrollLeft = Math.max(0, labelCol + (model.nowAt / 1440) * track - el.clientWidth * 0.618);
  }, [model]);

  const liveOverlap = model?.overlaps.find((o) => o.live);
  const axisName = model ? (zone === "UTC" ? "UTC" : `${meta.long} (${offsetLabel(model.off)})`) : meta.long;

  // the label column stays put while the day scrolls beneath it; each cell fills its row so nothing shows through
  const labelBase = "sticky left-0 z-2 box-content flex w-[8.5rem] shrink-0 self-stretch bg-paper pl-13 pr-13 sm:pl-21";
  const label = `${labelBase} items-center`;
  const track = "relative flex-1";

  return (
    <figure className="panel-quiet" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 border-b border-line px-13 py-13 sm:px-21">
        <span className="label">One regular weekday · axis in {axisName}</span>
        <span className="num text-sm text-ink-2" aria-live="polite">
          {model ? (
            <>
              <span className="font-medium text-ink">{hhmm(model.nowAt)}</span> now
              {" · "}
              {!model.weekOpen ? "Weekend: the FX week is closed" : liveOverlap ? `${liveOverlap.label} overlap` : model.fx.some((r) => r.open) ? `${model.fx.filter((r) => r.open).map((r) => r.name).join(", ")} session` : "Between sessions"}
            </>
          ) : (
            "Reading your clock…"
          )}
        </span>
      </figcaption>

      <div ref={scroller} className="scroll-x" tabIndex={0} role="group" aria-label="Market day timeline. Scrolls horizontally on small screens.">
        <div className="relative min-w-[47rem] pb-13 pr-13 pt-8 sm:pr-21" aria-hidden>
          {/* the vertical structure: hour lines and the present moment */}
          <div className="pointer-events-none absolute inset-y-0 left-[calc(8.5rem+1.625rem)] right-13 sm:left-[calc(8.5rem+2.125rem)] sm:right-21">
            {HOURS.filter((h) => h % 3 === 0).map((h) => (
              <span key={h} className="absolute bottom-13 top-[2.75rem] w-px bg-line" style={{ left: pct(h * 60) }} />
            ))}
            <span className="absolute bottom-13 top-[2.75rem] right-0 w-px bg-line" />
            {model?.overlaps.flatMap((o) =>
              o.segs.map((s, i) => (
                <span
                  key={`${o.key}-${i}`}
                  className="absolute top-[4.875rem] h-[7.125rem] border-x border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
                  style={{ left: pct(s[0]), width: pct(s[1] - s[0]) }}
                />
              )),
            )}
          </div>

          {/* hour scale */}
          <div className="flex h-[2.75rem]">
            <span className={label} />
            <span className={`${track} mb-5 h-13 self-end`}>
              {HOURS.map((h) => (
                <span key={h} className="absolute bottom-0" style={{ left: pct(h * 60) }}>
                  {h % 3 === 0 ? <span className="num block pl-3 text-[0.6875rem] font-medium leading-none text-ink-3">{String(h).padStart(2, "0")}</span> : <span className="block h-3 w-px bg-line-strong" />}
                </span>
              ))}
            </span>
          </div>

          {/* FX sessions */}
          <div className="flex h-[1.625rem] items-center">
            <span className={`${label} label`}>FX sessions</span>
            <span className={track} />
          </div>
          {(model?.fx ?? fxSessions.map((s) => ({ key: s.key, name: s.name, segs: [] as Seg[], open: false }))).map((r) => (
            <div key={r.key} className="flex h-[1.625rem] items-center">
              <span className={label}>
                <span className={`state ${r.open ? "state-open" : "state-off"}`}>{r.name}</span>
              </span>
              <span className={`${track} h-full`}>
                {r.segs.map((s, i) => (
                  <Bar key={i} seg={s} className={`h-[0.8125rem] rounded-xs ${r.open ? "bg-ink" : "bg-[color-mix(in_srgb,var(--ink)_38%,transparent)]"}`} />
                ))}
              </span>
            </div>
          ))}
          <div className="flex h-[2.75rem]">
            <span className={`${labelBase} items-start pt-3`}>
              <span className={`state ${liveOverlap ? "state-overlap" : "state-off"}`}>Overlaps</span>
            </span>
            <span className={`${track} mt-5`}>
              {model?.overlaps.map((o) => {
                const longest = o.segs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
                return o.segs.map((s, i) => (
                  <span key={`${o.key}-${i}`} className="absolute top-0" style={{ left: pct(s[0]), width: pct(s[1] - s[0]) }}>
                    <span className="block h-[0.3125rem] bg-accent" />
                    {s === longest && (
                      <span className={`absolute top-8 whitespace-nowrap text-[0.6875rem] font-semibold tracking-[0.04em] ${o.live ? "text-accent" : "text-ink-2"} ${s[0] > 1150 ? "right-0" : "left-0"}`}>{o.label}</span>
                    )}
                  </span>
                ));
              })}
            </span>
          </div>

          {/* exchanges */}
          <div className="flex h-[2.125rem] border-t border-line">
            <span className={`${labelBase} label items-end pb-5`}>Exchanges</span>
            <span className={track} />
          </div>
          {(model?.venues ?? centres.map((c) => ({ key: c.key, name: c.city, sub: c.venue, segs: [] as Seg[], span: [] as Seg[], open: false, state: undefined }))).map((r) => (
            <div key={r.key} className="flex h-[1.3125rem] items-center">
              <span className={label}>
                <span className={`state ${r.state ? stateClass[r.state] : "state-off"}`}>{r.name}</span>
                <span className="ml-5 text-[0.6875rem] text-ink-3">{r.sub}</span>
              </span>
              <span className={`${track} h-full`}>
                {r.span?.map((s, i) => <Bar key={`g${i}`} seg={s} className="h-px bg-line-strong" />)}
                {r.segs.map((s, i) => (
                  <Bar key={i} seg={s} className={`h-[0.3125rem] ${r.open ? "bg-ink" : "bg-[color-mix(in_srgb,var(--ink)_38%,transparent)]"}`} />
                ))}
              </span>
            </div>
          ))}

          {/* the present moment, drawn over everything */}
          <div className="pointer-events-none absolute inset-y-0 left-[calc(8.5rem+1.625rem)] right-13 z-1 sm:left-[calc(8.5rem+2.125rem)] sm:right-21">
            {model && (
              <span className="absolute bottom-13 top-8 w-px bg-accent" style={{ left: pct(model.nowAt) }}>
                <span className={`num absolute top-0 flex h-[1.125rem] items-center whitespace-nowrap bg-accent px-5 text-[0.6875rem] font-semibold text-accent-ink ${model.nowAt > 1300 ? "right-0" : "left-0"}`}>Now {hhmm(model.nowAt)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* the same timetable as text, for screen readers */}
      <div className="sr-only">
        {model ? (
          <ul>
            <li>
              Times in {axisName}. It is now {hhmm(model.nowAt)}.
            </li>
            {model.fx.map((r) => (
              <li key={r.key}>{r.text}</li>
            ))}
            {model.overlaps.map((o) => (
              <li key={o.key}>
                {o.label} overlap: {hhmm(Math.min(...o.segs.map((s) => s[0])))} to {hhmm(o.segs[o.segs.length - 1][1])}
                {o.live ? ", in progress" : ""}
              </li>
            ))}
            {model.venues.map((r) => (
              <li key={r.key}>{r.text}</li>
            ))}
          </ul>
        ) : (
          <p>The timetable is computed from your device clock once the page has loaded.</p>
        )}
      </div>

      <div className="flex flex-col gap-8 border-t border-line px-13 py-13 sm:px-21">
        <p className="flex flex-wrap items-center gap-x-21 gap-y-5 text-xs text-ink-3" aria-hidden>
          <span className="inline-flex items-center gap-5">
            <span className="h-[0.8125rem] w-21 rounded-xs bg-[color-mix(in_srgb,var(--ink)_38%,transparent)]" />
            FX session window
          </span>
          <span className="inline-flex items-center gap-5">
            <span className="h-[0.3125rem] w-21 bg-accent" />
            Two sessions overlap
          </span>
          <span className="inline-flex items-center gap-5">
            <span className="h-[0.3125rem] w-21 bg-[color-mix(in_srgb,var(--ink)_38%,transparent)]" />
            Exchange regular hours
          </span>
          <span className="inline-flex items-center gap-5">
            <span className="h-[0.3125rem] w-21 bg-ink" />
            Open now
          </span>
          <span className="lg:hidden">Scroll sideways for the full day.</span>
        </p>
        <DataNote status="schedule">{SCHEDULE_NOTE}</DataNote>
      </div>
    </figure>
  );
}
