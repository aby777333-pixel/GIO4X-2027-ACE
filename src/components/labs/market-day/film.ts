/**
 * One day of markets, as a table.
 *
 * The film on /labs/market-day shows one whole UTC day. Everything it shows is
 * read from the regular timetables in src/lib/sessions.ts, by asking that
 * module what each centre's state is at every fifth minute of the day (so the
 * time zones, daylight saving included, are the browser's own), and from the
 * sun's position. There is no price, no volume and no measure of activity in
 * it. Public holidays and early closes are not modelled, as everywhere else on
 * the site that uses the timetable.
 *
 * The seven chapters are moments of that timetable. Their captions are general
 * explanation; the local hours in them are composed from the same data, so a
 * change to the timetable changes the sentence.
 */
import { hhmm } from "@/components/markets/time";
import { centres, centreStatus, fxSessionOpen, fxSessions, fxWeekOpen, localTime, type Centre, type FxSession } from "@/lib/sessions";
import { DEG, sunAt, sunTimes, wrapDay, type Sun } from "./earth";

/** the film moves in steps of five simulated minutes; a day is 288 of them, and the table holds both ends */
export const STEP = 5;
export const LAST = 1440 / STEP;
export const NC = centres.length;
/** one whole day plays in about two minutes at 1x */
export const MINUTES_PER_SECOND = 1440 / 120;

export const CLOSED = 0;
export const OPEN = 1;
export const PRE = 2;
export const LUNCH = 3;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** the order of the day selector: Monday to Sunday (values are getUTCDay numbers) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** the letters each FX window carries on the film's dial */
export const FX_SHORT: Record<string, string> = { sydney: "SYD", tokyo: "TYO", london: "LDN", "new-york": "NY" };

const DAY_MS = 86_400_000;
const mod = (v: number, n: number) => ((v % n) + n) % n;

function centre(key: string): Centre {
  const c = centres.find((x) => x.key === key);
  if (!c) throw new Error(`sessions.ts has no centre "${key}"`);
  return c;
}
function fxIndex(key: string): number {
  const i = fxSessions.findIndex((x) => x.key === key);
  if (i < 0) throw new Error(`sessions.ts has no FX session "${key}"`);
  return i;
}
const centreIndex = (key: string) => centres.indexOf(centre(key));

const SYD = centre("sydney");
const TYO = centre("tokyo");
const LDN = centre("london");
const FRA = centre("frankfurt");
const NYC = centre("new-york");
const FX_SYD: FxSession = fxSessions[fxIndex("sydney")];
const FX_TYO: FxSession = fxSessions[fxIndex("tokyo")];
const FX_LDN: FxSession = fxSessions[fxIndex("london")];
const FX_NYC: FxSession = fxSessions[fxIndex("new-york")];

/** 00:00 UTC of the given weekday (0 Sunday .. 6 Saturday) in the Monday-to-Sunday week that contains `now`. */
export function dayStart(now: Date, weekday: number): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = today - mod(now.getUTCDay() + 6, 7) * DAY_MS;
  return monday + mod(weekday + 6, 7) * DAY_MS;
}

/** The minute of this UTC day at which the wall clock in `tz` reads `localMin`. */
function utcOf(tz: string, localMin: number, start: number): number {
  const offsetAt = (at: number) => {
    const o = mod(localTime(new Date(start + at * 60_000), tz).minutes - at, 1440);
    return o > 840 ? o - 1440 : o;
  };
  // the offset at midday, then again at the answer: a day on which the clocks change is still right
  const first = mod(localMin - offsetAt(720), 1440);
  return mod(localMin - offsetAt(first), 1440);
}

export type ChapterId = "sydney" | "tokyo" | "handover" | "london" | "overlap" | "ny-close" | "quiet";

type ChapterDef = {
  id: ChapterId;
  title: string;
  /** two plain sentences of general explanation */
  lines: readonly [string, string];
  /** the minute of the UTC day it falls on */
  at: (start: number) => number;
  /** does the timetable really have this moment on this day? (not at a weekend) */
  happens: (t: Omit<DayTable, "chapters">, step: number) => boolean;
};

const bit = (key: string) => 1 << fxIndex(key);

/** In the order of the trading day, which is conventionally counted from Sydney. */
const DEFS: ChapterDef[] = [
  {
    id: "sydney",
    title: "Sydney opens",
    lines: [
      `The trading day is conventionally counted from Sydney, where the FX window opens at ${hhmm(FX_SYD.open)} local time and the exchange, the ${SYD.venue}, begins its regular session at ${hhmm(SYD.open)}.`,
      "On the UTC clock that is late in the evening, so this film of one UTC day ends where the next trading day begins.",
    ],
    at: (start) => utcOf(FX_SYD.tz, FX_SYD.open, start),
    happens: (t, i) => (t.fx[i] & bit("sydney")) !== 0,
  },
  {
    id: "tokyo",
    title: "Tokyo opens",
    lines: [
      `Tokyo’s exchange, the ${TYO.venue}, begins its regular session at ${hhmm(TYO.open)} local time, and the Tokyo FX window is conventionally counted from ${hhmm(FX_TYO.open)}.`,
      "With Sydney already at work this is the Asia-Pacific morning: the home session of the yen, the Australian dollar and the New Zealand dollar.",
    ],
    at: (start) => utcOf(TYO.tz, TYO.open, start),
    happens: (t, i) => t.states[i * NC + centreIndex("tokyo")] === OPEN,
  },
  {
    id: "handover",
    title: "The Tokyo–London handover",
    lines: [
      `Tokyo’s exchange ends its regular session at ${hhmm(TYO.close)} local time, while the Tokyo FX window conventionally runs to ${hhmm(FX_TYO.close)} and Europe’s desks are arriving.`,
      "The time in which the Tokyo and London windows are both open is short, and its length changes with daylight saving in the United Kingdom.",
    ],
    at: (start) => utcOf(TYO.tz, TYO.close, start),
    happens: (t, i) => (t.fx[i] & bit("tokyo")) !== 0,
  },
  {
    id: "london",
    title: "London opens",
    lines: [
      `London’s exchange, the ${LDN.venue}, begins its regular session at ${hhmm(LDN.open)} local time, the London FX window is counted from ${hhmm(FX_LDN.open)}, and Frankfurt’s ${FRA.venue} opens at ${hhmm(FRA.open)} in its own zone.`,
      "Centres further east whose regular hours have not yet ended are still open, so for a while two regions are at their desks together.",
    ],
    at: (start) => utcOf(LDN.tz, LDN.open, start),
    happens: (t, i) => t.states[i * NC + centreIndex("london")] === OPEN,
  },
  {
    id: "overlap",
    title: "The London–New York overlap",
    lines: [
      `The New York FX window opens at ${hhmm(FX_NYC.open)} local time while London’s is still open, and New York’s exchange, the ${NYC.venue}, begins its regular session at ${hhmm(NYC.open)}.`,
      "More centres open together means more participants at their desks. It says nothing about the direction of any price.",
    ],
    at: (start) => utcOf(FX_NYC.tz, FX_NYC.open, start),
    happens: (t, i) => (t.fx[i] & bit("london")) !== 0 && (t.fx[i] & bit("new-york")) !== 0,
  },
  {
    id: "ny-close",
    title: "New York closes",
    lines: [
      `New York’s exchange ends its regular session at ${hhmm(NYC.close)} local time, the last of the ${NC} on this globe to close.`,
      `The New York FX window conventionally runs to ${hhmm(FX_NYC.close)}, and on a Friday that hour is also the end of the FX week.`,
    ],
    at: (start) => utcOf(NYC.tz, NYC.close, start),
    happens: (t, i) => i > 0 && t.states[(i - 1) * NC + centreIndex("new-york")] === OPEN,
  },
  {
    id: "quiet",
    title: "The quiet hours",
    lines: [
      `Between the end of New York’s day and the regular session in Sydney, none of the ${NC} exchanges on this globe is inside its regular hours.`,
      "Foreign exchange does not stop on a weekday: quotes continue, with few centres at their desks.",
    ],
    at: (start) => utcOf(FX_NYC.tz, FX_NYC.close, start),
    happens: (t, i) => t.week[i] === 1,
  },
];

/** The chapters as the page lists them before the clock is read: title and caption, no times. */
export const CHAPTER_TEXT = DEFS.map((d) => ({ id: d.id, title: d.title, lines: d.lines }));

export type Chapter = {
  id: ChapterId;
  title: string;
  lines: readonly [string, string];
  /** minute of the UTC day */
  min: number;
  happens: boolean;
};

export type DayTable = {
  /** 00:00 UTC of the day, in milliseconds */
  start: number;
  /** 0 Sunday .. 6 Saturday, of the UTC day */
  weekday: number;
  /** for each step and centre: CLOSED, OPEN, PRE or LUNCH */
  states: Uint8Array;
  /** for each step and centre: simulated minutes since its state last changed (large when it has not, this day) */
  since: Int16Array;
  /** for each step: one bit for each FX session inside its window, in an open FX week */
  fx: Uint8Array;
  /** for each step: is the FX week open? */
  week: Uint8Array;
  /** for each step: the longitude the globe faces (the centres at work; with none, the daylight) */
  face: Float32Array;
  /** for each FX session: the stretches of this day it is open, in minutes */
  bands: [number, number][][];
  /** for each FX session: its conventional window on this date (start minute of the UTC day, length), weekend or not */
  windows: [number, number][];
  /** for each centre: sunrise and sunset on this day, in minutes of UTC within the day */
  rise: Float32Array;
  set: Float32Array;
  /** the sun at midday, for the day's sunrise and sunset */
  sun: Sun;
  /** does any exchange have a regular session on this day; is the FX week open for any of it */
  anyExchange: boolean;
  anyWeek: boolean;
  chapters: Chapter[];
};

/** Read the whole day from the timetable. About four thousand clock readings: done once for each day shown. */
export function buildDay(start: number): DayTable {
  const n = LAST + 1;
  const states = new Uint8Array(n * NC);
  const since = new Int16Array(n * NC).fill(9999);
  const fx = new Uint8Array(n);
  const week = new Uint8Array(n);
  const raw = new Float32Array(n * 2);
  let anyExchange = false;
  let anyWeek = false;

  for (let i = 0; i < n; i++) {
    const now = new Date(start + i * STEP * 60_000);
    let sx = 0;
    let sy = 0;
    for (let c = 0; c < NC; c++) {
      const st = centreStatus(centres[c], now).state;
      const code = st === "open" ? OPEN : st === "pre" ? PRE : st === "lunch" ? LUNCH : CLOSED;
      states[i * NC + c] = code;
      if (i > 0) since[i * NC + c] = states[(i - 1) * NC + c] === code ? Math.min(9999, since[(i - 1) * NC + c] + STEP) : 0;
      // a session that begins on the stroke of midnight UTC has just changed too
      else if (centreStatus(centres[c], new Date(start - STEP * 60_000)).state !== st) since[c] = 0;
      if (code !== CLOSED) {
        const wgt = code === OPEN ? 1 : 0.5;
        sx += Math.cos(centres[c].lon * DEG) * wgt;
        sy += Math.sin(centres[c].lon * DEG) * wgt;
      }
      if (code === OPEN && i < LAST) anyExchange = true;
    }
    if (sx === 0 && sy === 0) {
      // nobody at work: the globe keeps the daylight in view (the place where it is a little after noon)
      const lon = ((720 - i * STEP) / 4 + 15) * DEG;
      sx = Math.cos(lon);
      sy = Math.sin(lon);
    }
    const len = Math.hypot(sx, sy) || 1;
    raw[i * 2] = sx / len;
    raw[i * 2 + 1] = sy / len;
    if (fxWeekOpen(now)) {
      week[i] = 1;
      if (i < LAST) anyWeek = true;
      fxSessions.forEach((s, k) => {
        if (fxSessionOpen(s, now)) fx[i] |= 1 << k;
      });
    }
  }

  // the globe turns smoothly from one region to the next: each step faces the mean of the 75 minutes either side
  const face = new Float32Array(n);
  const reach = 15;
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let j = -reach; j <= reach; j++) {
      const k = Math.min(n - 1, Math.max(0, i + j));
      const wgt = reach + 1 - Math.abs(j);
      sx += raw[k * 2] * wgt;
      sy += raw[k * 2 + 1] * wgt;
    }
    face[i] = Math.atan2(sy, sx) / DEG;
  }

  const bands: [number, number][][] = fxSessions.map((_, k) => {
    const runs: [number, number][] = [];
    let from = -1;
    for (let i = 0; i <= LAST; i++) {
      const on = (fx[i] & (1 << k)) !== 0;
      if (on && from < 0) from = i;
      if (from >= 0 && (!on || i === LAST)) {
        runs.push([from * STEP, i * STEP]);
        from = -1;
      }
    }
    return runs;
  });

  const sun = sunAt(start + DAY_MS / 2);
  const rise = new Float32Array(NC);
  const set = new Float32Array(NC);
  centres.forEach((c, i) => {
    const t = sunTimes(c.lat, c.lon, sun);
    rise[i] = mod(t.rise, 1440);
    set[i] = mod(t.set, 1440);
  });

  const windows = fxSessions.map((s): [number, number] => [utcOf(s.tz, s.open, start), s.close - s.open]);

  const base = { start, weekday: new Date(start).getUTCDay(), states, since, fx, week, face, bands, windows, rise, set, sun, anyExchange, anyWeek };
  const chapters = DEFS.map((d) => {
    // every hour in the timetable is a multiple of five minutes; a zone that was not would land on the step before
    const min = Math.floor(d.at(start) / STEP) * STEP;
    return { id: d.id, title: d.title, lines: d.lines, min, happens: d.happens(base, min / STEP) };
  });
  return { ...base, chapters };
}

/** The chapter the film has reached: the latest one at or before this minute. Of two at the same minute, the one asked for. */
export function chapterAt(table: DayTable, min: number, asked: ChapterId | null): Chapter | null {
  let best: Chapter | null = null;
  for (const c of table.chapters) if (c.min <= min && (!best || c.min >= best.min)) best = c;
  if (best && asked) {
    const want = table.chapters.find((c) => c.id === asked);
    if (want && want.min === best.min) return want;
  }
  return best;
}

/** "08:30", and "24:00" for the end of the day */
export const clockOf = (min: number) => (min >= 1440 ? "24:00" : hhmm(min));

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export type Reading = {
  clock: string;
  /** the FX session or overlap, in words, as the World Market Clock phrases it */
  headline: string;
  open: string[];
  pre: string[];
  lunch: string[];
  /** centres the line between night and day is passing over */
  rising: string[];
  setting: string[];
  /** the whole reading as one sentence, for the scrubber's aria-valuetext */
  valueText: string;
};

/** What the film shows at a minute of the day, in words. */
export function readingAt(table: DayTable, min: number): Reading {
  const i = Math.min(LAST, Math.max(0, Math.floor(min / STEP)));
  const open: string[] = [];
  const pre: string[] = [];
  const lunch: string[] = [];
  const rising: string[] = [];
  const setting: string[] = [];
  centres.forEach((c, k) => {
    const s = table.states[i * NC + k];
    if (s === OPEN) open.push(c.city);
    else if (s === PRE) pre.push(c.city);
    else if (s === LUNCH) lunch.push(c.city);
    if (Math.abs(wrapDay(min - table.rise[k])) <= 15) rising.push(c.city);
    if (Math.abs(wrapDay(min - table.set[k])) <= 15) setting.push(c.city);
  });
  const fxOpen = fxSessions.filter((_, k) => (table.fx[i] & (1 << k)) !== 0).map((s) => s.name);
  const headline = !table.week[i] ? "The FX week is closed" : fxOpen.length >= 2 ? `${fxOpen.join(" × ")} overlap` : fxOpen.length === 1 ? `${fxOpen[0]} session` : "Between FX sessions";
  const clock = clockOf(min);
  const exchanges = open.length ? `Open: ${list(open)}.` : `None of the ${NC} exchanges is in regular hours.`;
  const more = `${lunch.length ? ` Midday break: ${list(lunch)}.` : ""}${pre.length ? ` Pre-open: ${list(pre)}.` : ""}`;
  // the end of the day is the first minute of the next one
  const day = WEEKDAYS[min >= 1440 ? (table.weekday + 1) % 7 : table.weekday];
  return { clock, headline, open, pre, lunch, rising, setting, valueText: `${min >= 1440 ? "00:00" : clock} UTC, ${day}. ${headline}. ${exchanges}${more}` };
}

/** "Wednesday 30 September 2026", the UTC date of the day shown */
export function dateLabel(start: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(start));
}

/** What the film says at a weekend, or null on a day with regular sessions. */
export function weekendNote(table: DayTable): string | null {
  if (table.weekday !== 0 && table.weekday !== 6) return null;
  const day = WEEKDAYS[table.weekday];
  const marks = "The chapter marks show where each moment falls on a trading day.";
  const exchanges = table.anyExchange
    ? `the ${NC} exchanges are closed until the new week begins in the east, late in this UTC day`
    : `none of the ${NC} exchanges has a regular session on this UTC day`;
  if (!table.anyWeek) return `${day} is a weekend: ${exchanges}, and the FX week is closed throughout. ${marks}`;
  let opens = 0;
  while (opens < LAST && !table.week[opens]) opens++;
  // on a Sunday the FX week opens at the hour it closed on Friday: the end of the New York window
  return `${day} is a weekend: ${exchanges}. The FX week opens at ${hhmm(FX_NYC.close)} in New York, which is ${clockOf(opens * STEP)} UTC on this date. ${marks}`;
}
