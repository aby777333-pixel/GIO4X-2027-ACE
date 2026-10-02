import { NoAccess } from "@/components/control/bits";
import { BOARD_STEP } from "@/components/control/board-shared";
import { controlMeta } from "@/components/control/format";
import { PipelineView } from "@/components/control/views/PipelineView";
import { readLeadColumn } from "@/lib/server/boards";
import { LEAD_STAGES } from "@/lib/server/constants";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Pipeline", "/control/pipeline");

/**
 * One query per stage: the count, and the highest-scoring enquiries in it
 * (eight, as before; a column loads more through /control/pipeline/more).
 * Only what a card shows is read: no address, no message.
 */
export default async function PipelinePage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.read")) return <NoAccess title="Pipeline" />;
  const { supabase } = ctx;

  const [results, names] = await Promise.all([Promise.all(LEAD_STAGES.map((stage) => readLeadColumn(supabase, stage, BOARD_STEP))), staffDirectory(supabase)]);

  const columns = LEAD_STAGES.map((stage, i) => ({
    stage,
    count: results[i]?.count ?? 0,
    cards: results[i]?.cards ?? [],
  }));

  return <PipelineView columns={columns} failed={results.some((r) => r.failed)} names={names} me={ctx.userId} writable={can(ctx, "leads.write")} />;
}
