/**
 * Saved views: what the list screens, the dashboard and the server actions
 * share. A view is a list screen's own address with some of its filters set,
 * given a name by the person who saved it (table `staff_views`, 0018).
 *
 * The one rule everything here serves: a view holds filter CHOICES and
 * nothing else. Each screen lists the filter keys it has and, for each, the
 * values it accepts (the same constants the screen's page validates its query
 * parameters against). `cleanViewParams` keeps a pair only when both are on
 * the list, so whatever arrives (a form, a row read back from the database) a
 * view can never carry free text. There is deliberately no key for the search
 * box: what somebody typed there could be a customer's e-mail address.
 *
 * Pure functions only: nothing here reads the database, the clock or the
 * browser, so the same code runs in the page, the action and the view.
 */
import { BLOG_FILTER_LABEL, BLOG_FILTERS } from "@/components/control/views/blog-shared";
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABEL } from "@/lib/blog";
import {
  CONTACT_TOPICS,
  LEAD_STAGE_LABEL,
  LEAD_STAGES,
  LEAD_STATUS_LABEL,
  LEAD_STATUSES,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUSES,
  type Capability,
} from "@/lib/server/constants";

/** The screens a view can be saved for. Must equal `staff_views_screen_valid` in 0018_personal.sql. */
export const VIEW_SCREEN_KEYS = ["leads", "tickets", "tasks", "blog"] as const;
export type ViewScreen = (typeof VIEW_SCREEN_KEYS)[number];

/** Filter key to chosen value. Only allow-listed pairs, in the screen's own order. */
export type ViewParams = Record<string, string>;

/** Must equal `staff_views_name_valid` and the cap in staff_views_before_write() (0018). */
export const VIEW_NAME_MAX = 60;
export const VIEW_LIMIT = 30;

type ParamSpec = {
  key: string;
  /** what the screen calls this filter */
  label: string;
  values: readonly string[];
  /** the chosen value in words, as the screen's own control says it */
  say: (value: string) => string;
};

type ScreenSpec = {
  /** the screen's name in the menu */
  label: string;
  path: string;
  /** what a person needs to open the screen at all */
  cap: Capability;
  /** what the screen lists: one, many */
  noun: readonly [string, string];
  /** the screen with no filter set, in words */
  unfiltered: string;
  /** Must list the same keys as staff_view_params_ok() in 0018_personal.sql. */
  params: readonly ParamSpec[];
};

const from = <K extends string>(labels: Record<K, string>) => (value: string) => labels[value as K] ?? value;

export const VIEW_SCREENS: Record<ViewScreen, ScreenSpec> = {
  leads: {
    label: "Leads",
    path: "/control/leads",
    cap: "leads.read",
    noun: ["enquiry", "enquiries"],
    unfiltered: "Every enquiry, newest first",
    params: [
      { key: "status", label: "Status", values: LEAD_STATUSES, say: from(LEAD_STATUS_LABEL) },
      { key: "stage", label: "Stage", values: LEAD_STAGES, say: from(LEAD_STAGE_LABEL) },
      { key: "topic", label: "Topic", values: CONTACT_TOPICS, say: (v) => v },
      { key: "origin", label: "Came from", values: ["website", "staff"], say: (v) => (v === "staff" ? "Entered or imported by staff" : "The website’s forms") },
      { key: "who", label: "Assigned to", values: ["mine"], say: () => "Me" },
      { key: "sort", label: "Order", values: ["score"], say: () => "Highest score first" },
    ],
  },
  tickets: {
    label: "Tickets",
    path: "/control/tickets",
    cap: "tickets.read",
    noun: ["ticket", "tickets"],
    unfiltered: "Tickets that need work (open, or waiting for the customer)",
    params: [
      { key: "overdue", label: "Overdue", values: ["1"], say: () => "Past the reply target" },
      { key: "status", label: "Status", values: [...TICKET_STATUSES, "all"], say: (v) => (v === "all" ? "All" : from(TICKET_STATUS_LABEL)(v)) },
      { key: "category", label: "Category", values: TICKET_CATEGORIES, say: from(TICKET_CATEGORY_LABEL) },
      { key: "priority", label: "Priority", values: TICKET_PRIORITIES, say: from(TICKET_PRIORITY_LABEL) },
      { key: "who", label: "Assigned to", values: ["mine", "unassigned"], say: (v) => (v === "mine" ? "Me" : "Nobody yet") },
    ],
  },
  tasks: {
    label: "Follow-ups",
    path: "/control/tasks",
    cap: "leads.read",
    noun: ["follow-up", "follow-ups"],
    unfiltered: "Your open follow-ups",
    params: [
      { key: "who", label: "Whose", values: ["all"], say: () => "Everyone’s" },
      { key: "show", label: "Showing", values: ["done"], say: () => "Completed" },
    ],
  },
  blog: {
    label: "Blog",
    path: "/control/blog",
    cap: "blog.read",
    noun: ["post", "posts"],
    unfiltered: "Every post",
    params: [
      { key: "status", label: "Status", values: BLOG_FILTERS, say: from(BLOG_FILTER_LABEL) },
      { key: "category", label: "Category", values: BLOG_CATEGORIES, say: from(BLOG_CATEGORY_LABEL) },
    ],
  },
};

export function isViewScreen(value: unknown): value is ViewScreen {
  return typeof value === "string" && (VIEW_SCREEN_KEYS as readonly string[]).includes(value);
}

/**
 * What a view may hold, out of whatever was offered: for each of the screen's
 * filter keys, the value if (and only if) it is one the screen accepts.
 * Anything else is dropped without a word, exactly as the screen's page drops
 * a query parameter it does not know.
 */
export function cleanViewParams(screen: ViewScreen, read: (key: string) => unknown): ViewParams {
  const out: ViewParams = {};
  for (const spec of VIEW_SCREENS[screen].params) {
    const value = read(spec.key);
    if (typeof value === "string" && spec.values.includes(value)) out[spec.key] = value;
  }
  // the Tickets page ignores Status while "Overdue only" is on (overdue tickets are always open)
  if (screen === "tickets" && out.overdue) delete out.status;
  return out;
}

/** A stored `params` value (JSON from the database) reduced to what the screen accepts. */
export function viewParamsFrom(screen: ViewScreen, stored: unknown): ViewParams {
  const bag = typeof stored === "object" && stored !== null && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  return cleanViewParams(screen, (key) => bag[key]);
}

/** The screen's own address with these filters. `extra` adds fixed outcome codes, never anything typed. */
export function viewHref(screen: ViewScreen, params: ViewParams, extra?: Record<string, string>): string {
  const sp = new URLSearchParams();
  const clean = cleanViewParams(screen, (key) => params[key]);
  for (const [key, value] of Object.entries(clean)) sp.set(key, value);
  for (const [key, value] of Object.entries(extra ?? {})) sp.set(key, value);
  const query = sp.toString();
  return query ? `${VIEW_SCREENS[screen].path}?${query}` : VIEW_SCREENS[screen].path;
}

/** The filters of a view as label and value pairs, in the screen's order. Empty when no filter is set. */
export function viewFacts(screen: ViewScreen, params: ViewParams): { label: string; value: string }[] {
  const clean = cleanViewParams(screen, (key) => params[key]);
  return VIEW_SCREENS[screen].params.filter((spec) => clean[spec.key] !== undefined).map((spec) => ({ label: spec.label, value: spec.say(clean[spec.key] ?? "") }));
}

/** The same in one line: "Status: Open · Assigned to: Me", or what the screen shows with no filter. */
export function describeView(screen: ViewScreen, params: ViewParams): string {
  const facts = viewFacts(screen, params);
  return facts.length ? facts.map((f) => `${f.label}: ${f.value}`).join(" · ") : VIEW_SCREENS[screen].unfiltered;
}

export function sameViewParams(screen: ViewScreen, a: ViewParams, b: ViewParams): boolean {
  return viewHref(screen, a) === viewHref(screen, b);
}

/** A saved view as the screens and the dashboard show it. `params` has already been through cleanViewParams. */
export type SavedView = { id: string; screen: ViewScreen; name: string; pinned: boolean; params: ViewParams };

/* -------------------------------------------------------------------------- */
/* outcomes                                                                   */
/* -------------------------------------------------------------------------- */

/** The query parameter the view actions answer in, so it never collides with a screen's own `notice` and `error`. */
export const VIEW_OUTCOME_PARAM = "vw";

export const VIEW_OUTCOMES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "View saved." },
  renamed: { tone: "ok", text: "View renamed." },
  pinned: { tone: "ok", text: "View pinned. It is on your dashboard, under “Your desk”, with a live count." },
  unpinned: { tone: "ok", text: "View unpinned. It is still saved here; it is no longer on your dashboard." },
  deleted: { tone: "ok", text: "View deleted." },
  name: { tone: "error", text: `A view needs a name of 1 to ${VIEW_NAME_MAX} characters, without an “@”. Nothing was saved.` },
  full: { tone: "error", text: `You already have ${VIEW_LIMIT} saved views, which is the most one person can keep. Delete one first. Nothing was saved.` },
  invalid: { tone: "error", text: "That request was not valid. Nothing was changed." },
  forbidden: { tone: "error", text: "Your role does not include this screen. Nothing was changed." },
  gone: { tone: "error", text: "That view no longer exists. Nothing was changed." },
  save: { tone: "error", text: "The view could not be saved. Nothing was changed; please try again." },
};
