import { centres, fxSessions, localTime } from "@/lib/sessions";

/**
 * The timetable, by the hour of a UTC day, for the Labs machines that need it.
 * Read from the same tables as the clocks (lib/sessions): the four
 * conventional FX windows and the regular hours of the nine exchanges, each
 * shifted by its city's offset from UTC today. Weekdays only: none of the
 * machines that use this knows about weekends or public holidays, and each
 * says so. Runs in the browser (it reads the device's clock for the offsets).
 */

let offsets: Map<string, number> | null = null;
function offsetOf(tz: string): number {
  if (!offsets) offsets = new Map();
  let v = offsets.get(tz);
  if (v === undefined) {
    const now = new Date();
    const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
    v = ((((localTime(now, tz).minutes - utc + 720) % 1440) + 1440) % 1440) - 720;
    offsets.set(tz, v);
  }
  return v;
}
const localAt = (hour: number, tz: string) => (((hour * 60 + offsetOf(tz)) % 1440) + 1440) % 1440;

/** how many of the four FX windows are open at this UTC hour (may be fractional) */
export function windowsOpen(hour: number): number {
  return fxSessions.filter((s) => {
    const m = localAt(hour, s.tz);
    return m >= s.open && m < s.close;
  }).length;
}

/** for each of the nine centres: is its exchange inside its regular session at this UTC hour? */
export function centresOpen(hour: number): boolean[] {
  return centres.map((c) => {
    const m = localAt(hour, c.tz);
    return m >= c.open && m < c.close && !(c.lunch && m >= c.lunch[0] && m < c.lunch[1]);
  });
}

export const centreNames = centres.map((c) => c.city);
