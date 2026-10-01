/**
 * Small time helpers shared by the Market Day Ribbon and the World Market
 * Clock. Everything is derived from the visitor's clock and the browser's
 * IANA time-zone database: a schedule, not a data feed.
 */
import { localTime } from "@/lib/sessions";

/** The axis choices offered on the clock. `local` resolves to the visitor's own zone. */
export const ZONES = [
  { key: "local", label: "Your time", long: "your local time" },
  { key: "UTC", label: "UTC", long: "UTC" },
  { key: "Europe/London", label: "London", long: "London time" },
  { key: "America/New_York", label: "New York", long: "New York time" },
] as const;

export type ZoneKey = (typeof ZONES)[number]["key"];

export const isZoneKey = (v: string): v is ZoneKey => ZONES.some((z) => z.key === v);

export const zoneMeta = (key: string) => ZONES.find((z) => z.key === key) ?? ZONES[1];

/** IANA id for an axis choice. Only call on the client for `local`. */
export function zoneId(key: string): string {
  if (key !== "local") return key;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const utcMinutes = (now: Date) => now.getUTCHours() * 60 + now.getUTCMinutes();

/** Zone offset from UTC in minutes at `now` (local − UTC), normalised to one day. */
export function zoneOffset(now: Date, tz: string): number {
  let off = localTime(now, tz).minutes - utcMinutes(now);
  if (off > 840) off -= 1440;
  if (off < -720) off += 1440;
  return off;
}

export const wrapDay = (m: number) => ((m % 1440) + 1440) % 1440;

/** "07:30" from minutes after midnight. */
export function hhmm(m: number): string {
  const w = wrapDay(Math.round(m));
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
}

/** "UTC+1", "UTC−4", "UTC+5:30". */
export function offsetLabel(off: number): string {
  if (off === 0) return "UTC";
  const a = Math.abs(off);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${off > 0 ? "+" : "−"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export type Seg = [number, number];

/** A window on a 24-hour axis, split in two when it runs past midnight. */
export function splitDay(start: number, end: number): Seg[] {
  if (start === end) return [];
  if (end > start) return [[start, end]];
  const out: Seg[] = [[start, 1440]];
  if (end > 0) out.push([0, end]);
  return out;
}

export function intersect(a: Seg[], b: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const [as, ae] of a)
    for (const [bs, be] of b) {
      const s = Math.max(as, bs);
      const e = Math.min(ae, be);
      if (e > s) out.push([s, e]);
    }
  return out;
}
