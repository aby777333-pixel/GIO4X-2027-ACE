import { CONTACT_TOPICS, LEAD_STAGE_LABEL, LEAD_STAGES } from "@/lib/server/constants";
import type { ReportMonth } from "@/lib/supabase/types";

/**
 * The Reporting Centre's monthly summary: which months can be asked for, and
 * the one list of figures that both the printable page and the CSV download
 * are written from, so the two can never differ.
 *
 * The figures come from report_month() in supabase/migrations/0015_activity.sql.
 * Counts only: nothing here names a person.
 */

/** How many calendar months back the summary is offered for, the current month included. */
export const REPORT_MONTH_COUNT = 12;

export type MonthChoice = {
  /** "YYYY-MM", the only form a month takes in an address or a form field */
  value: string;
  /** "September 2026" */
  label: string;
  /** the month the clock is in: it has not ended, so its figures are not final */
  current: boolean;
};

const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

/** The months on offer, newest first: the current month (UTC) and the eleven before it. */
export function reportMonths(now: Date = new Date()): MonthChoice[] {
  const months: MonthChoice[] = [];
  for (let back = 0; back < REPORT_MONTH_COUNT; back += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthName.format(d),
      current: back === 0,
    });
  }
  return months;
}

/** The month a form field or query parameter names, if it is one of the months on offer. */
export function findReportMonth(value: FormDataEntryValue | string | null | undefined, now: Date = new Date()): MonthChoice | undefined {
  return typeof value === "string" ? reportMonths(now).find((m) => m.value === value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTally(value: unknown): boolean {
  return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.key === "string" && isCount(row.count));
}

/**
 * report_month() returns JSON. These fields are printed as figures, so the
 * shape is checked before it is believed: anything else is treated as "could
 * not be read", never as zeros.
 */
export function isReportMonth(value: unknown): value is ReportMonth {
  if (!isRecord(value)) return false;
  const { leads, tickets, chats, subscribers, follow_ups, blog, incidents } = value;
  if (typeof value.month !== "string" || typeof value.from !== "string" || typeof value.to !== "string" || typeof value.generated_at !== "string" || typeof value.complete !== "boolean") return false;
  if (!isRecord(leads) || !isRecord(tickets) || !isRecord(chats) || !isRecord(subscribers) || !isRecord(follow_ups) || !isRecord(blog) || !isRecord(incidents)) return false;
  const median = tickets.first_response_median_minutes;
  return (
    isCount(leads.total) &&
    isCount(leads.spam) &&
    isCount(leads.other_sources) &&
    [leads.by_topic, leads.by_stage, leads.by_source].every(isTally) &&
    isCount(tickets.opened) &&
    isCount(tickets.answered) &&
    isCount(tickets.solved) &&
    (median === null || isCount(median)) &&
    isCount(chats.started) &&
    isCount(chats.answered) &&
    isCount(subscribers.joined) &&
    isCount(subscribers.left) &&
    isCount(follow_ups.created) &&
    isCount(follow_ups.completed) &&
    isCount(blog.published) &&
    isCount(incidents.created) &&
    isCount(incidents.published)
  );
}

/** One figure. `value` is null only where there is nothing to measure (a median with no answered ticket): that is not zero. */
export type MonthFigure = { metric: string; value: number | null };
export type MonthSection = { key: string; title: string; note?: string; figures: MonthFigure[] };

/** The header of the CSV download, and its rows: the month's own facts first, then every figure of monthSections(). */
export const MONTH_CSV_HEADER = ["section", "metric", "value"];

export function monthCsvRows(summary: ReportMonth): (string | number | null)[][] {
  return [
    ["Summary", "Month", summary.month],
    ["Summary", "From (UTC, inclusive)", summary.from],
    ["Summary", "To (UTC, exclusive)", summary.to],
    ["Summary", "Counted at (UTC)", summary.generated_at],
    ["Summary", "Month has ended", summary.complete ? "yes" : "no"],
    // an empty value is "nothing to measure" (a median with no answered ticket); a count of zero is written as 0
    ...monthSections(summary).flatMap((section) => section.figures.map((figure) => [section.title, figure.metric, figure.value])),
  ];
}

/** A breakdown with every known key present, zero where the database returned no row for it; an unknown key is kept as it is. */
function filled(tally: { key: string; count: number }[], known: readonly string[], label: (key: string) => string): MonthFigure[] {
  const counts = new Map(tally.map((row) => [row.key, row.count]));
  const extra = tally.filter((row) => !known.includes(row.key));
  return [...known.map((key) => ({ metric: label(key), value: counts.get(key) ?? 0 })), ...extra.map((row) => ({ metric: row.key, value: row.count }))];
}

/**
 * The month's figures, in the order they are printed and exported. Every
 * number is one the database counted; a count of zero is the number 0.
 */
export function monthSections(summary: ReportMonth): MonthSection[] {
  const stageLabel = (key: string) => (Object.prototype.hasOwnProperty.call(LEAD_STAGE_LABEL, key) ? LEAD_STAGE_LABEL[key as keyof typeof LEAD_STAGE_LABEL] : key);
  const sources: MonthFigure[] = summary.leads.by_source.length
    ? summary.leads.by_source.map((row) => ({ metric: row.key === "direct" ? "Direct (no campaign link)" : row.key, value: row.count }))
    : [{ metric: "Direct (no campaign link)", value: 0 }];
  // the database lists the twelve largest sources; whatever is left is one row, so the column adds up to the total
  if (summary.leads.by_source.length >= 12 || summary.leads.other_sources > 0) sources.push({ metric: "All other sources", value: summary.leads.other_sources });

  return [
    {
      key: "enquiries",
      title: "Enquiries",
      note: "Received in the month. Spam is counted on its own and is not in the total or in the breakdowns.",
      figures: [
        { metric: "Enquiries received", value: summary.leads.total },
        { metric: "Marked as spam", value: summary.leads.spam },
      ],
    },
    { key: "topic", title: "Enquiries by topic", figures: filled(summary.leads.by_topic, CONTACT_TOPICS, (key) => key) },
    {
      key: "stage",
      title: "Enquiries by pipeline stage",
      note: "The stage each of the month’s enquiries is at now.",
      figures: filled(summary.leads.by_stage, LEAD_STAGES, stageLabel),
    },
    {
      key: "source",
      title: "Enquiries by source",
      note: "The campaign link the enquirer arrived by (utm_source), or Direct when there was none. An enquiry entered by staff carries how it came about.",
      figures: sources,
    },
    {
      key: "support",
      title: "Support tickets",
      note: "Answered counts the tickets opened in the month that have had a first reply. Solved counts tickets solved in the month, whenever they were opened. The median is over the answered tickets.",
      figures: [
        { metric: "Tickets opened", value: summary.tickets.opened },
        { metric: "Answered", value: summary.tickets.answered },
        { metric: "Solved", value: summary.tickets.solved },
        { metric: "Median time to first reply (minutes)", value: summary.tickets.first_response_median_minutes },
      ],
    },
    {
      key: "chat",
      title: "Live chat",
      note: "Answered means a member of staff took the conversation.",
      figures: [
        { metric: "Chats started", value: summary.chats.started },
        { metric: "Answered by staff", value: summary.chats.answered },
      ],
    },
    {
      key: "newsletter",
      title: "Newsletter",
      figures: [
        { metric: "Joined", value: summary.subscribers.joined },
        { metric: "Left", value: summary.subscribers.left },
      ],
    },
    {
      key: "follow-ups",
      title: "Follow-ups",
      note: "Completed counts follow-ups completed in the month, whenever they were created.",
      figures: [
        { metric: "Created", value: summary.follow_ups.created },
        { metric: "Completed", value: summary.follow_ups.completed },
      ],
    },
    {
      key: "blog",
      title: "Blog",
      figures: [{ metric: "Posts published", value: summary.blog.published }],
    },
    {
      key: "status",
      title: "Status page notices",
      note: "Notices written by staff. They are not monitoring and say nothing about uptime.",
      figures: [
        { metric: "Incidents posted", value: summary.incidents.created },
        { metric: "Of those, published on the Status page", value: summary.incidents.published },
      ],
    },
  ];
}
