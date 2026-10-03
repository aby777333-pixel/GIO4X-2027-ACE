import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getSupabaseServer } from "@/lib/supabase-server";
import { LEAD_STAGES, STAGE_LABEL, type LeadStage } from "@/lib/crm-constants";
import { StageMover } from "./stage-mover";
import { List } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CrmPipelinePage() {
  const supabase = getSupabaseServer();
  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, full_name, email, phone, source, stage, assigned_staff, last_activity_at")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(500);

  const rows = leads ?? [];
  const byStage = new Map<LeadStage, typeof rows>();
  for (const s of LEAD_STAGES) byStage.set(s, []);
  for (const l of rows) {
    const stage = l.stage as LeadStage;
    if (byStage.has(stage)) byStage.get(stage)!.push(l);
  }

  return (
    <>
      <PageHeader
        title="Sales Pipeline"
        subtitle="Move leads through the funnel with the arrow controls on each card."
        actions={
          <Link
            href="/staff/crm"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-steel transition hover:border-sky/30 hover:text-navy"
          >
            <List size={16} /> List view
          </Link>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {LEAD_STAGES.map((stage) => {
          const items = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-navy">
                  {STAGE_LABEL[stage]}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-steel">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 p-2">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-steel-light">Empty</p>
                ) : (
                  items.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
                    >
                      <Link
                        href={`/staff/crm/${l.id}`}
                        className="block truncate text-sm font-medium text-navy hover:text-sky"
                      >
                        {l.full_name}
                      </Link>
                      <div className="truncate text-[11px] text-steel-light">
                        {l.email || l.phone || l.source}
                      </div>
                      <StageMover leadId={l.id} stage={stage} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
