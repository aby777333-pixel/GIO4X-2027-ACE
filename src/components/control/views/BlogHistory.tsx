"use client";

import { useDeferredValue, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import {
  BLOG_REVISION_ERRORS,
  BLOG_REVISION_FIELD_LABEL,
  BLOG_REVISION_FIELDS,
  BLOG_REVISIONS_KEPT,
  changedNote,
  type BlogRevisionMeta,
  type BlogRevisionText,
  type BlogRevisionWords,
  type LoadRevisions,
} from "@/components/control/views/blog-revisions-shared";
import { BLOG_STATUS_LABEL } from "@/lib/blog";
import { diffCounts, diffText, type DiffPart, type DiffResult } from "@/lib/text-diff";

export type BlogHistoryProps = {
  postId: string;
  /** the post's revisions without their words, newest first; null when they could not be read */
  revisions: BlogRevisionMeta[] | null;
  /** what is in the editor's fields at this moment, saved or not */
  current: BlogRevisionWords;
  /** the editor holds unsaved changes */
  dirty: boolean;
  /** the editor's fields can be changed by this person (the editor's own rule: role and where the post stands) */
  canRestore: boolean;
  /** reads the words of the chosen revisions */
  load: LoadRevisions;
  /** puts a revision's words into the editor's fields. It saves nothing. */
  onRestore: (words: BlogRevisionWords) => void;
};

/** The other side of a comparison: a revision by its number, or what is in the editor now. */
type Side = number | "editor";

const SHOWN_AT_FIRST = 8;
/** Side by side from the width at which the console has its sidebar; one column, changes inline, below it. */
const WIDE_QUERY = "(min-width: 1080px)";

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */
/* marked text                                                                */
/* -------------------------------------------------------------------------- */

// Colour is the second signal, never the only one: an addition is an <ins> (underlined), a removal a <del>
// (struck through), and each run says which it is to a screen reader.
const INS = "rounded-xs bg-[color-mix(in_srgb,var(--pos)_20%,transparent)] text-ink underline decoration-pos decoration-2 underline-offset-2";
const DEL = "rounded-xs bg-[color-mix(in_srgb,var(--neg)_18%,transparent)] text-ink line-through decoration-neg";

/** A change that is only a break between paragraphs has nothing to underline: a pilcrow stands for it. */
const breakOnly = (text: string) => text.includes("\n") && text.trim() === "";

/**
 * The runs of a comparison as text. `show` chooses the reading: both kinds of
 * change in one flow (inline), or one side's text with only its own changes
 * (the two columns of the side-by-side view).
 */
function Marked({ parts, show }: { parts: readonly DiffPart[]; show: "both" | "before" | "after" }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "same") return <span key={i}>{part.text}</span>;
        if (part.kind === "add") {
          if (show === "before") return null;
          return (
            <ins key={i} className={INS}>
              <span className="sr-only">[added: </span>
              {breakOnly(part.text) && <span aria-hidden>¶</span>}
              {part.text}
              <span className="sr-only">]</span>
            </ins>
          );
        }
        if (show === "after") return null;
        return (
          <del key={i} className={DEL}>
            <span className="sr-only">[removed: </span>
            {breakOnly(part.text) && <span aria-hidden>¶</span>}
            {part.text}
            <span className="sr-only">]</span>
          </del>
        );
      })}
    </>
  );
}

const TEXT = "whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2";

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

/** "12 words added, 3 removed", counted from the comparison itself. */
function tally(diff: DiffResult): string {
  const { added, removed } = diffCounts(diff.parts);
  return `${plural(added, "word", "words")} added, ${removed.toLocaleString("en-GB")} removed`;
}

/* -------------------------------------------------------------------------- */
/* the panel                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The words of a post over time: its revisions (written by the database each
 * time the words are saved with a change), a comparison of any two of them or
 * of one with what is in the editor now, and a way to put a revision's words
 * back into the editor.
 *
 * It reads; it never saves. Restoring copies words into the editor's fields as
 * unsaved changes, and the editor's own save, with its own rules, does the rest.
 */
export function BlogHistory({ postId, revisions, current, dirty, canRestore, load, onRestore }: BlogHistoryProps) {
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<Side>("editor");
  const [texts, setTexts] = useState<Record<number, BlogRevisionText>>({});
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [problem, setProblem] = useState("");
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState<number | null>(null);
  const [restored, setRestored] = useState<number | null>(null);
  const wide = useWide();
  const id = useId();
  // typing in the editor while a comparison is open must not wait for the comparison
  const editorNow = useDeferredValue(current);

  const before = from === null ? undefined : texts[from];
  const after: BlogRevisionWords | undefined = to === "editor" ? editorNow : texts[to];

  const comparison = useMemo(() => {
    if (!before || !after) return null;
    const fields = BLOG_REVISION_FIELDS.map((field) => ({ field, diff: diffText(before[field], after[field]) }));
    return { fields, same: fields.every((f) => f.diff.same) };
  }, [before, after]);

  /** Reads the words of the revisions a comparison needs and does not have yet. */
  const ensure = async (wanted: Side[], have: Record<number, BlogRevisionText>) => {
    const need = wanted.filter((n, i): n is number => typeof n === "number" && !have[n] && wanted.indexOf(n) === i);
    if (!need.length) {
      setPhase("idle");
      return;
    }
    setPhase("loading");
    setProblem("");
    try {
      const answer = await load(postId, need);
      if (answer.ok) {
        setTexts((t) => {
          const next = { ...t };
          for (const row of answer.rows) next[row.revision] = row;
          return next;
        });
        setPhase("idle");
        return;
      }
      setProblem(BLOG_REVISION_ERRORS[answer.code]);
    } catch {
      setProblem(BLOG_REVISION_ERRORS.read);
    }
    setPhase("error");
  };

  const choose = (nextFrom: number, nextTo: Side) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setAsking(null);
    setRestored(null);
    void ensure([nextFrom, nextTo], texts);
  };

  const restore = (revision: number) => {
    const words = texts[revision];
    if (!words) return;
    onRestore({ title: words.title, excerpt: words.excerpt, body: words.body, seo_title: words.seo_title, seo_description: words.seo_description });
    setAsking(null);
    setRestored(revision);
  };

  if (revisions === null) {
    return (
      <Frame count={null}>
        <Notice title="The revisions could not be read" tone="error">
          The post itself is unaffected. Reload the page; if this continues, check that the migrations have been applied.
        </Notice>
      </Frame>
    );
  }

  const shown = all ? revisions : revisions.slice(0, SHOWN_AT_FIRST);
  const name = (side: Side) => (side === "editor" ? (dirty ? "The editor’s text now (unsaved changes)" : "The editor’s text now") : `Revision ${side}`);
  const sameAsEditor = (revision: number) => {
    const words = texts[revision];
    return !!words && BLOG_REVISION_FIELDS.every((f) => words[f] === current[f]);
  };
  const restorable = from === null ? [] : [from, ...(typeof to === "number" && to !== from ? [to] : [])];
  const changedFields = comparison?.fields.filter((f) => !f.diff.same) ?? [];
  const body = comparison?.fields.find((f) => f.field === "body");
  const small = changedFields.filter((f) => f.field !== "body");

  return (
    <Frame count={revisions.length}>
      {revisions.length === 0 ? (
        <p className="text-sm text-ink-2" data-history-empty>
          No revision has been recorded for this post yet. One is written each time its words are saved with a change.
        </p>
      ) : (
        <>
          <ol className="border-t border-line" aria-label="Revisions, the newest first" data-history-list>
            {shown.map((rev) => (
              <li key={rev.revision} data-revision={rev.revision} className="flex flex-wrap items-center justify-between gap-x-21 gap-y-5 border-b border-line py-8">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="num font-semibold">Revision {rev.revision}</span>
                    <span className="text-ink-3"> · </span>
                    <span data-revision-changed>{changedNote(rev.changed)}</span>
                  </p>
                  <p className="mt-2 text-xs text-ink-3">
                    {rev.by} · <span className="num">{fmtDateTime(rev.saved_at)}</span> · saved as {BLOG_STATUS_LABEL[rev.status].toLowerCase()}
                    {rev.at_publication && <span className="font-medium text-ink-2"> · current at a publication: always kept</span>}
                  </p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" aria-pressed={from === rev.revision} onClick={() => choose(rev.revision, "editor")} data-revision-compare>
                  Compare<span className="sr-only"> revision {rev.revision} with the editor’s text</span>
                </button>
              </li>
            ))}
          </ol>
          {revisions.length > SHOWN_AT_FIRST && (
            <button type="button" className="link mt-8 text-sm" aria-expanded={all} onClick={() => setAll((a) => !a)} data-history-all>
              {all ? `Show only the latest ${SHOWN_AT_FIRST}` : `Show all ${revisions.length} revisions`}
            </button>
          )}
        </>
      )}

      {from !== null && (
        <section aria-labelledby={`${id}-compare`} className="mt-21 border-t border-line pt-13" data-compare>
          <h3 id={`${id}-compare`} className="label">
            Compare
          </h3>
          <div className="mt-8 grid gap-13 sm:grid-cols-2">
            <div className="field">
              <label htmlFor={`${id}-from`}>This version</label>
              <select id={`${id}-from`} className="select" value={from} onChange={(e) => choose(Number(e.target.value), to)} data-compare-from>
                {revisions.map((rev) => (
                  <option key={rev.revision} value={rev.revision}>
                    Revision {rev.revision} · {fmtDateTime(rev.saved_at)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-to`}>with this one</label>
              <select id={`${id}-to`} className="select" value={to} onChange={(e) => choose(from, e.target.value === "editor" ? "editor" : Number(e.target.value))} data-compare-to>
                <option value="editor">{name("editor")}</option>
                {revisions.map((rev) => (
                  <option key={rev.revision} value={rev.revision}>
                    Revision {rev.revision} · {fmtDateTime(rev.saved_at)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-13 text-xs text-ink-3" data-compare-legend>
            How to read it: words only in “{name(to)}” are{" "}
            <ins className={INS} aria-hidden>
              added, underlined
            </ins>
            <span className="sr-only">marked as added and underlined</span>; words only in “{name(from)}” are{" "}
            <del className={DEL} aria-hidden>
              removed, struck through
            </del>
            <span className="sr-only">marked as removed and struck through</span>. A ¶ marks a paragraph break that was added or removed. Everything else is in both.
          </p>

          <div className="mt-13">
            {phase === "loading" && (
              <p role="status" className="text-sm text-ink-3">
                Reading the revision…
              </p>
            )}
            {phase === "error" && (
              <div className="grid justify-items-start gap-8">
                <p role="alert" className="text-sm font-medium text-neg" data-compare-problem>
                  {problem}
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void ensure([from, to], texts)}>
                  Try again
                </button>
              </div>
            )}

            {comparison && phase !== "error" && (
              <div className="grid gap-21" data-compare-result data-compare-layout={wide ? "side-by-side" : "inline"}>
                {comparison.same ? (
                  <p className="text-sm text-ink-2" data-compare-same>
                    These two are the same, word for word: title, excerpt, body, SEO title and meta description.
                  </p>
                ) : (
                  <>
                    {small.length > 0 && (
                      <dl className="grid gap-13">
                        {small.map(({ field, diff }) => (
                          <div key={field} data-compare-field={field}>
                            <dt className="field-label">{BLOG_REVISION_FIELD_LABEL[field]}</dt>
                            <dd className={`mt-3 ${TEXT}`}>
                              <Marked parts={diff.parts} show="both" />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {body && !body.diff.same ? (
                      <div data-compare-field="body" data-compare-mode={body.diff.mode}>
                        <p className="field-label">
                          Body <span className="num font-normal text-ink-3">· {tally(body.diff)}</span>
                        </p>
                        {body.diff.mode !== "words" && (
                          <p className="mt-3 text-xs text-ink-3" data-compare-coarse>
                            {body.diff.mode === "lines"
                              ? "These two differ too much to compare word by word, so the body is compared line by line: a line with any change in it is shown as removed and added whole."
                              : "These two differ too much to compare in detail: everything between the first and the last difference is shown as one removal and one addition."}
                          </p>
                        )}
                        {wide ? (
                          <div className="mt-8 grid grid-cols-2 gap-13">
                            <div className="min-w-0 rounded-md border border-line bg-surface-2 p-13">
                              <p className="text-xs font-semibold text-ink">{name(from)}</p>
                              <div className={`mt-8 ${TEXT}`} data-compare-side="before">
                                <Marked parts={body.diff.parts} show="before" />
                              </div>
                            </div>
                            <div className="min-w-0 rounded-md border border-line bg-surface-2 p-13">
                              <p className="text-xs font-semibold text-ink">{name(to)}</p>
                              <div className={`mt-8 ${TEXT}`} data-compare-side="after">
                                <Marked parts={body.diff.parts} show="after" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`mt-8 rounded-md border border-line bg-surface-2 p-13 ${TEXT}`} data-compare-side="both">
                            <Marked parts={body.diff.parts} show="both" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-2" data-compare-body-same>
                        The body is the same in both.
                      </p>
                    )}
                  </>
                )}

                <div className="grid gap-8 border-t border-line pt-13" data-restore>
                  {!canRestore ? (
                    <p className="text-xs text-ink-3">A revision can be put back into the editor only by someone who can change this post.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-8">
                        {restorable.map((revision) =>
                          sameAsEditor(revision) ? (
                            <p key={revision} className="text-sm text-ink-2" data-restore-same={revision}>
                              Revision {revision} is what the editor holds now.
                            </p>
                          ) : (
                            <button
                              key={revision}
                              type="button"
                              className="btn btn-ghost"
                              disabled={!texts[revision]}
                              onClick={() => (dirty ? setAsking(revision) : restore(revision))}
                              data-restore-button={revision}
                            >
                              Restore revision {revision} into the editor
                            </button>
                          ),
                        )}
                      </div>
                      {asking !== null && (
                        <div role="alert" className="panel-quiet border-l-2 border-l-accent px-21 py-13" data-restore-ask>
                          <p className="text-sm font-semibold text-ink">The editor has unsaved changes</p>
                          <p className="mt-3 max-w-measure text-sm text-ink-2">
                            Restoring replaces what is typed in the title, excerpt, body, SEO title and meta description with revision {asking}. The unsaved words in those fields would be lost.
                          </p>
                          <div className="mt-8 flex flex-wrap gap-8">
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => restore(asking)} data-restore-confirm>
                              Replace them with revision {asking}
                            </button>
                            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAsking(null)}>
                              Keep what is typed
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-ink-3">
                        Restoring copies the revision’s title, excerpt, body, SEO title and meta description into the editor as unsaved changes. It saves nothing and publishes nothing: you then save, or not, as usual.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <p role="status" className="mt-13 text-sm font-medium text-ink empty:hidden" data-restore-said>
            {restored !== null && (
              <>
                Revision {restored} is in the editor’s fields as unsaved changes. Nothing is saved until you press one of the save buttons.{" "}
                <a href="#content" className="link">
                  Go to the editor’s fields
                </a>
              </>
            )}
          </p>
        </section>
      )}

      <p className="mt-13 max-w-measure text-xs text-ink-3">
        Written by the database each time the title, excerpt, body, SEO title or meta description is saved with a change; a change to anything else writes none. The latest {BLOG_REVISIONS_KEPT} are kept, and beyond them the revision that was
        current each time the post was published. Nobody can edit or delete a revision in the console.
      </p>
    </Frame>
  );
}

/** The card the panel sits in, as the editor's other cards are drawn. */
function Frame({ count, children }: { count: number | null; children: ReactNode }) {
  return (
    <section id="revisions" aria-labelledby="revisions-h" className="gxc-card min-w-0 scroll-mt-[5rem]" data-history>
      <div className="gxc-card-head">
        <h2 id="revisions-h" className="gxc-card-title">
          History of the text
        </h2>
        {count !== null && (
          <span className="num text-xs text-ink-3" data-history-count>
            {count} {count === 1 ? "revision" : "revisions"}
          </span>
        )}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}
