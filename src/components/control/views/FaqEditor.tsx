"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hideFaqQuestion, saveFaqEntry, setFaqStatus } from "@/app/control/actions-content";
import { BlogBody } from "@/components/blog/BlogBody";
import { Notice } from "@/components/control/bits";
import { SubmitButton } from "@/components/control/SubmitButton";
import { FAQ_ERRORS, type FaqFormState, type FaqIntent } from "@/components/control/views/content-shared";
import type { Faq, FaqCategory } from "@/data/faqs";
import { FAQ_DEFAULT_POSITION, FAQ_LIMITS, FAQ_PATH, faqAnchor, faqAnswerProblem, faqChecks, isFaqCategory } from "@/lib/faq";
import type { FaqEntryRow, FaqStatus } from "@/lib/supabase/types";

const STANDARDS_PATH = "/trust/editorial-standards";
const NO_STATE: FaqFormState = {};

export type FaqPlace = { place: number; q: string };

export type FaqEditorProps = {
  /** null: nothing is saved for this question yet */
  entry: FaqEntryRow | null;
  /** the question in the code that this entry replaces or hides; null for a new question */
  base: Faq | null;
  /** the place of the code's question within its category (10, 20, 30…) */
  basePlace: number | null;
  categories: FaqCategory[];
  /** the code's questions in each category with their places, so a new question can be put between two of them */
  places: Record<string, FaqPlace[]>;
  /** may create a draft and edit a draft (content.write) */
  canWrite: boolean;
  /** may publish, hide, take off the website, and edit what is published or hidden (content.publish) */
  canPublish: boolean;
};

/** Everything being typed. Saved values arrive in `entry`; saving is the server action's job. */
type Values = { question: string; answer: string; category: string; position: string };

function initialValues(entry: FaqEntryRow | null, base: Faq | null, categories: FaqCategory[]): Values {
  if (entry) return { question: entry.question, answer: entry.answer, category: entry.category, position: String(entry.position) };
  // a replacement starts from the words it replaces
  if (base) return { question: base.q, answer: base.a, category: base.cat, position: String(FAQ_DEFAULT_POSITION) };
  return { question: "", answer: "", category: categories[0]?.key ?? "", position: String(FAQ_DEFAULT_POSITION) };
}

/* -------------------------------------------------------------------------- */
/* small parts                                                                */
/* -------------------------------------------------------------------------- */

function Card({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="gxc-card min-w-0 scroll-mt-[5rem]">
      <div className="gxc-card-head">
        <h2 id={`${id}-h`} className="gxc-card-title">
          {title}
        </h2>
        {aside}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}

/** Characters used against the limits, in figures and, when outside them, in words. */
function Count({ value, min, max, name }: { value: string; min: number; max: number; name: string }) {
  const n = value.trim().length;
  const over = n > max;
  const under = n > 0 && n < min;
  return (
    <span data-count={name} className={`num shrink-0 whitespace-nowrap ${over || under ? "font-semibold text-neg" : ""}`}>
      {n.toLocaleString("en-GB")} / {max.toLocaleString("en-GB")}
      {over ? " · too long" : under ? " · too short" : ""}
    </span>
  );
}

/** The plain-words line under a field, with the character count at its end. */
function Hint({ id, children, count }: { id: string; children: ReactNode; count?: ReactNode }) {
  return (
    <div id={id} className="flex items-start justify-between gap-13 text-xs text-ink-3">
      <div className="min-w-0">{children}</div>
      {count}
    </div>
  );
}

function NewTab({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="link">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const SYNTAX: { mark: string; means: string }[] = [
  { mark: "**bold**", means: "bold" },
  { mark: "*italic*", means: "italic" },
  { mark: "`code`", means: "a term shown as code" },
  { mark: "[words](/path)", means: "a link to a page on this site" },
  { mark: "[words](https://…)", means: "a link elsewhere: opens in a new tab" },
  { mark: "- item", means: "a list" },
  { mark: "1. item", means: "a numbered list" },
  { mark: "> words", means: "a quotation" },
];

const STATE: Record<FaqStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "state-off" },
  published: { label: "Published", cls: "state-open" },
  hidden: { label: "Hidden", cls: "state-pre" },
};

/* -------------------------------------------------------------------------- */
/* the editor                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Writes one FAQ entry: a new question, or the replacement for a question in
 * the code, whose original words are shown beside it and cannot be changed
 * here.
 *
 * What is offered follows the role and where the entry stands, as a courtesy:
 * the server actions check the role again, and the database has the final
 * say. A refusal comes back as a fixed code and the form keeps what was typed.
 */
export function FaqEditor({ entry, base, basePlace, categories, places, canWrite, canPublish }: FaqEditorProps) {
  const start = useMemo(() => initialValues(entry, base, categories), [entry, base, categories]);
  const [values, setValues] = useState<Values>(start);
  const [state, formAction, pending] = useActionState(saveFaqEntry, NO_STATE);
  const problemRef = useRef<HTMLDivElement>(null);

  const status: FaqStatus | null = entry?.status ?? null;
  // an entry about a question the code no longer has: the website ignores it, and there is nothing to edit it against
  const orphan = !!entry && entry.base_id !== null && !base;
  const isPublic = status === "published" || status === "hidden";
  // what the public sees is content.publish's to change; a draft is a writer's too
  const editable = !orphan && (isPublic ? canPublish : canWrite || canPublish);
  const ro = !editable;
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(start), [values, start]);
  const bad = useMemo(() => new Set(state.fields ?? []), [state]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  // a refusal: bring the reason into view
  useEffect(() => {
    if (state.error) problemRef.current?.scrollIntoView({ block: "center" });
  }, [state]);

  // leaving the page with unsaved words asks first; saving navigates inside the app and does not ask
  useEffect(() => {
    if (!dirty || ro) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, ro]);

  const flags = faqChecks(values);
  const answerProblem = faqAnswerProblem(values.answer);
  const positionOk = /^\d{1,4}$/.test(values.position.trim()) || values.position.trim() === "";
  const categoryLabel = categories.find((c) => c.key === values.category)?.label ?? "";
  const neighbours = places[values.category] ?? [];
  const sameAsOriginal = !!base && values.question.trim() === base.q.trim() && values.answer.trim() === base.a.trim();
  const liveUrl = status === "published" && !orphan ? `${FAQ_PATH}#${base ? base.id : entry ? faqAnchor(entry.id) : ""}` : null;

  const invalid = (name: string, also = false) => (bad.has(name) || also ? true : undefined);

  return (
    <div className="grid gap-13">
      <div ref={problemRef} className="grid gap-13 empty:hidden">
        {state.error && <Notice title={FAQ_ERRORS[state.error]} tone="error" />}
        {orphan && (
          <Notice title="Not used">
            The question this entry was written for is no longer in the website’s code, so the website ignores it. Its words are kept here; if they are still wanted, add them as a new question.
          </Notice>
        )}
        {ro && !orphan && (
          <Notice title="Read-only">
            {!canWrite && !canPublish
              ? "Your role can read the website’s content here but cannot change it."
              : status === "hidden"
                ? "This question is hidden on the website. Only someone whose role includes publishing can change that, or the words kept here."
                : "This entry is published. What the website shows can be changed or taken away only by someone whose role includes publishing, so that it is never altered by a writer alone. Ask them to make the change."}
          </Notice>
        )}
      </div>

      <form action={formAction} className="grid items-start gap-13 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        {!entry && base && <input type="hidden" name="base_id" value={base.id} />}
        {/* a replacement keeps the place of the question it replaces: the number is stored and not used */}
        {base && <input type="hidden" name="position" value={values.position} />}

        <div className="grid min-w-0 gap-13">
          <Card id="words" title={base ? "The replacement" : "Question and answer"}>
            <div className={`grid gap-21 ${base ? "xl:grid-cols-2 xl:items-start" : ""}`}>
              {base && (
                <aside aria-labelledby="faq-original-h" className="min-w-0 rounded-md border border-line bg-surface-2 p-13 xl:order-2" data-original>
                  <h3 id="faq-original-h" className="text-xs font-semibold text-ink">
                    The original, from the code
                  </h3>
                  <p className="mt-3 text-xs text-ink-3">Read-only: it changes only when the website is deployed. It is what the website shows whenever nothing is published here, and what “Restore the original” brings back.</p>
                  <dl className="mt-13 grid gap-13 text-sm">
                    <div>
                      <dt className="field-label">Question</dt>
                      <dd className="mt-3 break-words font-medium text-ink">{base.q}</dd>
                    </div>
                    <div>
                      <dt className="field-label">Answer</dt>
                      <dd className="mt-3 break-words text-ink-2">
                        {base.kind === "open" && <span className="state state-pre mb-5">Marked “not yet published”</span>}
                        <span className="block">{base.a}</span>
                      </dd>
                    </div>
                    {base.links && base.links.length > 0 && (
                      <div>
                        <dt className="field-label">Links listed under it</dt>
                        <dd className="mt-3 text-ink-2">
                          <ul className="grid gap-3">
                            {base.links.map((l) => (
                              <li key={l.href} className="break-words">
                                {l.label} <span className="num text-xs text-ink-3">{l.href}</span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="field-label">Place</dt>
                      <dd className="mt-3 text-ink-2">
                        <span className="num">{basePlace ?? "–"}</span> in {categories.find((c) => c.key === base.cat)?.label ?? base.cat}
                      </dd>
                    </div>
                  </dl>
                  {(base.kind === "open" || (base.links && base.links.length > 0)) && (
                    <ul className="mt-13 grid gap-5 border-t border-line pt-13 text-xs text-ink-3">
                      {base.kind === "open" && <li>The code says this answer is not yet published. A published replacement is shown as a settled answer and is offered to search engines as one: publish only what is confirmed.</li>}
                      {base.links && base.links.length > 0 && <li>The links listed under the original are not carried over. Put any link the answer needs inside the answer.</li>}
                    </ul>
                  )}
                </aside>
              )}

              <div className="grid min-w-0 gap-21">
                <div className="field">
                  <label htmlFor="faq-question">Question</label>
                  <input
                    id="faq-question"
                    name="question"
                    type="text"
                    className="input"
                    value={values.question}
                    onChange={(e) => set("question", e.target.value)}
                    minLength={FAQ_LIMITS.questionMin}
                    maxLength={FAQ_LIMITS.question}
                    required
                    readOnly={ro}
                    autoComplete="off"
                    aria-invalid={invalid("question")}
                    aria-describedby="faq-question-hint"
                  />
                  <Hint id="faq-question-hint" count={<Count name="question" value={values.question} min={FAQ_LIMITS.questionMin} max={FAQ_LIMITS.question} />}>
                    As a visitor would ask it, ending with a question mark. {FAQ_LIMITS.questionMin} to {FAQ_LIMITS.question} characters.
                  </Hint>
                </div>

                <div className="field min-w-0">
                  <label htmlFor="faq-answer">Answer</label>
                  <textarea
                    id="faq-answer"
                    name="answer"
                    className="textarea"
                    style={{ minHeight: "13rem" }}
                    value={values.answer}
                    onChange={(e) => set("answer", e.target.value)}
                    required
                    readOnly={ro}
                    aria-invalid={invalid("answer", values.answer.trim().length > FAQ_LIMITS.answer || answerProblem !== null)}
                    aria-describedby="faq-answer-hint"
                  />
                  <Hint id="faq-answer-hint" count={<Count name="answer" value={values.answer} min={FAQ_LIMITS.answerMin} max={FAQ_LIMITS.answer} />}>
                    Whole sentences. Leave an empty line between paragraphs. {FAQ_LIMITS.answerMin} to {FAQ_LIMITS.answer.toLocaleString("en-GB")} characters. HTML is not understood: it is shown to the visitor as typed.
                    {answerProblem && (
                      <span className="mt-3 block font-medium text-neg" data-answer-problem={answerProblem}>
                        {answerProblem === "heading" ? "An answer cannot contain a heading (a line starting with ##): the question is the heading." : "An answer cannot contain a picture: answers are text only."}
                      </span>
                    )}
                  </Hint>
                </div>

                <aside aria-labelledby="faq-syntax-h" className="min-w-0 rounded-md border border-line bg-surface-2 p-13">
                  <h3 id="faq-syntax-h" className="text-xs font-semibold text-ink">
                    What the answer understands
                  </h3>
                  <dl className="mt-8 grid grid-cols-2 gap-x-13 gap-y-5 text-xs">
                    {SYNTAX.map((s) => (
                      <div key={s.mark}>
                        <dt className="break-words font-mono text-ink">{s.mark}</dt>
                        <dd className="text-ink-3">{s.means}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-8 text-xs text-ink-3">Nothing else: no headings, no pictures, no HTML. A link goes to a page on this site or to an https address.</p>
                </aside>

                <div className={`grid gap-21 ${base ? "" : "sm:grid-cols-2 sm:items-start"}`}>
                  <div className="field">
                    <label htmlFor="faq-category">Category</label>
                    <select id="faq-category" name="category" className="select" value={values.category} onChange={(e) => set("category", e.target.value)} disabled={ro} aria-invalid={invalid("category")} aria-describedby="faq-category-hint">
                      {categories.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                      {!isFaqCategory(values.category) && <option value={values.category}>{values.category || "Choose a category"}</option>}
                    </select>
                    <Hint id="faq-category-hint">
                      {base
                        ? values.category === base.cat
                          ? "The section of the FAQ the question sits in. Changing it moves the published replacement to that section."
                          : `Once published, the question moves from ${categories.find((c) => c.key === base.cat)?.label ?? base.cat} to ${categoryLabel}.`
                        : "The section of the FAQ the question appears in."}
                    </Hint>
                  </div>

                  {!base && (
                    <div className="field">
                      <label htmlFor="faq-position">Place in the category</label>
                      <input
                        id="faq-position"
                        name="position"
                        type="number"
                        inputMode="numeric"
                        className="input num"
                        value={values.position}
                        onChange={(e) => set("position", e.target.value)}
                        min={0}
                        max={FAQ_LIMITS.positionMax}
                        step={1}
                        readOnly={ro}
                        aria-invalid={invalid("position", !positionOk)}
                        aria-describedby="faq-position-hint"
                      />
                      <Hint id="faq-position-hint">
                        A whole number from 0 to {FAQ_LIMITS.positionMax.toLocaleString("en-GB")}. The code’s questions stand at 10, 20, 30 and so on; a lower number comes first. {FAQ_DEFAULT_POSITION.toLocaleString("en-GB")} puts the question after them.
                      </Hint>
                    </div>
                  )}
                </div>

                {!base && neighbours.length > 0 && (
                  <details className="text-xs text-ink-3" data-places>
                    <summary className="cursor-pointer font-medium text-ink-2">Where the code’s questions stand in {categoryLabel}</summary>
                    <ol className="mt-8 grid gap-3">
                      {neighbours.map((p) => (
                        <li key={p.place} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-8">
                          <span className="num">{p.place}</span>
                          <span className="break-words">{p.q}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          </Card>

          <Card id="preview" title="As a visitor sees it">
            <div className="rounded-md border border-line p-13 sm:p-21" data-preview="faq">
              <p className="label">{categoryLabel || "No category"}</p>
              <p className="mt-8 break-words text-[1.0625rem] font-medium leading-snug text-ink">{values.question.trim() || "The question appears here"}</p>
              {values.answer.trim() ? <BlogBody source={values.answer} className="mt-13 !text-[length:inherit]" /> : <p className="mt-13 text-sm text-ink-3">The answer is empty.</p>}
            </div>
            <p className="mt-13 text-xs text-ink-3">Drawn as you type by the same code the website uses, so the paragraphs, lists and links are what a visitor gets. The page around it is the website’s own and is not shown here.</p>
          </Card>
        </div>

        <div className="grid min-w-0 gap-13 lg:sticky lg:top-21">
          <Card id="publication" title="Publication" aside={status ? <span className={`state ${STATE[status].cls}`}>{STATE[status].label}</span> : <span className="state state-off">Not saved yet</span>}>
            <div className="grid gap-13">
              <p className="text-sm text-ink-2" data-standing>
                {orphan
                  ? "Not used by the website."
                  : status === null
                    ? base
                      ? "This question is on the website as the code has it. Nothing changes there until a replacement is published."
                      : "Nothing is saved yet, and nothing is on the website."
                    : status === "draft"
                      ? base
                        ? "A draft replacement. The website still shows the code’s text."
                        : "A draft. It is not on the website."
                      : status === "hidden"
                        ? "Hidden: the question is not on the website. The words here are kept and shown to nobody."
                        : base
                          ? "On the website, in place of the code’s text. "
                          : "On the website. "}
                {liveUrl && <NewTab href={liveUrl}>View it on the website</NewTab>}
              </p>

              {!ro && (
                <div className="grid gap-8 border-t border-line pt-13">
                  {status === "published" ? (
                    <IntentButton intent="save" pending={pending} primary>
                      Save changes to the published text
                    </IntentButton>
                  ) : status === "hidden" ? (
                    <>
                      <IntentButton intent="save" pending={pending} primary>
                        Save changes
                      </IntentButton>
                      <IntentButton intent="publish" pending={pending}>
                        Publish the replacement instead
                      </IntentButton>
                    </>
                  ) : (
                    <>
                      {canPublish && (
                        <IntentButton intent="publish" pending={pending} primary>
                          {base ? "Publish the replacement" : "Publish"}
                        </IntentButton>
                      )}
                      <IntentButton intent="save" pending={pending} primary={!canPublish}>
                        Save draft
                      </IntentButton>
                    </>
                  )}
                  <p className="text-xs text-ink-3" role="status" data-dirty>
                    {pending ? "Saving…" : dirty ? "There are unsaved changes." : entry ? "Everything shown is saved." : "Nothing is saved until you press a button."}
                  </p>
                  {!canPublish && <p className="text-xs text-ink-3">Publishing is done by someone whose role includes it. Save the draft and ask them to publish it.</p>}
                  {sameAsOriginal && status !== "published" && <p className="text-xs text-ink-3">The words are the same as the original so far.</p>}
                  {status === "published" && <p className="text-xs text-ink-3">Every saved change to a published entry is recorded in the audit log with your name.</p>}
                </div>
              )}
            </div>
          </Card>

          <Card id="checklist" title="Editorial checklist" aside={<span className={`state ${flags.length ? "state-pre" : "state-open"}`}>{flags.length ? `${flags.length} to look at` : "Nothing flagged"}</span>}>
            {flags.length ? (
              <ul className="grid gap-8" data-checklist>
                {flags.map((flag) => (
                  <li key={flag.key} data-flag={flag.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-8 text-sm text-ink-2">
                    <span aria-hidden className="mt-[0.4rem] h-[0.4375rem] w-[0.4375rem] rounded-full border border-warn bg-warn" />
                    <span>{flag.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2" data-checklist>
                The question ends with a question mark, the answer ends as a sentence, the links work, and none of the wording the standards rule out is used.
              </p>
            )}
            <p className="mt-13 text-xs text-ink-3">
              Reminders, not rules. It reads the text for a few mechanical things and cannot judge whether an answer is accurate: that is the editor’s job. See <NewTab href={STANDARDS_PATH}>Editorial standards</NewTab>.
            </p>
          </Card>
        </div>
      </form>

      {canPublish && !orphan && (base || status === "published") && (
        <Card id="standing" title="On the website">
          <div className="grid gap-21 md:grid-cols-2">
            {entry && base && status !== "draft" && (
              <StatusForm id={entry.id} to="draft" label="Restore the original" blocked={dirty}>
                {status === "hidden" ? "Puts the question back on the website with the code’s text. " : "Puts the code’s text back on the website in place of this replacement. "}
                Nothing is deleted: the words here are kept as a draft.
              </StatusForm>
            )}
            {entry && !base && status === "published" && (
              <StatusForm id={entry.id} to="draft" label="Take this question off the website" blocked={dirty}>
                Removes the question from the website at once. Nothing is deleted: it is kept here as a draft and can be published again.
              </StatusForm>
            )}
            {base && status !== "hidden" && (
              <HideForm entryId={entry?.id ?? null} baseId={base.id} blocked={dirty}>
                Leaves the question off the website altogether: neither the code’s text nor a replacement is shown. It can be restored at any time.
              </HideForm>
            )}
          </div>
          {dirty && <p className="mt-13 text-xs font-medium text-warn">Save your changes first: these act on what is saved, and unsaved words would be lost.</p>}
        </Card>
      )}
    </div>
  );
}

/** One of the editor's submit buttons: it carries what should happen to the entry's status. */
function IntentButton({ intent, pending, primary = false, children }: { intent: FaqIntent; pending: boolean; primary?: boolean; children: ReactNode }) {
  return (
    <button type="submit" name="intent" value={intent} data-intent={intent} className={`btn w-full ${primary ? "btn-primary" : "btn-ghost"}`} disabled={pending} aria-disabled={pending}>
      {children}
    </button>
  );
}

/** Words above a button; the button is dead while there are unsaved words, which the action would discard. */
function ActionBody({ label, blocked, children }: { label: string; blocked: boolean; children: ReactNode }) {
  return (
    <>
      <p className="text-sm text-ink-2">{children}</p>
      <div>
        {blocked ? (
          <button type="button" className="btn btn-ghost" disabled aria-disabled="true">
            {label}
          </button>
        ) : (
          <SubmitButton pending="Saving…" className="btn btn-ghost">
            {label}
          </SubmitButton>
        )}
      </div>
    </>
  );
}

/** A change of status alone, on the saved entry. */
function StatusForm({ id, to, label, blocked, children }: { id: string; to: FaqStatus; label: string; blocked: boolean; children: ReactNode }) {
  return (
    <form action={setFaqStatus} className="grid content-start gap-8" data-status-form={to}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <ActionBody label={label} blocked={blocked}>
        {children}
      </ActionBody>
    </form>
  );
}

/** Hides a question from the code: on its saved entry when there is one, otherwise by making one. */
function HideForm({ entryId, baseId, blocked, children }: { entryId: string | null; baseId: string; blocked: boolean; children: ReactNode }) {
  if (entryId) {
    return (
      <StatusForm id={entryId} to="hidden" label="Hide this question on the website" blocked={blocked}>
        {children}
      </StatusForm>
    );
  }
  return (
    <form action={hideFaqQuestion} className="grid content-start gap-8" data-status-form="hidden">
      <input type="hidden" name="base_id" value={baseId} />
      <ActionBody label="Hide this question on the website" blocked={blocked}>
        {children}
      </ActionBody>
    </form>
  );
}
