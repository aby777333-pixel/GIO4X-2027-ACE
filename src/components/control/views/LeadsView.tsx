import Link from "next/link";
import { bulkLeads } from "@/app/control/actions-bulk";
import { ControlHead, Empty, Notice, Pager } from "@/components/control/bits";
import { BulkBar } from "@/components/control/BulkBar";
import type { BulkOp } from "@/components/control/bulk-shared";
import { LeadsTable, type LeadListItem } from "@/components/control/LeadsTable";
import { ViewsControl, type ViewsProps } from "@/components/control/ViewsControl";
import { viewParamsFrom } from "@/components/control/views-shared";
import { CONTACT_TOPICS, LEAD_STAGE_LABEL, LEAD_STAGES, LEAD_STATUS_LABEL, LEAD_STATUSES, LOST_REASON_LABEL, LOST_REASONS } from "@/lib/server/constants";
import type { LeadStage, LeadStatus } from "@/lib/supabase/types";

/** The form the row boxes belong to (BulkBar.tsx). */
const BULK_FORM = "bulk-leads";

/** What the bulk bar offers on this list. A colleague is offered only to people who may assign to others. */
function bulkOps(names: Map<string, string>, me: string, canAssign: boolean): BulkOp[] {
  const colleagues = canAssign ? [...names].filter(([id]) => id !== me).map(([id, name]) => ({ value: id, label: name })) : [];
  return [
    { key: "status", label: "Set status", field: "status", valueLabel: "Status", options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] })) },
    {
      key: "stage",
      label: "Set stage",
      field: "stage",
      valueLabel: "Stage",
      options: LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABEL[s] })),
      // a lost enquiry always says why: the same rule as on the enquiry's own page
      then: { when: "lost", field: "lost_reason", label: "Reason lost", options: LOST_REASONS.map((r) => ({ value: r, label: LOST_REASON_LABEL[r] })) },
    },
    { key: "assign", label: "Assign", field: "assignee", valueLabel: "Assign to", options: [{ value: "me", label: "Me" }, ...colleagues, { value: "none", label: "Nobody (unassign)" }] },
  ];
}

export type LeadsViewProps = {
  status: LeadStatus | "";
  stage: LeadStage | "";
  sort: "score" | "";
  topic: string;
  /** "" is every enquiry; "staff" only those entered or imported by staff; "website" only those from the forms */
  origin?: "staff" | "website" | "";
  /** "" is everyone's; "mine" only the enquiries assigned to the person looking */
  who?: "mine" | "";
  /** the person's saved views for this screen; left out, the Views control is not drawn */
  views?: ViewsProps;
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
  /** may add an enquiry by hand (leads.write); the same capability offers the row boxes and the bulk bar */
  canAdd?: boolean;
  /** may give an enquiry to somebody else (leads.assign) */
  canAssign?: boolean;
  /** may import enquiries from a file (leads.write and leads.import) */
  canImport?: boolean;
};

/** Presentation only. The filters shown here were validated by the page before they reached the database. */
export function LeadsView({ status, stage, sort, topic, origin = "", who = "", views, q, error, failed, pastEnd, leads, names, me, total, page, pageCount, canAdd = false, canAssign = false, canImport = false }: LeadsViewProps) {
  const filtered = !!(status || stage || sort || topic || origin || who || q);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (stage) sp.set("stage", stage);
    if (sort) sp.set("sort", sort);
    if (topic) sp.set("topic", topic);
    if (origin) sp.set("origin", origin);
    if (who) sp.set("who", who);
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
            <>
              {canImport && (
                <Link href="/control/leads/import" className="btn btn-ghost">
                  Import a file
                </Link>
              )}
              <Link href="/control/leads/new" className="btn btn-primary">
                Add enquiry
              </Link>
            </>
          ) : undefined
        }
      />

      {error && (
        <div className="mt-21">
          <Notice title={error} tone="error" />
        </div>
      )}

      {views && <ViewsControl screen="leads" current={viewParamsFrom("leads", { status, stage, topic, origin, who, sort })} searching={!!q} {...views} />}

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
        <div className="field">
          <label htmlFor="leads-origin">Came from</label>
          <select id="leads-origin" name="origin" className="select" defaultValue={origin}>
            <option value="">Anywhere</option>
            <option value="website">The website’s forms</option>
            <option value="staff">Entered or imported by staff</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="leads-who">Assigned to</label>
          <select id="leads-who" name="who" className="select" defaultValue={who}>
            <option value="">Anyone</option>
            <option value="mine">Me</option>
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
          <LeadsTable leads={leads} names={names} me={me} caption={filtered ? "Leads matching the current filters" : "All leads, newest first"} selectForm={canAdd ? BULK_FORM : undefined} />
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

      {/* appears once a row is ticked; kept in the page after the list so that nothing above it moves */}
      {canAdd && !failed && leads.length > 0 && <BulkBar formId={BULK_FORM} action={bulkLeads} ops={bulkOps(names, me, canAssign)} noun={["enquiry", "enquiries"]} />}
    </>
  );
}
