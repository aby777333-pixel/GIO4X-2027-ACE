import Link from "next/link";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { Icon, type IconName } from "@/components/control/icons";
import { CONTENT_PATH, FAQ_CONSOLE_PATH, FAQ_ORIGIN_LABEL, type FaqCounts, type FaqListItem, type FaqOrigin } from "@/components/control/views/content-shared";
import type { FaqCategory } from "@/data/faqs";
import { FAQ_PATH } from "@/lib/faq";

/** The list's filter. "" is every question. */
export const FAQ_SHOW = ["code", "replaced", "added", "hidden", "draft"] as const;
export type FaqShow = (typeof FAQ_SHOW)[number];

const SHOW_LABEL: Record<FaqShow, string> = {
  code: "From the code",
  replaced: "Replaced",
  added: "Added",
  hidden: "Hidden",
  draft: "Drafts",
};

export type FaqListViewProps = {
  /** the questions to list, already filtered, in the order of the website */
  items: FaqListItem[];
  categories: FaqCategory[];
  /** counted from every question, whatever the filter; null when the rows could not be read */
  counts: FaqCounts | null;
  show: FaqShow | "";
  q: string;
  /** may add a question or start a replacement (content.write or content.publish) */
  canAdd: boolean;
  /** the console's rows could not be read: the list is the code's questions alone */
  failed: boolean;
  error?: string;
};

// shape + words, never colour alone
const ORIGIN_CLASS: Record<FaqOrigin, string> = {
  code: "state-off",
  replaced: "state-overlap",
  added: "state-open",
  hidden: "state-pre",
};

const TILES: { key: keyof FaqCounts; label: string; icon: IconName; show: FaqShow | "" }[] = [
  { key: "live", label: "On the website", icon: "reports", show: "" },
  { key: "code", label: "From the code", icon: "documents", show: "code" },
  { key: "replaced", label: "Replaced", icon: "tasks", show: "replaced" },
  { key: "added", label: "Added", icon: "inbox", show: "added" },
  { key: "hidden", label: "Hidden", icon: "audit", show: "hidden" },
  { key: "drafts", label: "Drafts", icon: "clock", show: "draft" },
];

/** Where a question stands, in words a person can act on. */
function standing(item: FaqListItem): string {
  if (item.orphan) return "Not used: the question it was written for is no longer in the code";
  if (item.origin === "hidden") return "Not on the website";
  if (item.status === "draft") return item.origin === "code" ? "A draft replacement is saved; the website shows the code’s text" : "Draft: not on the website";
  if (item.open) return "On the website, marked “not yet published”";
  return "On the website";
}

/**
 * Every question of the FAQ, grouped by category in the order of the website,
 * each with where it comes from and where it stands. Presentation only: the
 * page composed the list and validated the filters.
 */
export function FaqListView({ items, categories, counts, show, q, canAdd, failed, error }: FaqListViewProps) {
  const filtered = !!(show || q);
  const grouped = categories.map((c) => ({ category: c, items: items.filter((i) => i.cat === c.key) })).filter((g) => g.items.length);
  // a row in a category the code no longer has still has to be reachable
  const stray = items.filter((i) => !categories.some((c) => c.key === i.cat));

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href={CONTENT_PATH} className="link-quiet">
          Content
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Help &amp; FAQ</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title="Help & FAQ"
          lead={
            <>
              The questions on the website’s FAQ page. The code holds the original list; a change made here sits on top of it and can always be undone.{" "}
              <a href={FAQ_PATH} className="link" target="_blank" rel="noopener">
                Open the FAQ on the website<span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </>
          }
          actions={
            canAdd ? (
              <Link href={`${FAQ_CONSOLE_PATH}/new`} className="btn btn-primary">
                Add a question
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="mt-21 grid gap-13 empty:hidden">
        {error && <Notice title={error} tone="error" />}
        {failed && (
          <Notice title="The changes made here could not be read" tone="error">
            The database did not answer, so the list below is the code’s questions alone and may not match the website. Reload the page; if this continues, check that the migrations have been applied.
          </Notice>
        )}
      </div>

      {counts && (
        <ul className="mt-21 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6" aria-label="Questions by where they stand">
          {TILES.map((tile) => (
            <li key={tile.key} className="grid">
              <Link href={tile.show ? `${FAQ_CONSOLE_PATH}?show=${tile.show}` : FAQ_CONSOLE_PATH} className="gxc-stat" aria-current={show === tile.show && !q ? "page" : undefined}>
                <span className="gxc-stat-icon">
                  <Icon name={tile.icon} size={16} />
                </span>
                <span className="gxc-stat-label">{tile.label}</span>
                <span className="gxc-stat-value">{counts[tile.key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form method="get" action={FAQ_CONSOLE_PATH} role="search" aria-label="Filter questions" className="mt-21 grid gap-13 border-b border-line pb-21 sm:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="field">
          <label htmlFor="faq-q">Words in the question</label>
          <input id="faq-q" name="q" type="search" className="input" defaultValue={q} maxLength={100} placeholder="For example: margin, deposit" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="faq-show">Show</label>
          <select id="faq-show" name="show" className="select" defaultValue={show}>
            <option value="">Every question</option>
            {FAQ_SHOW.map((s) => (
              <option key={s} value={s}>
                {SHOW_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href={FAQ_CONSOLE_PATH} className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <div className="mt-13">
          {filtered ? (
            <Empty title="Nothing matches">
              <p>
                {show === "replaced" || show === "added" || show === "hidden" || show === "draft" ? "No question stands like that, or none that also has these words. " : "No question has these words. "}
                <Link href={FAQ_CONSOLE_PATH} className="link">
                  See every question
                </Link>
                .
              </p>
            </Empty>
          ) : (
            <Empty title="There are no questions">
              <p>The code holds no FAQ and nothing has been added here.</p>
            </Empty>
          )}
        </div>
      ) : (
        <div className="mt-21 grid gap-13">
          {grouped.map(({ category, items: rows }) => (
            <Group key={category.key} id={category.key} title={category.label} blurb={category.blurb} rows={rows} />
          ))}
          {stray.length > 0 && <Group id="other" title="In a category the website no longer has" blurb="Not shown on the website." rows={stray} />}
        </div>
      )}

      <p className="mt-21 max-w-measure text-xs text-ink-3">
        The number before each question is its place within the category: the code’s questions stand at 10, 20, 30 and so on, and a new question is given a number of its own, so 25 puts it between the second and the third.
      </p>
    </>
  );
}

function Group({ id, title, blurb, rows }: { id: string; title: string; blurb: string; rows: FaqListItem[] }) {
  return (
    <section aria-labelledby={`faq-cat-${id}`} className="gxc-card min-w-0">
      <div className="gxc-card-head">
        <h2 id={`faq-cat-${id}`} className="gxc-card-title">
          {title}
        </h2>
        <p className="num text-xs text-ink-3">
          {rows.length} {rows.length === 1 ? "question" : "questions"}
        </p>
      </div>
      <div className="gxc-card-body">
        {blurb && <p className="text-xs text-ink-3">{blurb}</p>}
        <ul className="mt-8 border-t border-line" aria-label={`${title}: questions`}>
          {rows.map((item) => (
            <li key={item.key} data-origin={item.origin} data-status={item.status ?? "none"} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-8 gap-y-5 border-b border-line py-13 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,17rem)] md:gap-x-21">
              <span className="num pt-[0.125rem] text-xs text-ink-3" title="Place within the category">
                <span className="sr-only">Place </span>
                {item.orphan ? "–" : item.place}
              </span>
              <div className="min-w-0">
                <Link href={item.href} className={`link break-words text-sm font-medium ${item.origin === "hidden" ? "line-through decoration-ink-3" : ""}`}>
                  {item.question}
                </Link>
              </div>
              <div className="col-start-2 min-w-0 md:col-start-3">
                <span className={`state ${item.orphan ? "state-off" : ORIGIN_CLASS[item.origin]}`}>{item.orphan ? "Not used" : FAQ_ORIGIN_LABEL[item.origin]}</span>
                <p className="mt-3 text-xs text-ink-3">
                  {standing(item)}
                  {item.changedAt && (
                    <>
                      {" "}
                      · changed <span className="num whitespace-nowrap">{fmtDateTime(item.changedAt)}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
