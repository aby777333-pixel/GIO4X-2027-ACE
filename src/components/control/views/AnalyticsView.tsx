import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { DEFAULT_PULSE_PERIOD, PULSE_FORMS, PULSE_FORM_LABEL, PULSE_FORM_PAGE, PULSE_OTHER, PULSE_PERIODS, PULSE_REF_LABEL, PULSE_STATEMENT, type PulsePeriod } from "@/lib/pulse";
import type { PulseSummary } from "@/lib/supabase/types";

export type AnalyticsViewProps = {
  days: PulsePeriod;
  /** null when the database did not answer, or answered with something that is not a summary */
  summary: PulseSummary | null;
};

type Tally = { key: string; count: number }[];

const number = new Intl.NumberFormat("en-GB");
const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

/** A UTC day ("2026-10-02") as a date at midnight UTC, or null. */
function utcDay(day: string): Date | null {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDay(day: string | null): string {
  const d = day ? utcDay(day) : null;
  return d ? dayFormat.format(d) : "–";
}

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
function Figures({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-8 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="gxc-stat">
          <dt className="gxc-stat-label">{item.label}</dt>
          <dd className="gxc-stat-value">{number.format(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * What, and how many, as a two-column table. The bar under each label is that
 * row's share of the largest row, drawn for the eye only: the number is always
 * printed beside it, so nothing depends on seeing the bar or its colour.
 */
function BarTable({ title, column, rows, label, empty, mono = false }: { title: string; column: string; rows: Tally; label?: (key: string) => string; empty: string; mono?: boolean }) {
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
              <span className={`block break-words ${mono ? "font-mono text-[0.8125rem]" : ""}`}>{label ? label(row.key) : row.key}</span>
              <span aria-hidden className="mt-5 block h-3 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${largest > 0 ? (row.count / largest) * 100 : 0}%` }} />
              </span>
            </th>
            <td className="num py-8 text-right align-top font-semibold text-ink">{number.format(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The days of the period as rows short enough to read: each day for a week or
 * a month, weeks (Monday to Sunday, UTC) for 90 days, calendar months for a
 * year. A sum of the days it covers, never an average.
 */
function bucketDays(byDay: PulseSummary["views"]["by_day"], days: number): { unit: "day" | "week" | "month"; rows: Tally } {
  if (days <= 31) {
    return { unit: "day", rows: byDay.map((d) => ({ key: d.day, count: d.count })) };
  }
  const unit = days <= 120 ? "week" : "month";
  const rows: Tally = [];
  for (const d of byDay) {
    const date = utcDay(d.day);
    if (!date) continue;
    let key: string;
    if (unit === "week") {
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
    } else {
      key = `${d.day.slice(0, 7)}-01`;
    }
    const last = rows[rows.length - 1];
    if (last && last.key === key) last.count += d.count;
    else rows.push({ key, count: d.count });
  }
  return { unit, rows };
}

function bucketLabel(unit: "day" | "week" | "month"): (key: string) => string {
  return (key) => {
    const d = utcDay(key);
    if (!d) return key;
    return unit === "day" ? shortDay.format(d) : unit === "week" ? `Week of ${shortDay.format(d)}` : monthFormat.format(d);
  };
}

const periodHref = (days: PulsePeriod) => (days === DEFAULT_PULSE_PERIOD ? "/control/analytics" : `/control/analytics?days=${days}`);

const countOf = (rows: Tally, key: string) => rows.find((row) => row.key === key)?.count ?? 0;

const NO_FORM_PAGE = "No page of the site shows this form";
const NO_FORM_VIEWS = "No views counted";

/** The statement visitors are given, word for word (PULSE_STATEMENT is the single source for both). */
function Statement() {
  const column = (title: string, items: readonly string[]) => (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-8 grid list-disc gap-8 pl-21 text-sm text-ink-2">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <Card
      title="What is and is not collected"
      note={
        <>
          These are the words visitors are given under “Counting visits” in the{" "}
          <Link href="/legal/cookies#counting-visits" className="gxc-card-link">
            Cookie & Storage Notice
          </Link>
          , so “you” below is the visitor. Nothing on this screen goes beyond them.
        </>
      }
    >
      <p className="max-w-measure text-sm text-ink">{PULSE_STATEMENT.intro}</p>
      <div className="mt-13 grid items-start gap-x-34 gap-y-21 lg:grid-cols-3">
        {column("What is counted", PULSE_STATEMENT.counted)}
        {column("What is not collected", PULSE_STATEMENT.notCollected)}
        {column("The visitor’s choice", PULSE_STATEMENT.controls)}
      </div>
    </Card>
  );
}

/**
 * Presentation only. Every figure arrives in `summary`, added up by the
 * database (pulse_summary) from the daily totals when the page was rendered.
 * There are no targets, no estimates and no comparisons, zero is shown as
 * zero, and the one ratio on the screen says exactly what was divided by what.
 */
export function AnalyticsView({ days, summary }: AnalyticsViewProps) {
  const tab = (current: boolean) =>
    `flex h-[2.75rem] items-center border-b-2 px-13 text-sm transition-colors duration-fast ${current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`;

  const buckets = summary ? bucketDays(summary.views.by_day, summary.days) : null;
  const matched = summary ? Math.max(0, summary.search.total - summary.search.unmatched - summary.search.other) : 0;
  // each form, the page that holds it, and the one ratio on this screen: accepted ÷ counted views of that page
  const formRows = PULSE_FORMS.map((form) => {
    const accepted = summary ? countOf(summary.forms, form) : 0;
    const page = PULSE_FORM_PAGE[form];
    const views = summary && page ? countOf(summary.views.form_pages, page) : 0;
    return { form, accepted, page, views, ratio: page && views > 0 ? `${((accepted / views) * 100).toFixed(1)}%` : null };
  });

  return (
    <>
      <ControlHead title="Analytics" lead="The website’s own counts of page views, accepted forms and searches. Daily totals by UTC day, and nothing about any visitor. No third-party tracker is involved." />

      <div className="mt-21">
        <Statement />
      </div>

      <div className="mt-21 border-b border-line">
        <nav aria-label="Period" className="flex flex-wrap">
          {PULSE_PERIODS.map((p) => (
            <Link key={p} href={periodHref(p)} aria-current={p === days ? "page" : undefined} className={tab(p === days)}>
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      {!summary || !buckets ? (
        <div className="mt-13">
          <Notice title="The counts could not be read" tone="error">
            The database did not answer. Reload the page; if this continues, check that migration 0014_pulse has been applied.
          </Notice>
        </div>
      ) : summary.first_day === null ? (
        <Empty title="Nothing has been counted yet">
          <p>
            The counter starts with the first page view after it is switched on, and this installation has not recorded one. When it has, this screen shows views per day, the most viewed pages, where visitors came from, forms accepted and what the search was used for.
          </p>
        </Empty>
      ) : (
        <>
          <p className="mt-13 text-sm text-ink-2">
            The last {summary.days} {summary.days === 1 ? "day" : "days"}, by UTC day: <span className="num font-medium text-ink">{fmtDay(summary.since)}</span> to <span className="num font-medium text-ink">{fmtDay(summary.until)}</span>, today included. Counting began on{" "}
            <span className="num font-medium text-ink">{fmtDay(summary.first_day)}</span>
            {summary.first_day > summary.since ? ", inside this period, so the days before it are empty rather than quiet." : "."}
          </p>

          <div className="mt-13 grid gap-13">
            <Card
              title="Page views"
              note={
                <>
                  A view is one page opened in a browser that has not asked to be left out. It is not a person and not a visit: the same reader opening five pages is five views, and nothing links them. “{PULSE_OTHER}” is every view of an address that is not one of the site’s
                  published pages (a mistyped link, for example). The most viewed pages are the 25 largest.
                </>
              }
            >
              <Figures
                items={[
                  { label: "Page views", value: summary.views.total },
                  { label: "Different pages viewed", value: summary.views.paths },
                ]}
              />
              <div className="mt-21 grid items-start gap-x-34 gap-y-21 md:grid-cols-2">
                <BarTable
                  title={buckets.unit === "day" ? "Views per day" : buckets.unit === "week" ? "Views per week" : "Views per month"}
                  column={buckets.unit === "day" ? "Day (UTC)" : buckets.unit === "week" ? "Week (Monday to Sunday, UTC)" : "Month (UTC)"}
                  rows={buckets.rows}
                  label={bucketLabel(buckets.unit)}
                  empty="No days in this period."
                />
                <div className="grid min-w-0 gap-21">
                  <BarTable title="Where visitors came from" column="Kind of place" rows={summary.views.by_ref} label={(key) => (key in PULSE_REF_LABEL ? PULSE_REF_LABEL[key as keyof typeof PULSE_REF_LABEL] : key)} empty="No views in this period." />
                  <BarTable title="Most viewed pages" column="Path" rows={summary.views.by_path} empty="No views in this period." mono />
                </div>
              </div>
              {buckets.unit !== "day" && (
                <p className="mt-13 max-w-measure text-xs text-ink-3">
                  Each row adds up the days of the period that fall in that {buckets.unit}; the first and the last may be part of a {buckets.unit}.
                </p>
              )}
            </Card>

            <Card
              title="Forms"
              note="“Accepted ÷ views” is the number of forms accepted divided by the counted views of the page that holds that form, over the same period. It is not a share of visitors: a view is not a person, one person may view the page several times before sending it, and visitors who switched counting off are missing from the views but not from the forms, so the figure can read high."
            >
              {/* a table from md up; below it the same rows as a stacked list, so nothing scrolls sideways on a phone */}
              <div className="hidden md:block">
                <table className="table-gx">
                  <caption className="sr-only">Forms accepted, views of the page that holds each form, and one divided by the other</caption>
                  <thead>
                    <tr>
                      <th scope="col">Form</th>
                      <th scope="col" className="text-right">
                        Accepted
                      </th>
                      <th scope="col">Its page</th>
                      <th scope="col" className="text-right">
                        Views of that page
                      </th>
                      <th scope="col" className="text-right">
                        Accepted ÷ views
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formRows.map((row) => (
                      <tr key={row.form}>
                        <th scope="row" className="!normal-case !tracking-normal">
                          <span className="text-sm font-medium text-ink">{PULSE_FORM_LABEL[row.form]}</span>
                        </th>
                        <td className="num text-right font-semibold text-ink">{number.format(row.accepted)}</td>
                        <td className="whitespace-normal text-sm text-ink-2">{row.page ? <span className="font-mono text-[0.8125rem]">{row.page}</span> : NO_FORM_PAGE}</td>
                        <td className="num text-right text-ink-2">{row.page ? number.format(row.views) : "–"}</td>
                        <td className="num text-right text-ink-2">{row.ratio ?? (row.page ? <span className="font-sans text-xs text-ink-3">{NO_FORM_VIEWS}</span> : "–")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="grid gap-8 md:hidden">
                {formRows.map((row) => (
                  <li key={row.form} className="gxc-stat !gap-5">
                    <p className="text-sm font-medium text-ink">{PULSE_FORM_LABEL[row.form]}</p>
                    <dl className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-13 gap-y-3 text-sm">
                      <dt className="text-ink-3">Accepted</dt>
                      <dd className="num text-right font-semibold text-ink">{number.format(row.accepted)}</dd>
                      {row.page ? (
                        <>
                          <dt className="text-ink-3">
                            Views of <span className="break-all font-mono text-[0.8125rem]">{row.page}</span>
                          </dt>
                          <dd className="num text-right text-ink-2">{number.format(row.views)}</dd>
                          <dt className="text-ink-3">Accepted ÷ views</dt>
                          <dd className="num text-right text-ink-2">{row.ratio ?? <span className="font-sans text-xs text-ink-3">{NO_FORM_VIEWS}</span>}</dd>
                        </>
                      ) : (
                        <dt className="col-span-2 text-ink-3">{NO_FORM_PAGE}</dt>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              title="Search"
              note="A search is counted when a query is shown on the search page, or when a result is opened from the command bar. A term is listed only when what was typed was exactly one of the site’s own terms; every other search is in “Not one of the site’s terms”, and what was typed was never sent or kept, so it cannot be shown. The terms are the 25 largest."
            >
              <Figures
                items={[
                  { label: "Searches", value: summary.search.total },
                  { label: "Exactly one of the site’s terms", value: matched + summary.search.other },
                  { label: "Not one of the site’s terms", value: summary.search.unmatched },
                ]}
              />
              <div className="mt-21 max-w-[34rem]">
                <BarTable title="Terms searched for" column="Term" rows={summary.search.by_term} empty="No search in this period was exactly one of the site’s terms." />
              </div>
              {summary.search.other > 0 && (
                <p className="mt-13 max-w-measure text-xs text-ink-3">
                  <span className="num">{number.format(summary.search.other)}</span> of the matched searches are not itemised: on a day with more than 1,000 different terms, further terms are added together.
                </p>
              )}
            </Card>

            <Notice title="Read these as counts, not as audited figures">
              Automated visitors that say what they are are left out; others are not. Visitors who switched counting off, or whose browser sends Global Privacy Control or Do Not Track, are not in the page views or the searches. The counter can be called by anyone who studies the
              site, so a total can be inflated on purpose, and under a flood of requests it drops events instead of queueing them.
            </Notice>
          </div>
        </>
      )}
    </>
  );
}
