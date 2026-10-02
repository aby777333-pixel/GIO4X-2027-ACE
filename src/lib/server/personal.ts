/**
 * What belongs to one member of staff: their saved views, the "Your desk"
 * section of the dashboard, and their notifications (0018_personal.sql).
 *
 * Everything is read AS THE SIGNED-IN USER. Row-level security returns a
 * person's own views and notifications and nobody else's, whatever is asked;
 * the counts on the desk are the list screens' own queries
 * (src/lib/server/lists), so they obey the same policies as the lists.
 */
import { NOTIFY_COLUMNS, notifyItem, type NotifyItem } from "@/components/control/notify";
import { isViewScreen, VIEW_OUTCOME_PARAM, VIEW_SCREENS, viewHref, viewParamsFrom, type SavedView, type ViewScreen } from "@/components/control/views-shared";
import { firstParam } from "@/components/control/format";
import { countBlogView } from "@/lib/server/lists/blog";
import { countLeadsView } from "@/lib/server/lists/leads";
import { countTasksView } from "@/lib/server/lists/tasks";
import { countTicketsView } from "@/lib/server/lists/tickets";
import { can, type StaffContext } from "@/lib/server/staff";
import type { Db } from "@/lib/supabase/server";
import type { StaffViewRow } from "@/lib/supabase/types";

type Ctx = Pick<StaffContext, "supabase" | "userId" | "caps">;

const VIEW_COLUMNS = "id, screen, name, params, pinned, position";

function savedView(row: Pick<StaffViewRow, "id" | "screen" | "name" | "params" | "pinned">): SavedView | null {
  if (!isViewScreen(row.screen)) return null;
  // what the database holds is reduced again to what the screen accepts: a row is not trusted more than a form
  return { id: row.id, screen: row.screen, name: row.name, pinned: row.pinned, params: viewParamsFrom(row.screen, row.params) };
}

/* -------------------------------------------------------------------------- */
/* a list screen's "Views" control                                            */
/* -------------------------------------------------------------------------- */

/** What a list screen hands to <ViewsControl />. */
export type ViewsData = {
  saved: SavedView[];
  /** the views could not be read (for example 0018 is not applied yet): the screen itself is unaffected */
  failed: boolean;
  /** the fixed code a view action answered with, or "" */
  outcome: string;
};

/** The caller's saved views for one screen, in the order they keep them. Never throws. */
export async function readViews(ctx: Ctx, screen: ViewScreen, params: Record<string, string | string[] | undefined>): Promise<ViewsData> {
  const outcome = firstParam(params[VIEW_OUTCOME_PARAM]);
  try {
    const { data, error } = await ctx.supabase.from("staff_views").select(VIEW_COLUMNS).eq("screen", screen).order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) return { saved: [], failed: true, outcome };
    return { saved: (data ?? []).map(savedView).filter((v): v is SavedView => v !== null), failed: false, outcome };
  } catch {
    return { saved: [], failed: true, outcome };
  }
}

/* -------------------------------------------------------------------------- */
/* the dashboard's "Your desk"                                                */
/* -------------------------------------------------------------------------- */

export type DeskPin = {
  id: string;
  name: string;
  screen: ViewScreen;
  href: string;
  /** how many rows the view matches now; null when it could not be counted */
  count: number | null;
  /** the person's role no longer includes the screen the view was saved on */
  noAccess: boolean;
};

export type DeskData = {
  pins: DeskPin[];
  /** the pinned views could not be read */
  pinsFailed: boolean;
  /** each is null when the person's role does not include it, and `count: null` when it could not be counted */
  myTickets: { count: number | null } | null;
  myLeads: { count: number | null } | null;
  followUps: { overdue: number | null; today: number | null } | null;
  chatsWaiting: { count: number | null } | null;
};

function countView(supabase: Db, view: SavedView, me: string, nowIso: string): Promise<number | null> {
  if (view.screen === "leads") return countLeadsView(supabase, view.params, me);
  if (view.screen === "tickets") return countTicketsView(supabase, view.params, me);
  if (view.screen === "tasks") return countTasksView(supabase, view.params, me);
  return countBlogView(supabase, view.params, nowIso);
}

const settled = async (work: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
  try {
    const { count, error } = await work;
    return error || count === null ? null : count;
  } catch {
    return null;
  }
};

/**
 * The person's pinned views, each with the number of rows it matches at this
 * moment, and the fixed personal figures. Every figure is a count of real
 * rows; one that cannot be counted is null, never zero. Never throws.
 */
export async function readDesk(ctx: Ctx, now: number): Promise<DeskData> {
  const { supabase, userId } = ctx;
  const nowIso = new Date(now).toISOString();
  // the end of today, UTC: the console shows one clock for everyone
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(24, 0, 0, 0);
  const endIso = endOfDay.toISOString();

  const seesTickets = can(ctx, "tickets.read");
  const seesLeads = can(ctx, "leads.read");
  const seesChats = can(ctx, "chats.read");

  let pinned: SavedView[] = [];
  let pinsFailed = false;
  try {
    const { data, error } = await supabase.from("staff_views").select(VIEW_COLUMNS).eq("pinned", true).order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) pinsFailed = true;
    else pinned = (data ?? []).map(savedView).filter((v): v is SavedView => v !== null);
  } catch {
    pinsFailed = true;
  }

  const [counts, myTickets, myLeads, overdue, today, chats] = await Promise.all([
    Promise.all(pinned.map((view) => (can(ctx, VIEW_SCREENS[view.screen].cap) ? countView(supabase, view, userId, nowIso).catch(() => null) : null))),
    // open or waiting for the customer, and mine: exactly what /control/tickets?who=mine lists
    seesTickets ? settled(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("assigned_to", userId).in("status", ["open", "pending"])) : null,
    // mine and still in progress (not resolved, not spam)
    seesLeads ? settled(supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", userId).in("status", ["new", "open", "waiting"])) : null,
    seesLeads ? settled(supabase.from("lead_tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).eq("done", false).lt("due_at", nowIso)) : null,
    seesLeads ? settled(supabase.from("lead_tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).eq("done", false).gte("due_at", nowIso).lt("due_at", endIso)) : null,
    seesChats ? settled(supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("status", "waiting")) : null,
  ]);

  return {
    pins: pinned.map((view, i) => ({
      id: view.id,
      name: view.name,
      screen: view.screen,
      href: viewHref(view.screen, view.params),
      count: counts[i] ?? null,
      noAccess: !can(ctx, VIEW_SCREENS[view.screen].cap),
    })),
    pinsFailed,
    myTickets: seesTickets ? { count: myTickets } : null,
    myLeads: seesLeads ? { count: myLeads } : null,
    followUps: seesLeads ? { overdue, today } : null,
    chatsWaiting: seesChats ? { count: chats } : null,
  };
}

/* -------------------------------------------------------------------------- */
/* notifications                                                              */
/* -------------------------------------------------------------------------- */

export type NotificationsPage = {
  items: NotifyItem[];
  /** how many notifications the person has in all */
  total: number;
  unread: number;
  failed: boolean;
  /** the page asked for is past the end */
  pastEnd: boolean;
};

/**
 * A page of the caller's notifications, newest first, and how many are
 * unread. Row-level security returns only the caller's own. Never throws.
 */
export async function readNotifications(supabase: Db, limit: number, offset = 0): Promise<NotificationsPage> {
  const nothing: NotificationsPage = { items: [], total: 0, unread: 0, failed: true, pastEnd: false };
  try {
    const [list, unread] = await Promise.all([
      supabase.from("staff_notifications").select(NOTIFY_COLUMNS, { count: "exact" }).order("id", { ascending: false }).range(offset, offset + limit - 1),
      supabase.from("staff_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    // PGRST103: the requested page is past the end of the result
    const pastEnd = list.error?.code === "PGRST103";
    if ((list.error && !pastEnd) || unread.error) return nothing;
    return {
      items: (list.data ?? []).map(notifyItem).filter((i): i is NotifyItem => i !== null),
      total: list.count ?? 0,
      unread: unread.count ?? 0,
      failed: false,
      pastEnd,
    };
  } catch {
    return nothing;
  }
}
