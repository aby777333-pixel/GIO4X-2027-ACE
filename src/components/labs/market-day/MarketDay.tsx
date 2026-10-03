"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { signalSound } from "@/components/sound/signal";
import { DataNote } from "@/components/ui/Page";
import { centres } from "@/lib/sessions";
import { wrap180 } from "./earth";
import { CHAPTER_TEXT, LAST, MINUTES_PER_SECOND, NC, STEP, WEEKDAYS, WEEK_ORDER, buildDay, chapterAt, clockOf, dateLabel, dayStart, readingAt, weekendNote, type ChapterId } from "./film";
import { drawDay } from "./scene";
import { useGlobeCanvas, useStillMotion, type GlobePaint } from "./useGlobeCanvas";

/**
 * ONE DAY OF MARKETS
 *
 * A film of one whole UTC day, about two minutes long, that can be scrubbed.
 * The stage holds the globe (a canvas, decorative), the reading in words, the
 * caption of the chapter the film has reached, and the controls; the stage is
 * the element that goes full screen, so the controls come with it.
 *
 * Everything is read from the regular timetables in src/lib/sessions.ts and the
 * sun's position (see film.ts). The film never starts by itself. With motion
 * reduced there is no playback at all: the chapters are stills, stepped through
 * with two buttons, and the scrubber works as before.
 *
 * The server renders the chapters and a neutral stage; the date, the times and
 * the picture are filled in after mount, from the visitor's clock.
 */

const SPEEDS = [0.5, 1, 2] as const;

/** the dial's lamp for each state, as the canvas draws it: shape carries the meaning */
function Lamp({ kind }: { kind: "open" | "lunch" | "pre" | "closed" }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 text-prestige">
      {kind === "open" && <circle cx="6" cy="6" r="4.5" fill="currentColor" />}
      {kind === "lunch" && (
        <>
          <path d="M6 1.5a4.5 4.5 0 0 0 0 9z" fill="currentColor" />
          <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {kind === "pre" && <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {kind === "closed" && <circle cx="6" cy="6" r="2.75" fill="none" stroke="var(--ink-2)" strokeWidth="1" />}
    </svg>
  );
}

export function MarketDay() {
  const id = useId();
  const still = useStillMotion();
  /** the moment the page read the clock; null until mounted */
  const [clockAt, setClockAt] = useState<number | null>(null);
  const [weekday, setWeekday] = useState(3);
  /** the minute of the day shown, in steps of five */
  const [min, setMin] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  /** the chapter last jumped to: it wins when two chapters share a minute */
  const [asked, setAsked] = useState<ChapterId | null>(null);
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  /** the film's own state, read by the painter on every frame */
  const sim = useRef(0);
  const shown = useRef(0);
  const run = useRef(false);
  const rate = useRef(1);
  const view = useRef(Number.NaN);

  const table = useMemo(() => (clockAt === null ? null : buildDay(dayStart(new Date(clockAt), weekday))), [clockAt, weekday]);
  const tableRef = useRef(table);
  tableRef.current = table;
  rate.current = speed;

  const paint: GlobePaint = (f) => {
    const t = tableRef.current;
    if (!t) return false;
    if (run.current && !f.still) {
      sim.current += f.dt * MINUTES_PER_SECOND * rate.current;
      if (sim.current >= 1440) {
        sim.current = 1440;
        run.current = false;
        setPlaying(false);
      }
      const step = Math.floor(sim.current / STEP) * STEP;
      if (step !== shown.current) {
        shown.current = step;
        setMin(step);
        setAsked(null);
      }
    }
    // the longitude the globe should face, between this step's and the next one's
    const at = Math.min(LAST, sim.current / STEP);
    const i = Math.min(LAST - 1, Math.floor(at));
    const want = t.face[i] + wrap180(t.face[i + 1] - t.face[i]) * (at - i);
    const gap = Number.isNaN(view.current) ? 0 : wrap180(want - view.current);
    if (f.still || Number.isNaN(view.current) || Math.abs(gap) < 0.05) view.current = want;
    else view.current += gap * Math.min(1, f.dt * 5);
    drawDay(f, t, sim.current, view.current);
    return run.current || Math.abs(wrap180(want - view.current)) >= 0.05;
  };
  const { ref: canvasRef, request } = useGlobeCanvas(paint);

  // read the clock once mounted: the film opens, paused, on the present moment
  useEffect(() => {
    const now = new Date();
    const m = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / STEP) * STEP;
    sim.current = m;
    shown.current = m;
    setMin(m);
    setWeekday(now.getUTCDay());
    setClockAt(now.getTime());
    setCanFull(typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled !== false);
    const onFull = () => setFull(document.fullscreenElement !== null && document.fullscreenElement === stageRef.current);
    // the browser itself leaves full screen on Escape; where the key reaches the page instead, the page does it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.fullscreenElement && document.fullscreenElement === stageRef.current) void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // a different day, a change of size or of motion: one new frame
  useEffect(() => {
    request();
  }, [table, full, still, request]);

  // with motion reduced nothing plays
  useEffect(() => {
    if (still && run.current) {
      run.current = false;
      setPlaying(false);
    }
  }, [still]);

  const seek = useCallback(
    (m: number, chapter: ChapterId | null = null) => {
      const v = Math.max(0, Math.min(1440, Math.round(m / STEP) * STEP));
      sim.current = v;
      shown.current = v;
      setMin(v);
      setAsked(chapter);
      request();
    },
    [request],
  );

  const pause = () => {
    run.current = false;
    setPlaying(false);
  };
  const play = () => {
    if (still || !tableRef.current) return;
    // at the end of the day, play starts the day again
    if (sim.current >= 1440) seek(0);
    run.current = true;
    setPlaying(true);
    request();
  };
  const toNow = () => {
    const now = new Date();
    pause();
    setWeekday(now.getUTCDay());
    setClockAt(now.getTime());
    seek(Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / STEP) * STEP);
  };
  const toggleFull = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen().catch(() => {});
  };

  const reading = table ? readingAt(table, min) : null;
  const chapter = table ? chapterAt(table, min, asked) : null;
  const chapterId = chapter?.id;
  // a chime as the film reaches each chapter: heard only if sound is switched on in the preferences
  useEffect(() => {
    if (chapterId && run.current) signalSound("chime");
  }, [chapterId]);
  /** the chapters in the order the film reaches them */
  const marks = useMemo(() => (table ? [...table.chapters].sort((a, b) => a.min - b.min) : []), [table]);
  const weekend = table ? weekendNote(table) : null;
  const ready = table !== null;

  const step = (dir: 1 | -1) => {
    if (!marks.length) return;
    const here = chapter ? marks.findIndex((c) => c.id === chapter.id) : -1;
    // from between two chapters, "previous" returns to the one the film is in
    const next = dir === 1 ? marks[Math.min(marks.length - 1, here + 1)] : chapter && min > chapter.min ? chapter : marks[Math.max(0, here - 1)];
    seek(next.min, next.id);
  };

  const jump = (c: { id: ChapterId; min: number }) => {
    seek(c.min, c.id);
    stageRef.current?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  };

  return (
    <div>
      {/* ── the stage: this element goes full screen ── */}
      <div
        ref={stageRef}
        className={`on-night flex flex-col ${full ? "h-screen w-screen overflow-y-auto" : "overflow-hidden rounded-md border border-line lg:h-[min(calc(100svh-var(--header-h)-1.3125rem),60rem)] lg:min-h-[40rem]"}`}
        // controls drawn "ink on background" must read on the night material in the light theme too
        style={{ ["--bg" as string]: "var(--night)", ["--paper" as string]: "var(--night-2)" }}
        data-market-day
      >
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="relative aspect-square min-h-0 w-full lg:aspect-auto">
            <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
            {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-ink-3">Reading your clock…</p>}
          </div>

          {/* the reading, in words */}
          <div className="flex min-h-0 flex-col gap-21 border-t border-line p-21 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-34">
            <div>
              <p className="label">{table ? dateLabel(table.start) : "One UTC day"}</p>
              <p className="mt-8 flex items-baseline gap-8">
                <span className="num font-display text-5xl font-light leading-none tracking-[-0.03em]" data-film-clock>
                  {reading ? reading.clock : "--:--"}
                </span>
                <span className="text-sm text-ink-3">UTC</span>
              </p>
              <p className="h4 mt-13" data-film-headline>
                {reading ? reading.headline : "Reading your clock…"}
              </p>
            </div>

            <dl className="grid gap-8 border-t border-line pt-13 text-sm" data-film-states>
              <div className="grid grid-cols-[6.5rem_1fr] gap-8">
                <dt className="flex items-center gap-5 text-ink-3">
                  <Lamp kind="open" /> Open
                </dt>
                <dd data-film-open>{!reading ? "…" : reading.open.length ? reading.open.join(", ") : `None of the ${NC} exchanges`}</dd>
              </div>
              {reading && reading.lunch.length > 0 && (
                <div className="grid grid-cols-[6.5rem_1fr] gap-8">
                  <dt className="flex items-center gap-5 text-ink-3">
                    <Lamp kind="lunch" /> Midday break
                  </dt>
                  <dd>{reading.lunch.join(", ")}</dd>
                </div>
              )}
              {reading && reading.pre.length > 0 && (
                <div className="grid grid-cols-[6.5rem_1fr] gap-8">
                  <dt className="flex items-center gap-5 text-ink-3">
                    <Lamp kind="pre" /> Pre-open
                  </dt>
                  <dd>{reading.pre.join(", ")}</dd>
                </div>
              )}
              {reading && reading.rising.length > 0 && (
                <div className="grid grid-cols-[6.5rem_1fr] gap-8">
                  <dt className="text-ink-3">Sunrise over</dt>
                  <dd>{reading.rising.join(", ")}</dd>
                </div>
              )}
              {reading && reading.setting.length > 0 && (
                <div className="grid grid-cols-[6.5rem_1fr] gap-8">
                  <dt className="text-ink-3">Sunset over</dt>
                  <dd>{reading.setting.join(", ")}</dd>
                </div>
              )}
            </dl>

            {/* the caption of the chapter the film has reached */}
            <div className="border-t border-line pt-13" aria-live="polite" data-film-caption>
              {chapter ? (
                <>
                  <p className="eyebrow">
                    Chapter · <span className="num">{clockOf(chapter.min)}</span> UTC
                  </p>
                  <h3 className="h3 mt-8">{chapter.title}</h3>
                  <p className="gx-couplet mt-8">
                    <span>{chapter.verse[0]}</span>
                    <span>{chapter.verse[1]}</span>
                  </p>
                  <p className="mt-8 text-sm text-ink-2">{chapter.lines[0]}</p>
                  <p className="mt-8 text-sm text-ink-2">{chapter.lines[1]}</p>
                  {!chapter.happens && <p className="mt-8 text-sm text-ink-3">Not on this day: at this moment the regular timetable is in a weekend.</p>}
                </>
              ) : (
                <p className="text-sm text-ink-3">{ready ? "The film has not reached its first chapter." : "Seven chapters, listed under the stage."}</p>
              )}
              {weekend && (
                <p className="mt-13 border-l-2 border-warn pl-13 text-sm text-ink" data-film-weekend>
                  {weekend}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── the controls ── */}
        <div className="shrink-0 border-t border-line p-13 sm:p-21">
          <div className="flex flex-wrap items-center gap-x-13 gap-y-8">
            {still ? (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(-1)} disabled={!ready}>
                  Previous chapter
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => step(1)} disabled={!ready}>
                  Next chapter
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-primary btn-sm min-w-[5.5rem]" onClick={playing ? pause : play} disabled={!ready} data-film-play>
                  {playing ? "Pause" : min >= 1440 ? "Play again" : "Play"}
                </button>
                <div className="seg" role="group" aria-label="Playback speed">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className="!normal-case">
                      {s}×<span className="sr-only"> speed</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!ready}
                  onClick={() => {
                    // the whole day from its first minute at twice the speed: sixty seconds
                    seek(0);
                    setSpeed(2);
                    run.current = true;
                    setPlaying(true);
                    request();
                  }}
                >
                  The 60-second cut
                </button>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={toNow} disabled={!ready} data-film-now>
              Now
            </button>
            <label className="flex items-center gap-8 text-xs text-ink-3">
              <span>Day</span>
              <select className="select !h-[2.125rem] !w-auto !py-0 text-sm" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} disabled={!ready} data-film-day>
                {WEEK_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </select>
            </label>
            {canFull && (
              <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={toggleFull} aria-pressed={full} data-film-full>
                {full ? "Leave full screen" : "Enter full screen"}
              </button>
            )}
          </div>

          {/* the scrubber */}
          <div className="mt-13">
            <div className="flex items-baseline justify-between gap-13">
              <label htmlFor={`${id}-scrub`} className="label">
                Time of day, UTC
              </label>
              <output htmlFor={`${id}-scrub`} className="num text-sm text-ink-2" data-film-readout>
                {reading ? `${reading.clock} UTC · ${reading.open.length ? `open: ${reading.open.join(", ")}` : "no exchange open"}` : "--:-- UTC"}
              </output>
            </div>
            <div className="relative mt-5">
              <input
                id={`${id}-scrub`}
                type="range"
                className="range relative z-[1]"
                min={0}
                max={1440}
                step={STEP}
                value={min}
                disabled={!ready}
                onChange={(e) => seek(Number(e.target.value))}
                aria-valuetext={reading ? reading.valueText : undefined}
                data-film-scrub
              />
              {/* where the chapters fall: ticks only, the buttons below carry the names */}
              <div aria-hidden className="pointer-events-none absolute inset-x-[0.40625rem] top-0 h-full">
                {marks.map((c) => (
                  <span key={c.id} className="absolute top-[0.1875rem] h-[0.3125rem] w-px bg-prestige" style={{ left: `${(c.min / 1440) * 100}%` }} />
                ))}
              </div>
            </div>
            <div aria-hidden className="num flex justify-between px-[0.1rem] text-[0.6875rem] text-ink-3">
              {["00", "06", "12", "18", "24"].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>

          {/* chapter marks */}
          <ul className="mt-8 flex flex-wrap gap-5" aria-label="Chapters">
            {(ready ? marks : CHAPTER_TEXT.map((c) => ({ ...c, min: -1 }))).map((c) => {
              const on = chapter?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={!ready}
                    aria-current={on ? "true" : undefined}
                    onClick={() => seek(c.min, c.id)}
                    className={`inline-flex min-h-[2.125rem] items-center gap-8 rounded-sm border px-8 text-xs transition-colors duration-fast ${on ? "border-ink text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"}`}
                    data-film-chapter={c.id}
                  >
                    <span className="num text-ink-3">{c.min >= 0 ? clockOf(c.min) : "--:--"}</span>
                    {c.title}
                  </button>
                </li>
              );
            })}
          </ul>
          {still && <p className="mt-8 text-xs text-ink-3">Motion is reduced, so the film is shown as stills: step through the chapters, or move the slider.</p>}
        </div>
      </div>

      <DataNote className="mt-13" status="schedule">
        Read from each venue’s regular weekday timetable and the sun’s position on the date shown, with your browser’s time-zone data. Public holidays and early closes are not reflected.{" "}
        <Link href="/markets/clock" className="link">
          World Market Clock
        </Link>
      </DataNote>

      {/* ── the chapters as text: the page is complete without the picture ── */}
      <div className="mt-55">
        <h2 className="h2" id={`${id}-chapters`}>
          The day in seven chapters.
        </h2>
        <p className="mt-13 max-w-measure text-ink-2">
          In the order of the trading day, which is conventionally counted from Sydney. Sydney’s morning is late evening on the UTC clock, so in a film of one UTC day its chapter comes last. The times are for{" "}
          {table ? dateLabel(table.start) : "the day shown"} and move when a centre changes its clocks.
        </p>
        <ol className="mt-21 border-t border-line-strong" aria-labelledby={`${id}-chapters`}>
          {CHAPTER_TEXT.map((c, n) => {
            const at = table?.chapters.find((x) => x.id === c.id);
            const on = chapter?.id === c.id;
            return (
              <li key={c.id} className="grid gap-x-21 gap-y-8 border-b border-line py-21 md:grid-cols-[3.4375rem_minmax(0,16rem)_minmax(0,1fr)]" aria-current={on ? "true" : undefined}>
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink" aria-hidden>
                  {String(n + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="h4">{c.title}</h3>
                  <p className="num mt-5 text-sm text-ink-3">{at ? `${clockOf(at.min)} UTC on this date` : "--:-- UTC"}</p>
                  <button type="button" className="go mt-8" onClick={() => at && jump(at)} disabled={!at}>
                    Show this moment
                  </button>
                </div>
                <div className="max-w-measure text-ink-2">
                  <p>{c.lines[0]}</p>
                  <p className="mt-8">{c.lines[1]}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-13 max-w-measure text-sm text-ink-3">
          The nine centres are {centres.map((c) => `${c.city} (${c.venue})`).join(", ")}. On a Saturday or Sunday they are closed and the film says so.
        </p>
      </div>
    </div>
  );
}
