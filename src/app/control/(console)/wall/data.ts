/**
 * What the wallboard reads, in one place so that the page (first render) and
 * the feed (every twenty seconds afterwards) cannot drift apart.
 *
 * Everything is read AS THE SIGNED-IN MEMBER OF STAFF. The figures come from
 * command_summary() (0009), which refuses anyone without command.read, and
 * from tickets_overdue() (0013), of which only how far past its target each
 * ticket is leaves the database. Three things the two functions do not carry
 * are read beside them, each only if the caller's role may read that table:
 * when the longest-waiting chat began to wait, and how many tickets and chats
 * began in the last 24 hours. Row-level security answers those as it would on
 * the Tickets and Live Chats screens.
 *
 * What is returned is counts and durations only: no name, no address, no
 * subject. The board is made for a shared screen.
 */
import type { WallFeed } from "@/components/control/views/WallView";
import { can, type StaffContext } from "@/lib/server/staff";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The named field of `group` as a count, or null when it is not one. */
function count(group: unknown, key: string): number | null {
  if (!isRecord(group)) return null;
  const v = group[key];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The board's figures, or null when the summary could not be read (never zeros in its place). */
export async function readWall(ctx: Pick<StaffContext, "supabase" | "caps">): Promise<WallFeed | null> {
  const { supabase } = ctx;
  try {
    const summary = await supabase.rpc("command_summary");
    const s = summary.data;
    if (summary.error || !isRecord(s) || typeof s.at !== "string") return null;
    const at = Date.parse(s.at);
    if (Number.isNaN(at)) return null;

    const waiting = count(s.chats, "waiting");
    const active = count(s.chats, "active");
    const staffOnline = count(s.chats, "staff_online");
    const unanswered = count(s.tickets, "unanswered");
    const late = count(s.tickets, "late");
    const unassigned = count(s.leads, "unassigned");
    const leads24 = count(s.leads, "last_24h");
    const overdue = count(s.follow_ups, "overdue");
    const incidentsOpen = count(s.site, "incidents_open");
    const enabled = isRecord(s.chats) ? s.chats.enabled : undefined;
    if (waiting === null || active === null || staffOnline === null || unanswered === null || late === null || unassigned === null || leads24 === null || overdue === null || incidentsOpen === null || typeof enabled !== "boolean") {
      return null;
    }

    // the same 24 hours command_summary() counted enquiries over, by the database's own clock
    const since = new Date(at - DAY_MS).toISOString();
    const seesTickets = can(ctx, "tickets.read");
    const seesChats = can(ctx, "chats.read");

    const [overdueRows, longest, tickets24, chats24] = await Promise.all([
      // only the one column: the names and addresses in the function's answer never leave the database
      seesTickets && late > 0 ? supabase.rpc("tickets_overdue").select("hours_overdue") : null,
      seesChats && waiting > 0 ? supabase.from("chat_conversations").select("created_at").eq("status", "waiting").order("created_at", { ascending: true }).limit(1) : null,
      seesTickets ? supabase.from("tickets").select("id", { count: "exact", head: true }).gt("created_at", since) : null,
      seesChats ? supabase.from("chat_conversations").select("id", { count: "exact", head: true }).gt("created_at", since) : null,
    ]);

    // a chat waits from the moment it is started until somebody takes it
    const waitingSince = longest && !longest.error ? Date.parse(longest.data?.[0]?.created_at ?? "") : Number.NaN;
    const hours = overdueRows && !overdueRows.error ? (overdueRows.data ?? []).map((row) => Number(row.hours_overdue)).filter((h) => Number.isFinite(h) && h >= 0) : [];

    return {
      ok: true,
      at: new Date(at).toISOString(),
      chats: {
        waiting,
        active,
        staffOnline,
        enabled,
        longestWaitSeconds: Number.isNaN(waitingSince) ? null : Math.max(0, Math.round((at - waitingSince) / 1000)),
        last24h: chats24 && !chats24.error && chats24.count !== null ? chats24.count : null,
      },
      tickets: {
        unanswered,
        late,
        oldestLateHours: hours.length ? Math.max(...hours) : null,
        last24h: tickets24 && !tickets24.error && tickets24.count !== null ? tickets24.count : null,
      },
      leads: { unassigned, last24h: leads24 },
      followUps: { overdue },
      incidentsOpen,
    };
  } catch {
    return null;
  }
}
