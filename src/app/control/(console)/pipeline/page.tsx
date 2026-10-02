import { NoAccess } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { LEAD_LIST_COLUMNS, type LeadListItem } from "@/components/control/LeadsTable";
import { PipelineView } from "@/components/control/views/PipelineView";
import { LEAD_STAGES } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Pipeline", "/control/pipeline");

const PER_STAGE = 8;

/** One query per stage: the count, and the highest-scoring enquiries in it. */
export default async function PipelinePage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.read")) return <NoAccess title="Pipeline" />;
  const { supabase } = ctx;

  const [results, names] = await Promise.all([
    Promise.all(
      LEAD_STAGES.map((stage) =>
        supabase
          .from("leads")
          .select(LEAD_LIST_COLUMNS, { count: "exact" })
          .eq("stage", stage)
          .neq("status", "spam")
          .order("score", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(PER_STAGE),
      ),
    ),
    staffDirectory(supabase),
  ]);

  const columns = LEAD_STAGES.map((stage, i) => ({
    stage,
    count: results[i]?.count ?? 0,
    leads: (results[i]?.data ?? []) as LeadListItem[],
  }));

  return <PipelineView columns={columns} failed={results.some((r) => r.error)} names={names} me={ctx.userId} />;
}
