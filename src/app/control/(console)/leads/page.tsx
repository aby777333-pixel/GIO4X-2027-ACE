import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { LEAD_LIST_COLUMNS, type LeadListItem } from "@/components/control/LeadsTable";
import { LeadsView } from "@/components/control/views/LeadsView";
import { CONTACT_TOPICS, LEAD_STAGES, LEAD_STATUSES } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Leads", "/control/leads");

const PER_PAGE = 25;

const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
};

/**
 * All enquiries, newest first. Filters and search arrive as query parameters
 * and are validated against allow-lists before they reach the database; the
 * search text is reduced to characters that cannot alter the filter.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.read")) return <NoAccess title="Leads" />;
  const { supabase } = ctx;

  const params = await searchParams;
  const statusParam = firstParam(params.status);
  const topicParam = firstParam(params.topic);
  const status = (LEAD_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as LeadStatus) : "";
  const topic = (CONTACT_TOPICS as readonly string[]).includes(topicParam) ? topicParam : "";
  const stageParam = firstParam(params.stage);
  const stage = (LEAD_STAGES as readonly string[]).includes(stageParam) ? (stageParam as LeadStage) : "";
  const sort = firstParam(params.sort) === "score" ? "score" : "";
  const q = cleanSearch(firstParam(params.q));
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;
  const error = ERRORS[firstParam(params.error)];

  let query = supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS, { count: "exact" });
  if (sort === "score") query = query.order("score", { ascending: false });
  query = query.order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) query = query.eq("status", status);
  if (stage) query = query.eq("stage", stage);
  if (topic) query = query.eq("topic", topic);
  // q contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  if (q) query = query.or(`reference.ilike."%${q}%",email.ilike."%${q}%"`);

  const [result, names] = await Promise.all([query, staffDirectory(supabase)]);
  // PGRST103: the requested page is past the end of the result
  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const leads = (result.data ?? []) as LeadListItem[];
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return <LeadsView status={status} stage={stage} sort={sort} topic={topic} q={q} error={error} failed={failed} pastEnd={pastEnd} leads={leads} names={names} me={ctx.userId} total={total} page={page} pageCount={pageCount} />;
}
