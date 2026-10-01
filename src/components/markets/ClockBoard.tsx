"use client";

import { useNow } from "@/hooks/useNow";
import { usePrefs } from "@/hooks/usePrefs";
import { centres, centreStatus, formatDuration, fxOverview, localTime, SCHEDULE_NOTE, stateLabel } from "@/lib/sessions";
import { DataNote } from "@/components/ui/Page";
import { DayRibbon } from "./DayRibbon";
import { stateClass } from "./Now";
import { hhmm, isZoneKey, offsetLabel, zoneId, zoneOffset, ZONES, zoneMeta } from "./time";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A seconds-resolution reading, isolated so that only this line re-renders every second. */
function BigClock({ tz }: { tz: string | null }) {
  const now = useNow(1000);
  if (!now || !tz) {
    return (
      <span className="num font-display text-5xl font-light leading-none tracking-[-0.03em] sm:text-6xl" aria-hidden>
        --:--<span className="text-ink-3">:--</span>
      </span>
    );
  }
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "--";
  return (
    <time dateTime={now.toISOString()} className="num font-display text-5xl font-light leading-none tracking-[-0.03em] sm:text-6xl">
      {get("hour")}:{get("minute")}
      <span className="text-ink-3">:{get("second")}</span>
    </time>
  );
}

/**
 * THE WORLD MARKET CLOCK
 *
 * Nine financial centres with their state on the regular timetable, the local
 * time there, and the time until the next change; then the same day drawn as
 * a ribbon. The visitor chooses the reference zone (their own, UTC, London or
 * New York); the choice is remembered in this browser only.
 *
 * The server renders a neutral frame; every time-dependent value is filled in
 * after mount, so nothing stale is ever presented as current.
 */
export function ClockBoard() {
  const now = useNow(15_000);
  const [prefs, setPrefs, ready] = usePrefs();
  const zone = ready && isZoneKey(prefs.tz) ? prefs.tz : ready ? "local" : null;
  const tz = zone ? zoneId(zone) : null;
  const meta = zoneMeta(zone ?? "local");
  const fx = now ? fxOverview(now) : null;
  const statuses = now ? centres.map((c) => centreStatus(c, now)) : null;
  const openCount = statuses?.filter((s) => s.state === "open").length ?? 0;
  const ref = now && tz ? localTime(now, tz) : null;
  const off = now && tz ? zoneOffset(now, tz) : null;

  const headline = !now ? "Reading your clock…" : !fx?.weekOpen ? "Weekend. The FX week is closed." : fx.overlap ? `${fx.overlap} overlap` : fx.open.length ? `${fx.open[0].name} session` : "Between FX sessions";

  return (
    <div>
      {/* the reading and the zone selector */}
      <div className="grid gap-21 border-b border-line-strong pb-21 lg:grid-cols-phi lg:items-end lg:gap-55">
        <div>
          <p className="label">
            {zone === "local" && tz ? `Your time · ${tz.replace(/_/g, " ")}` : meta.long.replace(/^./, (c) => c.toUpperCase())}
            {off !== null && zone !== "UTC" ? ` · ${offsetLabel(off)}` : ""}
          </p>
          <p className="mt-13 flex flex-wrap items-end gap-x-21 gap-y-8">
            <BigClock tz={tz} />
            <span className="pb-3 text-sm text-ink-3">{ref ? WEEKDAY[ref.weekday] : ""}</span>
          </p>
          <p className="mt-13 text-md font-medium" aria-live="polite">
            {headline}
            {statuses && (
              <span className="font-normal text-ink-3">
                {" · "}
                {openCount} of {centres.length} exchanges in regular hours
              </span>
            )}
          </p>
        </div>
        <fieldset className="lg:justify-self-end">
          <legend className="label mb-8">Show times in</legend>
          <div className="seg flex w-full sm:inline-flex sm:w-auto">
            {ZONES.map((z) => (
              <button key={z.key} type="button" aria-pressed={zone === z.key} onClick={() => setPrefs({ tz: z.key })} className="!h-[2.75rem] flex-1 justify-center whitespace-nowrap !px-8 sm:!px-13">
                {z.label}
              </button>
            ))}
          </div>
          <p className="mt-8 max-w-[22rem] text-xs text-ink-3">Remembered in this browser only. Each centre’s own local time is always shown beside it.</p>
        </fieldset>
      </div>

      {/* nine centres */}
      <ul className="grid border-l border-line sm:grid-cols-2 lg:grid-cols-3" aria-label="Financial centres">
        {centres.map((c, n) => {
          const s = statuses?.[n];
          // the venue's regular hours, expressed in the chosen zone
          let inZone = "";
          if (now && tz && off !== null) {
            const cOff = zoneOffset(now, c.tz);
            inZone = `${hhmm(c.open - cOff + off)}–${hhmm(c.close - cOff + off)}`;
          }
          return (
            <li key={c.key} className="border-b border-r border-line p-13 sm:p-21">
              <div className="flex items-start justify-between gap-13">
                <div>
                  <h3 className="h4">{c.city}</h3>
                  <p className="text-xs text-ink-3">{c.venue}</p>
                </div>
                <span className={`state mt-5 ${s ? stateClass[s.state] : "state-off"}`}>{s ? stateLabel[s.state] : "…"}</span>
              </div>
              <div className="mt-13 flex items-end justify-between gap-13">
                <p className="num font-display text-3xl font-light leading-none tracking-[-0.02em]">
                  {s ? s.local.label : "--:--"}
                  <span className="ml-5 font-sans text-xs font-normal tracking-normal text-ink-3">local</span>
                </p>
                <p className="num text-right text-sm text-ink-2">{s ? `${formatDuration(s.nextChangeIn)} ${s.nextLabel}` : ""}</p>
              </div>
              <p className="num mt-13 border-t border-line pt-8 text-xs text-ink-3">
                Regular hours {hhmm(c.open)}–{hhmm(c.close)} local
                {c.lunch ? `, break ${hhmm(c.lunch[0])}–${hhmm(c.lunch[1])}` : ""}
                {inZone && zone !== null && (
                  <>
                    {" · "}
                    <span className="text-ink-2">
                      {inZone} {zone === "local" ? "your time" : meta.label}
                    </span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <DataNote className="mt-13" status="schedule">
        {SCHEDULE_NOTE}
      </DataNote>

      {/* the day as a ribbon, on the chosen axis */}
      <div className="mt-55">
        <h2 className="h3" id="ribbon-title">
          The day, drawn.
        </h2>
        <p className="mt-8 max-w-measure text-ink-2">The same timetable on a 24-hour axis in {zone ? meta.long : "your chosen zone"}. Session windows are fixed in each centre’s local time, so they shift on this axis when a centre changes its clocks.</p>
        <div className="mt-21">
          <DayRibbon zone={zone ?? "UTC"} id="clock-ribbon" />
        </div>
      </div>
    </div>
  );
}
