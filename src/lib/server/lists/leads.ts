/**
 * The Leads list's filters, in one place.
 *
 * Two things ask the same question of the `leads` table: the list screen
 * (/control/leads), which wants a page of rows, and a saved view pinned to
 * the dashboard, which wants only how many rows there are. Both build their
 * query here, so a pinned view's count can never mean something different
 * from the list it opens.
 */
import { LEAD_LIST_COLUMNS } from "@/components/control/LeadsTable";
import { viewParamsFrom, type ViewParams } from "@/components/control/views-shared";
import type { Db } from "@/lib/supabase/server";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

export type LeadFilters = {
  status: LeadStatus | "";
  stage: LeadStage | "";
  topic: string;
  /** "staff" only those entered or imported by staff; "website" only those from the forms */
  origin: "staff" | "website" | "";
  /** "mine" is the enquiries assigned to the caller */
  who: "mine" | "";
  /** already through cleanSearch(): only [A-Za-z0-9@._+-] */
  q: string;
};

/**
 * `leads` with the filters applied, read as the signed-in member of staff.
 * The caller adds the order and the range. With `head` the database returns
 * the count and no rows.
 */
export function leadsFiltered(supabase: Db, f: LeadFilters, me: string, head = false) {
  let query = supabase.from("leads").select(LEAD_LIST_COLUMNS, { count: "exact", head });
  if (f.status) query = query.eq("status", f.status);
  if (f.stage) query = query.eq("stage", f.stage);
  if (f.topic) query = query.eq("topic", f.topic);
  if (f.origin) query = query.eq("origin", f.origin);
  if (f.who === "mine") query = query.eq("assigned_to", me);
  // q contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  if (f.q) query = query.or(`reference.ilike."%${f.q}%",email.ilike."%${f.q}%"`);
  return query;
}

/** How many enquiries a saved view matches now. Null when it could not be counted. */
export async function countLeadsView(supabase: Db, stored: ViewParams, me: string): Promise<number | null> {
  const p = viewParamsFrom("leads", stored);
  const f: LeadFilters = {
    status: (p.status ?? "") as LeadStatus | "",
    stage: (p.stage ?? "") as LeadStage | "",
    topic: p.topic ?? "",
    origin: p.origin === "staff" || p.origin === "website" ? p.origin : "",
    who: p.who === "mine" ? "mine" : "",
    q: "",
  };
  const { count, error } = await leadsFiltered(supabase, f, me, true);
  return error || count === null ? null : count;
}
