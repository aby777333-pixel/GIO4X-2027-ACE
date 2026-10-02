/**
 * The editorial calendar's arithmetic: months, days and the grid, all in UTC.
 *
 * The console shows one clock for everyone (UTC, labelled), so a "day" here is
 * a UTC day: a post scheduled for 23:30 UTC sits on that UTC date whatever the
 * reader's own time zone says. Keys are plain strings ("2026-10" for a month,
 * "2026-10-14" for a day) because they sort and compare as text.
 *
 * Pure: nothing here reads the clock (the caller passes `now`), the database
 * or the browser. scripts/test-blog-calendar.mjs runs it in Node.
 */

/** The time a post dropped on a day is scheduled for, unless the publisher changes it. UTC. */
export const CALENDAR_DEFAULT_TIME = "09:00";

/** The first month the calendar opens. Must agree with parseWhen in blog-shared.ts, which accepts no moment before 2020. */
export const CALENDAR_FIRST_MONTH = "2020-01";
/** How far ahead the calendar opens: parseWhen accepts a moment up to about five years from now. */
const YEARS_AHEAD = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_KEY = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** The UTC month a moment falls in. */
export function monthKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** The UTC day a moment falls in. */
export function dayKeyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The UTC day of a stored time, or "" when it is not a time. */
export function dayKeyOfIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : dayKeyOf(ms);
}

/** The UTC time of day of a stored time as "HH:MM", or "" when it is not a time. */
export function timeOfIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(11, 16);
}

/** The last month the calendar opens, counted from `now`. */
export function lastMonth(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear() + YEARS_AHEAD}-${pad(d.getUTCMonth() + 1)}`;
}

/** Whether `value` is a month the calendar opens: well formed, and between 2020 and five years ahead. */
export function isCalendarMonth(value: unknown, now: number): value is string {
  return typeof value === "string" && MONTH_KEY.test(value) && value >= CALENDAR_FIRST_MONTH && value <= lastMonth(now);
}

/** The month asked for in the query string, or the current month when it is missing or not one the calendar opens. */
export function readMonth(raw: string, now: number): string {
  return isCalendarMonth(raw, now) ? raw : monthKeyOf(now);
}

/** The month `delta` months away, or null when that is outside what the calendar opens. */
export function shiftMonth(month: string, delta: number, now: number): string | null {
  const m = MONTH_KEY.exec(month);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  const next = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  return isCalendarMonth(next, now) ? next : null;
}

/** A real calendar day: "2026-02-31" is not one. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && dayKeyOf(ms) === value;
}

/** A day that ended before `now` did, in UTC. Today is not past. */
export function isPastDay(day: string, now: number): boolean {
  return day < dayKeyOf(now);
}

export type CalendarGrid = {
  month: string;
  /** whole weeks, Monday first: the month's days and the few of its neighbours that complete the first and last week */
  days: string[];
  /** the first moment of the first day shown, and the first moment after the last: the range to read posts for */
  from: string;
  to: string;
};

/** The weeks a month is drawn in. Monday first, as the working week runs. */
export function monthGrid(month: string): CalendarGrid | null {
  const m = MONTH_KEY.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const index = Number(m[2]) - 1;
  const first = Date.UTC(year, index, 1);
  const last = Date.UTC(year, index + 1, 0);
  // getUTCDay: Sunday is 0. Steps back to the Monday on or before the 1st, forward to the Sunday on or after the last day.
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY_MS;
  const end = last + ((7 - new Date(last).getUTCDay()) % 7) * DAY_MS;
  const days: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) days.push(dayKeyOf(t));
  return { month, days, from: new Date(start).toISOString(), to: new Date(end + DAY_MS).toISOString() };
}

/** The grid cut into weeks of seven days. */
export function weeksOf(days: readonly string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// Names are written out here rather than asked of Intl: the server and the browser can carry different
// locale data ("Wednesday, 14 October" against "Wednesday 14 October"), and the two must print the same words.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** "October 2026" */
export function monthLabel(month: string): string {
  const m = MONTH_KEY.exec(month);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

/** The name of a day's weekday. */
function weekdayOf(day: string): string {
  return WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];
}

/** "Wednesday 14 October 2026" */
export function dayLabel(day: string): string {
  return isDayKey(day) ? `${weekdayOf(day)} ${dayNumber(day)} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}` : "";
}

/** "Wed 14 Oct" */
export function dayShortLabel(day: string): string {
  return isDayKey(day) ? `${weekdayOf(day).slice(0, 3)} ${dayNumber(day)} ${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)}` : "";
}

/** The day of the month, 1 to 31. */
export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}
