"use client";

import Link from "next/link";
import { useNow } from "@/hooks/useNow";
import { allCentreStatus, centres, centreStatus, formatDuration, fxOverview, fxSessionOpen, fxSessions, localTime, stateLabel, type CentreState } from "@/lib/sessions";
import { hhmm, utcMinutes } from "./time";

export const stateClass: Record<CentreState, string> = { open: "state-open", pre: "state-pre", lunch: "state-pre", closed: "state-off" };

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Wall-clock time in a zone, filled in on the client. Neutral until mounted. */
export function ZoneTime({ tz, withDay = false, className = "" }: { tz: string; withDay?: boolean; className?: string }) {
  const now = useNow(20_000);
  if (!now) return <span className={`num ${className}`}>--:--</span>;
  const t = localTime(now, tz);
  return (
    <span className={`num ${className}`}>
      {t.label}
      {withDay && <span className="text-ink-3"> · {WEEKDAY[t.weekday] ?? ""}</span>}
    </span>
  );
}

/**
 * "What is trading now": the compact aside of Market Command. A schedule read
 * from the visitor's clock: which FX sessions are in their window, whether two
 * overlap, and which exchanges are in regular hours.
 */
export function NowAside() {
  const now = useNow(20_000);
  const fx = now ? fxOverview(now) : null;
  const statuses = now ? allCentreStatus(now) : null;
  const open = statuses?.filter((s) => s.state === "open") ?? [];
  const soon = statuses?.filter((s) => s.state === "pre" || s.state === "lunch") ?? [];

  const headline = !now ? "Reading your clock…" : !fx?.weekOpen ? "Weekend: the FX week is closed" : fx.overlap ? `${fx.overlap} overlap` : fx.open.length ? `${fx.open[0].name} session` : "Between FX sessions";

  return (
    <aside aria-label="What is trading now" className="border-t-2 border-ink pt-13">
      <div className="flex items-baseline justify-between gap-13">
        <p className="label">Trading now</p>
        <p className="num text-xs text-ink-3">{now ? `${hhmm(utcMinutes(now))} UTC` : "--:-- UTC"}</p>
      </div>
      <p className="h3 mt-8" aria-live="polite">
        {headline}
      </p>

      <dl className="mt-21 border-t border-line">
        <div className="grid grid-cols-[6.5rem_1fr] gap-13 border-b border-line py-13">
          <dt className="text-sm text-ink-3">FX sessions</dt>
          <dd className="flex flex-wrap gap-x-13 gap-y-5">
            {fxSessions.map((s) => {
              const on = !!now && !!fx?.weekOpen && fxSessionOpen(s, now);
              return (
                <span key={s.key} className={`state ${on ? "state-open" : "state-off"}`}>
                  {s.name}
                  <span className="sr-only">{now ? (on ? ": open" : ": closed") : ""}</span>
                </span>
              );
            })}
          </dd>
        </div>
        <div className="grid grid-cols-[6.5rem_1fr] gap-13 border-b border-line py-13">
          <dt className="text-sm text-ink-3">Exchanges</dt>
          <dd className="text-sm">
            {!statuses ? (
              <span className="text-ink-3">…</span>
            ) : open.length ? (
              <ul className="grid gap-5">
                {open.map((s) => (
                  <li key={s.centre.key} className="flex items-baseline justify-between gap-13">
                    <span className="font-medium">
                      {s.centre.city} <span className="font-normal text-ink-3">{s.centre.venue}</span>
                    </span>
                    <span className="num text-xs text-ink-3">
                      {formatDuration(s.nextChangeIn)} {s.nextLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-2">None of the {centres.length} tracked exchanges is in regular hours.</span>
            )}
            {soon.length > 0 && (
              <p className="mt-8 text-xs text-ink-3">
                {soon.map((s) => `${s.centre.city}: ${stateLabel[s.state].toLowerCase()}, ${formatDuration(s.nextChangeIn)} ${s.nextLabel}`).join(" · ")}
              </p>
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-13 flex flex-wrap items-center justify-between gap-13">
        <p className="text-xs text-ink-3">Regular weekday timetables. Holidays are not reflected.</p>
        <Link href="/markets/clock" className="go py-13 md:py-0">
          Market clock
        </Link>
      </div>
    </aside>
  );
}

/** The four FX sessions and whether each is in its window: the Forex hub's aside. */
export function FxNow() {
  const now = useNow(20_000);
  const fx = now ? fxOverview(now) : null;
  return (
    <div>
      <p className="h4" aria-live="polite">
        {!now ? "Reading your clock…" : !fx?.weekOpen ? "The FX week is closed" : fx.overlap ? `${fx.overlap} overlap` : fx.open.length ? `${fx.open[0].name} session` : "Between sessions"}
      </p>
      <ul className="mt-13 border-t border-line">
        {fxSessions.map((s) => {
          const on = !!now && !!fx?.weekOpen && fxSessionOpen(s, now);
          return (
            <li key={s.key} className="flex items-center justify-between gap-13 border-b border-line py-8">
              <span className={`state ${on ? "state-open" : "state-off"}`}>
                {s.name}
                <span className="sr-only">{now ? (on ? ": open" : ": closed") : ""}</span>
              </span>
              <span className="num text-xs text-ink-3">
                {hhmm(s.open)}–{hhmm(s.close)} local · <ZoneTime tz={s.tz} className="text-ink-2" />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One exchange's regular-hours state: used where a class follows a single venue's day. */
export function VenueNow({ centreKey }: { centreKey: string }) {
  const now = useNow(20_000);
  const c = centres.find((x) => x.key === centreKey);
  if (!c) return null;
  const s = now ? centreStatus(c, now) : null;
  return (
    <div>
      <p className="flex items-baseline justify-between gap-13">
        <span className={`state ${s ? stateClass[s.state] : "state-off"}`} aria-live="polite">
          {s ? stateLabel[s.state] : "Reading your clock…"}
        </span>
        <span className="num text-xs text-ink-3">{s ? `${formatDuration(s.nextChangeIn)} ${s.nextLabel}` : ""}</span>
      </p>
      <p className="num mt-8 font-display text-3xl font-light">{s ? s.local.label : "--:--"}</p>
      <p className="mt-5 text-sm text-ink-3">
        {c.city} time. Regular hours {hhmm(c.open)}–{hhmm(c.close)}, Monday to Friday.
      </p>
    </div>
  );
}
