import Link from "next/link";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDate, fmtDateTime } from "@/components/control/format";
import { monthSections, type MonthChoice, type MonthFigure } from "@/components/control/report-month";
import { PrintButton } from "@/components/trust/PrintButton";
import type { ReportMonth } from "@/lib/supabase/types";

export type MonthSummaryViewProps = {
  /** the month asked for, if it is one of the months on offer */
  month: MonthChoice | null;
  /** the months on offer, newest first */
  months: MonthChoice[];
  /** null when no valid month was asked for, or when the database did not answer with a summary */
  summary: ReportMonth | null;
  /** the display name of the member of staff the page was produced for */
  generatedBy: string;
};

/**
 * Print rules for this page only. The console's stylesheet is not edited: the
 * sheet below is rendered with the page and leaves with it.
 *   · A4 with a margin; the sidebar, the phone top bar and the frame's padding go.
 *   · Black on white whatever look the console is wearing. The variables are
 *     marked important because a dark palette sets the same ones on the same
 *     element with a more specific selector.
 * The toolbar carries `no-print`, which the site's own print rules remove.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  body { background: #fff !important; }
  .gx-console {
    display: block !important;
    min-height: 0 !important;
    color-scheme: light !important;
    --bg: #fff !important; --paper: #fff !important; --surface: #fff !important; --surface-2: #fff !important;
    --ink: #000 !important; --ink-2: #222 !important; --ink-3: #555 !important;
    --line: #ccc !important; --line-strong: #888 !important; --accent: #064f84 !important;
    --gxc-card-line: #ccc !important; --gxc-row-line: #ccc !important; --gxc-card-shadow: none !important;
  }
  .gx-console > .gxc-side, .gx-console > .gxc-top { display: none !important; }
  .gx-console > div > div:has(> .gxc-month-sheet) { max-width: none !important; padding: 0 !important; }
  .gxc-month-sheet { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .gxc-month-sheet section { break-inside: avoid; }
}
`;

/** A figure as printed: the number, or a dash that a screen reader hears as "nothing to measure". */
function Value({ figure }: { figure: MonthFigure }) {
  return figure.value === null ? (
    <>
      <span aria-hidden>–</span>
      <span className="sr-only">nothing to measure</span>
    </>
  ) : (
    <>{figure.value}</>
  );
}

/**
 * Presentation only: one calendar month, laid out as a sheet of A4. Every
 * figure arrives in `summary`, counted by the database (report_month) from
 * real rows at the time printed at the foot. Zero is printed as 0. There are
 * no names, addresses or message text on it, apart from the name of the member
 * of staff it was produced for.
 */
export function MonthSummaryView({ month, months, summary, generatedBy }: MonthSummaryViewProps) {
  if (!month || !summary) {
    return (
      <>
        <ControlHead title="Monthly summary" lead="One calendar month in counts, laid out for printing." />
        <div className="mt-21">
          {!month ? (
            <Notice title="Choose a month">The summary is available for the current month and the eleven before it.</Notice>
          ) : (
            <Notice title="The summary could not be read" tone="error">
              The database did not answer. Reload the page; if this continues, check that the migrations have been applied.
            </Notice>
          )}
        </div>
        <nav aria-label="Months" className="mt-21">
          <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {months.map((m) => (
              <li key={m.value}>
                <Link href={`/control/reports/summary?month=${m.value}`} className="gxc-row text-sm text-ink">
                  <span>
                    {m.label}
                    {m.current && <span className="text-ink-3"> (so far)</span>}
                  </span>
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-21 text-sm">
          <Link href="/control/reports" className="link">
            Back to the Reporting Centre
          </Link>
        </p>
      </>
    );
  }

  const sections = monthSections(summary);
  // `to` is the first instant of the next month; the last day of this one is the day before
  const lastDay = new Date(new Date(summary.to).getTime() - 1).toISOString();

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-13">
        <Link href="/control/reports" className="link text-sm">
          Back to the Reporting Centre
        </Link>
        <div className="flex flex-wrap items-center gap-8">
          {/* POST: the download is recorded in the audit log before the file is sent */}
          <form method="post" action="/control/reports/summary-export">
            <input type="hidden" name="month" value={month.value} />
            <button type="submit" className="btn btn-ghost btn-sm !h-[2.75rem] md:!h-[2.125rem]">
              Download CSV
            </button>
          </form>
          <PrintButton label="Print or save as PDF" />
        </div>
      </div>
      <p className="no-print mt-8 max-w-measure text-xs text-ink-3">
        To make a PDF, press “Print or save as PDF” and choose “Save as PDF” as the printer in your browser’s print window. The menu and these controls are left off the printed page. Scheduled delivery by e-mail is not available: it needs a sending
        domain, and this project has none.
      </p>

      <article className="gxc-card gxc-month-sheet mx-auto mt-13 max-w-[52rem] p-21 md:p-34">
        <header className="border-b border-line-strong pb-13">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-3">GIO4X · Monthly summary</p>
          <h1 className="h3 mt-5">{month.label}</h1>
          <p className="num mt-5 text-sm text-ink-2">
            {fmtDate(summary.from)} to {fmtDate(lastDay)}, UTC
          </p>
          {!summary.complete && (
            <p className="mt-8 text-sm font-medium text-ink">
              This month has not ended. The figures run to <span className="num">{fmtDateTime(summary.generated_at)}</span> and will change.
            </p>
          )}
        </header>

        {/* two columns that fill downwards, so a long table beside a short one leaves no hole and the month fits one sheet */}
        <div className="mt-21 gap-x-34 sm:columns-2 print:mt-13 print:columns-2">
          {sections.map((section) => (
            <section key={section.key} className="mb-21 min-w-0 break-inside-avoid print:mb-13">
              <table className="w-full table-fixed text-sm">
                <caption className="pb-5 text-left text-sm font-semibold text-ink">{section.title}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Figure</th>
                    {/* the table's layout is fixed, so this first row sets the widths: the count is narrow, the label takes the rest */}
                    <th scope="col" className="w-[4.5rem]">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.figures.map((figure) => (
                    <tr key={figure.metric} className="border-b border-line first:border-t first:border-t-line-strong">
                      <th scope="row" className="break-words py-5 pr-13 text-left align-top font-normal text-ink-2 print:py-3">
                        {figure.metric}
                      </th>
                      <td className="num w-[4.5rem] py-5 text-right align-top font-semibold text-ink print:py-3">
                        <Value figure={figure} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {section.note && <p className="mt-5 text-xs text-ink-3">{section.note}</p>}
            </section>
          ))}
        </div>

        <footer className="border-t border-line-strong pt-13 text-xs text-ink-3">
          <p>
            Generated <span className="num">{fmtDateTime(summary.generated_at)}</span> by {generatedBy}.
          </p>
          <p className="mt-3">
            Every figure was counted from the records in GIO4X Control at that moment; none is estimated, and a count of zero is printed as 0. A dash means there was nothing to measure. Counts only: this page holds no customer’s name, address or
            message.
          </p>
        </footer>
      </article>
    </>
  );
}
