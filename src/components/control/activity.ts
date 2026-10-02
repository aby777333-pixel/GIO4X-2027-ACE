import type { StaffActivityRow } from "@/lib/supabase/types";

/**
 * Team activity: the columns, the words that define them, and the allow-lists
 * the page validates its query parameters against. One list, so the table, the
 * phone layout, the definitions under them and the sort order cannot disagree.
 *
 * The definitions restate staff_activity() in supabase/migrations/0015_activity.sql.
 * Change both together.
 */

/** The periods the screen can cover, in days. */
export const ACTIVITY_PERIODS = [7, 30, 90] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];
export const DEFAULT_ACTIVITY_PERIOD: ActivityPeriod = 30;

type CountKey = {
  [K in keyof StaffActivityRow]: StaffActivityRow[K] extends number ? K : never;
}[keyof StaffActivityRow];

export type ActivityColumn = {
  key: CountKey | "first_reply_median_minutes";
  /** the heading within its group ("Replied to") */
  label: string;
  /** the same heading where the group is not printed beside it ("Tickets replied to") */
  full: string;
  definition: string;
};

export type ActivityGroup = { key: string; label: string; columns: ActivityColumn[] };

export const ACTIVITY_GROUPS: ActivityGroup[] = [
  {
    key: "tickets",
    label: "Tickets",
    columns: [
      {
        key: "tickets_assigned",
        label: "Assigned",
        full: "Tickets assigned",
        definition: "tickets that were given to this person, or that they took, in the period. A ticket is counted once, however many times it changed hands.",
      },
      {
        key: "tickets_replied",
        label: "Replied to",
        full: "Tickets replied to",
        definition: "tickets where this person sent at least one reply to the customer in the period.",
      },
      {
        key: "first_replies",
        label: "First replies",
        full: "First replies given",
        definition: "tickets where the first reply the customer received came from this person and was sent in the period.",
      },
      {
        key: "first_reply_median_minutes",
        label: "Median first reply",
        full: "Median time to first reply",
        definition: "over those first replies, the middle value of the time from the ticket being opened to the reply: half were quicker, half slower. A dash means there were none to measure.",
      },
      {
        key: "tickets_solved",
        label: "Solved",
        full: "Tickets solved",
        definition: "tickets marked solved or closed in the period that are assigned to this person. A ticket reopened since is not counted.",
      },
      {
        key: "ticket_notes",
        label: "Internal notes",
        full: "Internal notes on tickets",
        definition: "internal notes this person wrote on tickets in the period. Customers never see them.",
      },
    ],
  },
  {
    key: "chats",
    label: "Live chat",
    columns: [
      {
        key: "chats_claimed",
        label: "Taken",
        full: "Chats taken",
        definition: "live chats this person took in the period, by taking the conversation or by being the first to answer it.",
      },
      {
        key: "chat_messages",
        label: "Messages sent",
        full: "Chat messages sent",
        definition: "messages this person sent to visitors in live chats in the period.",
      },
      {
        key: "chats_closed",
        label: "Closed",
        full: "Chats closed",
        definition: "live chats this person closed in the period. A chat the visitor ended is not counted.",
      },
    ],
  },
  {
    key: "leads",
    label: "Enquiries",
    columns: [
      {
        key: "leads_assigned",
        label: "Assigned",
        full: "Enquiries assigned",
        definition: "enquiries that were given to this person, or that they took, in the period. An enquiry is counted once.",
      },
      {
        key: "lead_notes",
        label: "Notes",
        full: "Notes on enquiries",
        definition: "internal notes this person wrote on enquiries in the period.",
      },
      {
        key: "tasks_completed",
        label: "Follow-ups completed",
        full: "Follow-ups completed",
        definition: "follow-ups this person marked as completed in the period and that are still completed.",
      },
      {
        key: "stage_changes",
        label: "Stage changes",
        full: "Pipeline stage changes",
        definition: "the number of times this person moved an enquiry to another pipeline stage in the period, taken from the audit log.",
      },
    ],
  },
];

export const LAST_ACTIVITY_DEFINITION =
  "the most recent entry in the audit log made by this person, at any time, not only in the period. Reading a screen leaves no entry, and neither does a chat message, so somebody can have been at work later than this.";

/** What the table can be ordered by: the person's name, any figure, or the last activity. */
export const ACTIVITY_SORTS = ["name", ...ACTIVITY_GROUPS.flatMap((g) => g.columns.map((c) => c.key)), "last_activity"] as const;
export type ActivitySort = "name" | ActivityColumn["key"] | "last_activity";
export type ActivityDir = "asc" | "desc";
export const DEFAULT_ACTIVITY_SORT: ActivitySort = "name";

export function isActivitySort(value: string): value is ActivitySort {
  return (ACTIVITY_SORTS as readonly string[]).includes(value);
}

/** A name reads from A to Z first; a figure reads largest first. */
export function defaultDir(sort: ActivitySort): ActivityDir {
  return sort === "name" ? "asc" : "desc";
}

/** The words for a sort key, for the phone's sort control and for screen readers. */
export function sortLabel(sort: ActivitySort): string {
  if (sort === "name") return "Name";
  if (sort === "last_activity") return "Last activity";
  for (const group of ACTIVITY_GROUPS) {
    const column = group.columns.find((c) => c.key === sort);
    if (column) return column.full;
  }
  return "Name";
}

const byName = (a: StaffActivityRow, b: StaffActivityRow) => a.display_name.localeCompare(b.display_name, "en", { sensitivity: "base" }) || a.user_id.localeCompare(b.user_id);

/**
 * The rows in the chosen order. A missing value (no first reply to measure, no
 * audit entry) is always placed last, whichever way the column is ordered: it
 * is not a small number. Equal values fall back to the name.
 */
export function sortActivity(rows: StaffActivityRow[], sort: ActivitySort, dir: ActivityDir): StaffActivityRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const value = (row: StaffActivityRow): number | null => {
    if (sort === "name") return 0;
    if (sort === "last_activity") {
      const t = row.last_activity ? new Date(row.last_activity).getTime() : Number.NaN;
      return Number.isNaN(t) ? null : t;
    }
    return row[sort];
  };
  return [...rows].sort((a, b) => {
    if (sort === "name") return sign * byName(a, b);
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
    return va === vb ? byName(a, b) : sign * (va - vb);
  });
}

/** The address of the screen for a period and an order. Defaults are left out, so the plain address is the default view. */
export function activityHref(days: ActivityPeriod, sort: ActivitySort = DEFAULT_ACTIVITY_SORT, dir: ActivityDir = defaultDir(sort)): string {
  const query = new URLSearchParams();
  if (days !== DEFAULT_ACTIVITY_PERIOD) query.set("days", String(days));
  if (sort !== DEFAULT_ACTIVITY_SORT) query.set("sort", sort);
  if (dir !== defaultDir(sort)) query.set("dir", dir);
  const text = query.toString();
  return text ? `/control/activity?${text}` : "/control/activity";
}

/** Minutes as a short duration: "45 min", "2 h 5 min", "3 d 4 h". */
export function shortDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 1) return "Under 1 min";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 48) return m === 0 ? `${h} h` : `${h} h ${m} min`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? `${d} d` : `${d} d ${rest} h`;
}

/** True when a value has the shape of one activity row. Anything else is treated as "could not be read", never as zeros. */
export function isActivityRow(value: unknown): value is StaffActivityRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const median = row.first_reply_median_minutes;
  return (
    typeof row.user_id === "string" &&
    typeof row.display_name === "string" &&
    typeof row.role === "string" &&
    typeof row.active === "boolean" &&
    ACTIVITY_GROUPS.every((g) => g.columns.every((c) => (c.key === "first_reply_median_minutes" ? median === null || count(median) : count(row[c.key])))) &&
    (row.last_activity === null || typeof row.last_activity === "string")
  );
}
