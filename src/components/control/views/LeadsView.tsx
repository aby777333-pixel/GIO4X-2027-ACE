import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
import { CONTACT_TOPICS, LEAD_STAGE_LABEL, LEAD_STAGES, LEAD_STATUS_LABEL, LEAD_STATUSES } from "@/lib/server/constants";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

export type LeadsViewProps = {
  status: LeadStatus | "";
  stage: LeadStage | "";
  sort: "score" | "";
  topic: string;
  q: string;
  error?: string;
  failed: boolean;
  pastEnd: boolean;
  leads: LeadListItem[];
  names: Map<string, string>;
  me: string;
  total: number;
  page: number;
  pageCount: number;
  /** may add an enquiry by hand (leads.write) */
  canAdd?: boolean;
};

/** Presentation only. The filters shown here were validated by the page before they reached the database. */
export function LeadsView({ status, stage, sort, topic, q, error, failed, pastEnd, leads, names, me, total, page, pageCount, canAdd = false }: LeadsViewProps) {
  const filtered = !!(status || stage || sort || topic || q);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (stage) sp.set("stage", stage);
    if (sort) sp.set("sort", sort);
    if (topic) sp.set("topic", topic);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/leads?${s}` : "/control/leads";
  };

  return (
    <>
      <ControlHead eyebrow="Clients" title="Leads" lead={sort === "score" ? "Enquiries from the contact and account-interest forms, and those entered by staff, highest score first." : "Enquiries from the contact and account-interest forms, and those entered by staff, newest first."}
        actions={
          canAdd ? (
            <Link href="/control/leads/new" className="btn btn-primary">
              Add enquiry
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="mt-21">
          <Notice title={error} tone="error" />
        </div>
      )}

      <form method="get" action="/control/leads" role="search" aria-label="Filter leads" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="field sm:col-span-2 lg:col-span-4">
          <label htmlFor="leads-q">Reference or email</label>
          <input id="leads-q" name="q" type="search" className="input" defaultValue={q} maxLength={100} placeholder="GX-… or name@example.com" autoComplete="off" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="leads-status">Status</label>
          <select id="leads-status" name="status" className="select" defaultValue={status}>
            <option value="">Any status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="leads-stage">Stage</label>
          <select id="leads-stage" name="stage" className="select" defaultValue={stage}>
            <option value="">Any stage</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="leads-topic">Topic</label>
          <select id="leads-topic" name="topic" className="select" defaultValue={topic}>
            <option value="">Any topic</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="leads-sort">Order</label>
          <select id="leads-sort" name="sort" className="select" defaultValue={sort}>
            <option value="">Newest first</option>
            <option value="score">Highest score first</option>
          </select>
        </div>
        <div className="flex gap-8 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href="/control/leads" className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-13">
        {failed ? (
          <Notice title="The leads could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        ) : leads.length ? (
          <LeadsTable leads={leads} names={names} me={me} caption={filtered ? "Leads matching the current filters" : "All leads, newest first"} />
        ) : pastEnd ? (
          <Empty title="There is no such page">
            <p>
              <Link href={href(1)} className="link">
                Go to the first page
              </Link>
            </p>
          </Empty>
        ) : filtered ? (
          <Empty title="Nothing matches these filters">
            <p>
              Try a different status, stage or topic, or{" "}
              <Link href="/control/leads" className="link">
                clear the filters
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="No enquiries yet">
            <p>When someone sends the contact form or registers interest in an account, the enquiry appears here with its reference.</p>
            {canAdd && (
              <p className="mt-13">
                Spoke to someone by telephone or at an event?{" "}
                <Link href="/control/leads/new" className="link">
                  Add the enquiry by hand
                </Link>
                .
              </p>
            )}
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "lead" : "leads"} href={href} />}
    </>
  );
}
