import { reportMonths } from "@/components/control/report-month";

/**
 * The Reporting Centre's "Monthly summary" card: choose a calendar month, then
 * open it laid out for printing or download the same figures as a CSV file.
 *
 * One form, two buttons, no script. Opening the page is a GET (reading counts
 * changes nothing); the download is a POST, because it is recorded in the
 * audit log and must not be triggerable by a link from somewhere else. Both
 * destinations check the month against the same list and check access again.
 *
 * `now` exists for tests and previews; the console leaves it out and the list
 * follows the clock.
 */
export function MonthSummaryCard({ now }: { now?: Date }) {
  const months = reportMonths(now);
  // the last month that has ended is the one a monthly summary is usually wanted for
  const preset = months[1] ?? months[0];

  return (
    <section className="gxc-card min-w-0" aria-labelledby="month-summary-title">
      <div className="gxc-card-head">
        <h2 id="month-summary-title" className="gxc-card-title">
          Monthly summary
        </h2>
      </div>
      <div className="gxc-card-body">
        <p className="max-w-measure text-sm text-ink-2">
          One calendar month in counts: enquiries by topic, stage and source, support tickets, live chat, the newsletter, follow-ups, blog posts and Status page notices. Counts only, with no names or addresses. A month runs from its first day to
          its last in UTC.
        </p>

        <form method="get" action="/control/reports/summary" className="mt-13 flex flex-wrap items-end gap-13">
          <div className="field w-full sm:w-[16rem]">
            <label htmlFor="summary-month">Month</label>
            <select id="summary-month" name="month" className="select" defaultValue={preset.value}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                  {m.current ? " (so far)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            Open printable summary
          </button>
          <button type="submit" formMethod="post" formAction="/control/reports/summary-export" className="btn btn-ghost">
            Download CSV
          </button>
        </form>

        <ul className="mt-13 grid max-w-measure gap-5 text-xs text-ink-3">
          <li>To keep the summary as a PDF, open the printable summary and use your browser’s Print, then choose “Save as PDF”. The page is laid out for A4.</li>
          <li>Each CSV download is recorded in the audit log with your name and the month.</li>
          <li>Scheduled delivery by e-mail is not available. It needs a sending domain (SPF, DKIM and DMARC), and this project has none, so the console cannot send e-mail.</li>
        </ul>
      </div>
    </section>
  );
}
