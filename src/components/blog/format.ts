/**
 * Dates on the daily blog, written the way GIO4X Intelligence writes them:
 * the day, in UTC, with the machine-readable moment beside it in a <time>.
 */
const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const valid = (timestamp: string) => {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "2 October 2026" from a timestamp; "" when it is not a date. */
export const blogLongDate = (timestamp: string) => {
  const d = valid(timestamp);
  return d ? LONG.format(d) : "";
};

/** "2 Oct 2026" from a timestamp; "" when it is not a date. */
export const blogShortDate = (timestamp: string) => {
  const d = valid(timestamp);
  return d ? SHORT.format(d) : "";
};

/** The moment as ISO 8601 in UTC, for `dateTime` attributes, feeds and structured data. */
export const blogIso = (timestamp: string) => valid(timestamp)?.toISOString() ?? timestamp;
