import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { MonthSummaryCard } from "@/components/control/views/MonthSummaryCard";
import { LEAD_STAGE_LABEL, LEAD_STATUS_LABEL, LOST_REASON_LABEL, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/server/constants";
import type { ReportSummary } from "@/lib/supabase/types";

/** The periods a report can cover, in days. The page and the export route validate against this list. */
export const REPORT_PERIODS = [7, 30, 90, 365] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const DEFAULT_REPORT_PERIOD: ReportPeriod = 30;

export type ReportsViewProps = {
  days: ReportPeriod;
  /** null when the database did not answer, or answered with something that is not a report */
  summary: ReportSummary | null;
  /** holds `subscribers.export`; the export route checks it again, and so does the database */
  canExport: boolean;
};

type Tally = { key: string; count: number }[];

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="gxc-card min-w-0">
      <div className="gxc-card-head">
        <h2 className="gxc-card-title">{title}</h2>
      </div>
      <div className="gxc-card-body">
        {children}
        {note && <p className="mt-13 max-w-measure text-xs text-ink-3">{note}</p>}
      </div>
    </section>
  );
}

/** Headline counts of a card. A definition list: each figure keeps its label for a screen reader. */
function Figures({ items, narrow = false }: { items: { label: string; value: number }[]; narrow?: boolean }) {
  return (
    <dl className={`grid grid-cols-2 gap-8 ${narrow ? "" : "sm:grid-cols-3"}`}>
      {items.map((item) => (
        <div key={item.label} className="gxc-stat">
          <dt className="gxc-stat-label">{item.label}</dt>
          <dd className="gxc-stat-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One breakdown as a table: what, and how many. The bar under each label is
 * that row's share of the largest row, drawn for the eye only; the number is
 * always printed beside it. Two columns, so it reads the same on a phone.
 */
function Breakdown({ title, column, rows, label, empty }: { title: string; column: string; rows: Tally; label?: (key: string) => string; empty: string }) {
  if (!rows.length) {
    return (
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-8 text-sm text-ink-3">{empty}</p>
      </div>
    );
  }
  const largest = rows.reduce((max, row) => Math.max(max, row.count), 0);
  return (
    <table className="w-full min-w-0 table-fixed text-sm">
      <caption className="pb-5 text-left text-sm font-semibold text-ink">{title}</caption>
      <thead>
        <tr className="border-b border-line-strong text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3">
          <th scope="col" className="py-5 pr-13 text-left font-semibold">
            {column}
          </th>
          <th scope="col" className="w-[4.5rem] py-5 text-right font-semibold">
            Count
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line">
            <th scope="row" className="py-8 pr-13 text-left align-top font-normal text-ink-2">
              <span className="block break-words">{label ? label(row.key) : row.key}</span>
              <span aria-hidden className="mt-5 block h-3 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${largest > 0 ? (row.count / largest) * 100 : 0}%` }} />
              </span>
            </th>
            <td className="num py-8 text-right align-top font-semibold text-ink">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A key the database returned, in the words the rest of the console uses; an unknown key is shown as it is. */
function labeller(labels: Record<string, string>): (key: string) => string {
  return (key) => (Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : key);
}

/** Minutes as hours and minutes, in words. */
function hoursAndMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 1) return "Under a minute";
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hours = h === 1 ? "1 hour" : `${h} hours`;
  const mins = m === 1 ? "1 minute" : `${m} minutes`;
  return h === 0 ? mins : m === 0 ? hours : `${hours} ${mins}`;
}

const periodHref = (days: ReportPeriod) => (days === DEFAULT_REPORT_PERIOD ? "/control/reports" : `/control/reports?days=${days}`);

/**
 * Presentation only. Every figure arrives in `summary`, counted by the
 * database (report_summary) from real rows when the page was rendered: there
 * are no targets, no estimates and no comparisons here, and zero is shown as
 * zero.
 */
export function ReportsView({ days, summary, canExport }: ReportsViewProps) {
  const tab = (current: boolean) =>
    `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

  return (
    <>
      <ControlHead title="Reporting Centre" lead="Counts of what the website and the team recorded, taken from the database when this page was opened. No targets and no estimates." />

      <div className="mt-21 border-b border-line">
        <nav aria-label="Period" className="flex flex-wrap">
          {REPORT_PERIODS.map((p) => (
            <Link key={p} href={periodHref(p)} aria-current={p === days ? "page" : undefined} className={tab(p === days)}>
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      {!summary ? (
        <div className="mt-13">
          <Notice title="The report could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        </div>
      ) : (
        <>
          <p className="mt-13 text-sm text-ink-2">
            The last {summary.days} {summary.days === 1 ? "day" : "days"}: everything recorded since <span className="num font-medium text-ink">{fmtDateTime(summary.since)}</span>.
          </p>

          <div className="mt-13 grid gap-13">
            <Card title="Enquiries" note="Spam is counted on its own and left out of the total and of every breakdown except status. Source is the campaign link the enquirer arrived by (utm_source), or Direct when there was none. Source and page list the twelve largest.">
              <Figures
                items={[
                  { label: "Enquiries", value: summary.leads.total },
                  { label: "Marked as spam", value: summary.leads.spam },
                ]}
              />
              <div className="mt-21 grid items-start gap-x-34 gap-y-21 md:grid-cols-2">
                <Breakdown title="By topic" column="Topic" rows={summary.leads.by_topic} empty="No enquiries in this period." />
                <Breakdown title="By pipeline stage" column="Stage" rows={summary.leads.by_stage} label={labeller(LEAD_STAGE_LABEL)} empty="No enquiries in this period." />
                <Breakdown title="By status" column="Status" rows={summary.leads.by_status} label={labeller(LEAD_STATUS_LABEL)} empty="No enquiries in this period." />
                <Breakdown title="By source" column="Source" rows={summary.leads.by_source} label={(key) => (key === "direct" ? "Direct" : key)} empty="No enquiries in this period." />
                <Breakdown title="By page they were sent from" column="Page" rows={summary.leads.by_page} empty="No enquiries in this period." />
                <Breakdown title="Lost reasons" column="Reason" rows={summary.leads.lost_reasons} label={labeller(LOST_REASON_LABEL)} empty="No enquiry received in this period has been marked as lost." />
              </div>
            </Card>

            <Card title="Support" note="Opened and answered count tickets opened in this period; answered means a first public reply has been sent. Solved counts tickets solved in this period, whenever they were opened. The median is taken over the answered tickets.">
              <Figures
                items={[
                  { label: "Tickets opened", value: summary.tickets.total },
                  { label: "Solved", value: summary.tickets.solved },
                  { label: "Answered", value: summary.tickets.answered },
                ]}
              />
              <dl className="mt-13">
                <div className="gxc-row flex-wrap">
                  <dt className="text-sm text-ink-3">Median time to first reply</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {summary.tickets.first_response_median_minutes === null ? "No ticket in this period has been answered yet" : hoursAndMinutes(summary.tickets.first_response_median_minutes)}
                  </dd>
                </div>
              </dl>
              <div className="mt-21 grid items-start gap-x-34 gap-y-21 md:grid-cols-2">
                <Breakdown title="By category" column="Category" rows={summary.tickets.by_category} label={labeller(TICKET_CATEGORY_LABEL)} empty="No tickets in this period." />
                <Breakdown title="By status" column="Status" rows={summary.tickets.by_status} label={labeller(TICKET_STATUS_LABEL)} empty="No tickets in this period." />
              </div>
            </Card>

            <div className="grid gap-13 lg:grid-cols-3">
              <Card title="Live chat" note="Answered means a member of staff took the conversation.">
                <Figures
                  narrow
                  items={[
                    { label: "Started", value: summary.chats.total },
                    { label: "Answered by staff", value: summary.chats.answered },
                  ]}
                />
              </Card>
              <Card title="Newsletter" note="Active now is the number of subscriptions today, whatever the period.">
                <Figures
                  narrow
                  items={[
                    { label: "New", value: summary.subscribers.new },
                    { label: "Unsubscribed", value: summary.subscribers.unsubscribed },
                    { label: "Active now", value: summary.subscribers.active },
                  ]}
                />
              </Card>
              <Card title="Follow-ups" note="Completed counts follow-ups completed in this period, whenever they were created.">
                <Figures
                  narrow
                  items={[
                    { label: "Created", value: summary.follow_ups.created },
                    { label: "Completed", value: summary.follow_ups.completed },
                  ]}
                />
              </Card>
            </div>

            {/* a calendar month, whatever period is chosen above: printable, or as a CSV file */}
            <MonthSummaryCard />

            {canExport && (
              <Card title="Export">
                <p className="max-w-measure text-sm text-ink-2">
                  The enquiries received in the last {summary.days} days, one row each, spam included and marked as such in the status column. Each export is recorded in the audit log with your name and the number of rows. The file contains personal data: store and share it
                  accordingly.
                </p>
                {/* POST, not a link: an export is an audited action and must not be
                    triggerable by a page elsewhere navigating the browser here. */}
                {summary.leads.total + summary.leads.spam > 0 ? (
                  <form method="post" action="/control/reports/leads-export" className="mt-13">
                    <input type="hidden" name="days" value={days} />
                    <button type="submit" className="btn btn-ghost">
                      Export enquiries (CSV)
                    </button>
                  </form>
                ) : (
                  <p className="mt-13 text-sm text-ink-3">There are no enquiries in this period to export.</p>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
