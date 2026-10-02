import Link from "next/link";
import { ControlHead, Notice, Score } from "@/components/control/bits";
import { fmtDate, STAGE_NOTE } from "@/components/control/format";
import type { LeadListItem } from "@/components/control/LeadsTable";
import { LEAD_STAGE_LABEL } from "@/lib/server/constants";
import type { LeadStage } from "@/lib/supabase/types";

export type PipelineColumn = { stage: LeadStage; count: number; leads: LeadListItem[] };

export type PipelineViewProps = {
  columns: PipelineColumn[];
  failed: boolean;
  names: Map<string, string>;
  me: string;
};

/**
 * The pipeline: one column per stage from `xl` up, one section per stage below
 * it. Each column shows a real count and its highest-scoring enquiries. A lead
 * is moved from its own page, where the change is recorded; nothing is dragged.
 */
export function PipelineView({ columns, failed, names, me }: PipelineViewProps) {
  const total = columns.reduce((sum, c) => sum + c.count, 0);
  const owner = (lead: LeadListItem) => (!lead.assigned_to ? "Unassigned" : lead.assigned_to === me ? "You" : (names.get(lead.assigned_to) ?? "Assigned"));

  return (
    <>
      <ControlHead
        eyebrow="Clients"
        title="Pipeline"
        lead="Where each relationship stands, from first enquiry to client. Spam is left out. Within a stage, the highest score comes first."
        actions={
          <Link href="/control/leads?sort=score" className="go">
            All leads by score
          </Link>
        }
      />

      {failed ? (
        <div className="mt-21">
          <Notice title="The pipeline could not be read" tone="error">
            The database did not answer every query. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          <p className="num mt-13 text-xs text-ink-3">
            {total} {total === 1 ? "enquiry" : "enquiries"} in the pipeline
          </p>
          <div className="mt-13 grid gap-34 md:grid-cols-2 xl:grid-cols-6 xl:gap-0 xl:border-l xl:border-line">
            {columns.map((column) => (
              <section key={column.stage} aria-labelledby={`stage-${column.stage}`} className="min-w-0 xl:border-r xl:border-line xl:px-13">
                <div className="border-b border-line-strong pb-8">
                  <div className="flex items-baseline justify-between gap-8">
                    <h2 id={`stage-${column.stage}`} className="label">
                      {LEAD_STAGE_LABEL[column.stage]}
                    </h2>
                    <span className="num text-sm font-medium text-ink">{column.count}</span>
                  </div>
                  <p className="mt-3 text-xs text-ink-3">{STAGE_NOTE[column.stage]}</p>
                </div>
                {column.leads.length ? (
                  <ul>
                    {column.leads.map((lead) => (
                      <li key={lead.id} className="border-b border-line">
                        <Link href={`/control/leads/${lead.id}`} className="block py-13 transition-colors duration-fast hover:bg-brand-soft xl:-mx-13 xl:px-13">
                          <span className="flex items-center justify-between gap-8">
                            <span className="num whitespace-nowrap text-xs font-medium text-accent">{lead.reference}</span>
                            <Score value={lead.score} />
                          </span>
                          <span className="mt-5 block truncate text-sm text-ink">{lead.name}</span>
                          <span className="block truncate text-xs text-ink-3">{lead.topic}</span>
                          <span className="mt-3 flex flex-wrap gap-x-8 text-xs text-ink-3">
                            <span className="num">{fmtDate(lead.created_at)}</span>
                            <span>{owner(lead)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-b border-line py-13 text-xs text-ink-3">Nobody here.</p>
                )}
                {column.count > column.leads.length && (
                  <Link href={`/control/leads?stage=${column.stage}&sort=score`} className="go mt-8 min-h-[2.75rem] text-xs">
                    All {column.count}
                  </Link>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
