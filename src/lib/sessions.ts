/**
 * Market sessions and financial centres.
 *
 * Everything here is computed from the visitor's clock and published exchange
 * timetables. It is a schedule, not a data feed:
 *   - regular weekday hours only; public holidays and early closes are NOT modelled
 *   - time zones (incl. daylight saving) are resolved by the browser's IANA database
 * Every UI that uses this module carries that caveat (see <ScheduleNote/>).
 */

export type CentreState = "open" | "pre" | "lunch" | "closed";

export type Centre = {
  key: string;
  city: string;
  /** exchange whose regular session defines "open" for the city */
  venue: string;
  tz: string;
  lat: number;
  lon: number;
  /** regular session, local minutes from midnight */
  open: number;
  close: number;
  /** optional lunch break, local minutes */
  lunch?: [number, number];
  /** region for the Market Rhythm atmosphere */
  region: "asia" | "europe" | "americas";
};

const hm = (h: number, m = 0) => h * 60 + m;

/** West → East is not the reading order here; the order follows the trading day. */
export const centres: Centre[] = [
  { key: "sydney", city: "Sydney", venue: "ASX", tz: "Australia/Sydney", lat: -33.87, lon: 151.21, open: hm(10), close: hm(16), region: "asia" },
  { key: "tokyo", city: "Tokyo", venue: "TSE", tz: "Asia/Tokyo", lat: 35.68, lon: 139.69, open: hm(9), close: hm(15, 30), lunch: [hm(11, 30), hm(12, 30)], region: "asia" },
  { key: "hong-kong", city: "Hong Kong", venue: "HKEX", tz: "Asia/Hong_Kong", lat: 22.32, lon: 114.17, open: hm(9, 30), close: hm(16), lunch: [hm(12), hm(13)], region: "asia" },
  { key: "singapore", city: "Singapore", venue: "SGX", tz: "Asia/Singapore", lat: 1.35, lon: 103.82, open: hm(9), close: hm(17), lunch: [hm(12), hm(13)], region: "asia" },
  { key: "mumbai", city: "Mumbai", venue: "NSE", tz: "Asia/Kolkata", lat: 19.08, lon: 72.88, open: hm(9, 15), close: hm(15, 30), region: "asia" },
  { key: "dubai", city: "Dubai", venue: "DFM", tz: "Asia/Dubai", lat: 25.2, lon: 55.27, open: hm(10), close: hm(15), region: "asia" },
  { key: "frankfurt", city: "Frankfurt", venue: "Xetra", tz: "Europe/Berlin", lat: 50.11, lon: 8.68, open: hm(9), close: hm(17, 30), region: "europe" },
  { key: "london", city: "London", venue: "LSE", tz: "Europe/London", lat: 51.51, lon: -0.13, open: hm(8), close: hm(16, 30), region: "europe" },
  { key: "new-york", city: "New York", venue: "NYSE", tz: "America/New_York", lat: 40.71, lon: -74.01, open: hm(9, 30), close: hm(16), region: "americas" },
];

/** Conventional foreign-exchange session windows (local time of the anchor city). */
export type FxSession = { key: string; name: string; tz: string; open: number; close: number };
export const fxSessions: FxSession[] = [
  { key: "sydney", name: "Sydney", tz: "Australia/Sydney", open: hm(8), close: hm(17) },
  { key: "tokyo", name: "Tokyo", tz: "Asia/Tokyo", open: hm(9), close: hm(18) },
  { key: "london", name: "London", tz: "Europe/London", open: hm(8), close: hm(17) },
  { key: "new-york", name: "New York", tz: "America/New_York", open: hm(8), close: hm(17) },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  return f;
}

export type LocalTime = { weekday: number; minutes: number; label: string };

/** Wall-clock time in an IANA zone. */
export function localTime(now: Date, tz: string): LocalTime {
  const parts = fmt(tz).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  return { weekday: WEEKDAYS.indexOf(get("weekday")), minutes: h * 60 + m, label: `${get("hour")}:${get("minute")}` };
}

export type CentreStatus = {
  centre: Centre;
  state: CentreState;
  local: LocalTime;
  /** minutes until the next change of state on the regular timetable */
  nextChangeIn: number;
  nextLabel: string;
};

const isWeekday = (d: number) => d >= 1 && d <= 5;

function minutesUntilNextOpen(c: Centre, t: LocalTime): number {
  // walk forward day by day (max 3 days: Fri evening → Mon)
  let wait = 0;
  let day = t.weekday;
  let mins = t.minutes;
  for (let i = 0; i < 4; i++) {
    if (isWeekday(day) && mins < c.open) return wait + (c.open - mins);
    wait += 1440 - mins;
    mins = 0;
    day = (day + 1) % 7;
  }
  return wait;
}

export function centreStatus(c: Centre, now: Date): CentreStatus {
  const local = localTime(now, c.tz);
  const { weekday, minutes } = local;
  if (isWeekday(weekday)) {
    if (c.lunch && minutes >= c.lunch[0] && minutes < c.lunch[1]) {
      return { centre: c, state: "lunch", local, nextChangeIn: c.lunch[1] - minutes, nextLabel: "resumes" };
    }
    if (minutes >= c.open && minutes < c.close) {
      const until = c.lunch && minutes < c.lunch[0] ? c.lunch[0] - minutes : c.close - minutes;
      return { centre: c, state: "open", local, nextChangeIn: until, nextLabel: c.lunch && minutes < c.lunch[0] ? "to midday break" : "to close" };
    }
    if (minutes < c.open && c.open - minutes <= 60) {
      return { centre: c, state: "pre", local, nextChangeIn: c.open - minutes, nextLabel: "to open" };
    }
  }
  return { centre: c, state: "closed", local, nextChangeIn: minutesUntilNextOpen(c, local), nextLabel: "to open" };
}

export function allCentreStatus(now: Date): CentreStatus[] {
  return centres.map((c) => centreStatus(c, now));
}

export function fxSessionOpen(s: FxSession, now: Date): boolean {
  const t = localTime(now, s.tz);
  // The FX week runs from Monday morning in Sydney to Friday 17:00 in New York.
  if (!isWeekday(t.weekday)) return false;
  return t.minutes >= s.open && t.minutes < s.close;
}

/** Is the global FX market in its trading week? (Sun 17:00 → Fri 17:00 New York) */
export function fxWeekOpen(now: Date): boolean {
  const ny = localTime(now, "America/New_York");
  if (ny.weekday === 6) return false;
  if (ny.weekday === 0) return ny.minutes >= hm(17);
  if (ny.weekday === 5) return ny.minutes < hm(17);
  return true;
}

export type FxOverview = {
  weekOpen: boolean;
  open: FxSession[];
  /** e.g. "London × New York" when two sessions overlap */
  overlap: string | null;
};

export function fxOverview(now: Date): FxOverview {
  const weekOpen = fxWeekOpen(now);
  const open = weekOpen ? fxSessions.filter((s) => fxSessionOpen(s, now)) : [];
  return { weekOpen, open, overlap: open.length >= 2 ? open.map((s) => s.name).join(" × ") : null };
}

/** UTC start/end (minutes from 00:00 UTC of `day`) of a local window on that UTC day, for the 24h ribbon. */
export function windowInUtc(tz: string, open: number, close: number, now: Date): { start: number; end: number } {
  // offset = local − UTC, in minutes, at `now`
  const local = localTime(now, tz).minutes;
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  let offset = local - utc;
  if (offset > 720) offset -= 1440;
  if (offset < -720) offset += 1440;
  const start = (((open - offset) % 1440) + 1440) % 1440;
  const end = (((close - offset) % 1440) + 1440) % 1440;
  return { start, end };
}

export function formatDuration(mins: number): string {
  if (mins >= 1440) {
    const d = Math.floor(mins / 1440);
    const h = Math.round((mins % 1440) / 60);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

export const stateLabel: Record<CentreState, string> = {
  open: "Open",
  pre: "Pre-open",
  lunch: "Midday break",
  closed: "Closed",
};

/** Which region currently carries the most open venues; drives the subtle "Market Rhythm" atmosphere. */
export function activeRegion(now: Date): Centre["region"] | null {
  const counts: Record<string, number> = {};
  for (const s of allCentreStatus(now)) if (s.state === "open") counts[s.centre.region] = (counts[s.centre.region] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? (top[0] as Centre["region"]) : null;
}

export const SCHEDULE_NOTE =
  "Computed from your device clock and each venue’s regular weekday timetable. Public holidays and early closes are not reflected.";
