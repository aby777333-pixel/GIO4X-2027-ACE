import Link from "next/link";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
import { CONTACT_TOPICS, LEAD_STATUS_LABEL, LEAD_STATUSES } from "@/lib/server/constants";
import type { LeadStatus } from "@/lib/supabase/types";

export type LeadsViewProps = {
  status: LeadStatus | "";
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
};

/** Presentation only. The filters shown here were validated by the page before they reached the database. */
export function LeadsView({ status, topic, q, error, failed, pastEnd, leads, names, me, total, page, pageCount }: LeadsViewProps) {
  const filtered = !!(status || topic || q);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (topic) sp.set("topic", topic);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/control/leads?${s}` : "/control/leads";
  };

  return (
    <>
      <ControlHead eyebrow="Clients" title="Leads" lead="Enquiries from the contact and account-interest forms, newest first." />

      {error && (
        <div className="mt-21">
          <Notice title={error} tone="error" />
        </div>
      )}

      <form method="get" action="/control/leads" role="search" aria-label="Filter leads" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="field sm:col-span-2 lg:col-span-1">
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
        <div className="flex gap-8 sm:col-span-2 lg:col-span-1">
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
              Try a different status or topic, or{" "}
              <Link href="/control/leads" className="link">
                clear the filters
              </Link>
              .
            </p>
          </Empty>
        ) : (
          <Empty title="No enquiries yet">
            <p>When someone sends the contact form or registers interest in an account, the enquiry appears here with its reference.</p>
          </Empty>
        )}
      </div>

      {!failed && !pastEnd && total > 0 && <Pager page={page} pageCount={pageCount} total={total} noun={total === 1 ? "lead" : "leads"} href={href} />}
    </>
  );
}
