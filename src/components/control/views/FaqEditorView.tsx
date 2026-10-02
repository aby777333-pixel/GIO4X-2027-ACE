import Link from "next/link";
import { ControlHead, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { CONTENT_PATH, FAQ_CONSOLE_PATH } from "@/components/control/views/content-shared";
import { FaqEditor, type FaqPlace } from "@/components/control/views/FaqEditor";
import type { Faq, FaqCategory } from "@/data/faqs";
import type { AuditRow, FaqEntryRow } from "@/lib/supabase/types";

export type FaqEditorViewProps = {
  /** null: nothing is saved for this question yet (a new question, or a question from the code that nobody has changed) */
  entry: FaqEntryRow | null;
  /** the question in the code that this entry replaces or hides; null for a new question */
  base: Faq | null;
  basePlace: number | null;
  categories: FaqCategory[];
  places: Record<string, FaqPlace[]>;
  /** the audit entries for this entry, newest first (written by the trigger in 0016) */
  audit: Pick<AuditRow, "id" | "at" | "actor" | "action">[];
  auditFailed: boolean;
  names: Map<string, string>;
  me: string;
  /** may create a draft and edit a draft (content.write) */
  canWrite: boolean;
  /** may publish, hide, take off the website, and edit what is published or hidden (content.publish) */
  canPublish: boolean;
  notice?: string;
  error?: string;
};

/** An audit entry in words. */
function describe(action: string, replaces: boolean): string {
  switch (action) {
    case "faq.create":
      return "Draft created";
    case "faq.publish":
      return replaces ? "Replacement published" : "Published";
    case "faq.hide":
      return "Question hidden on the website";
    case "faq.unpublish":
      return replaces ? "Original restored on the website" : "Taken off the website";
    case "faq.edit_published":
      return "Edited while published";
    default:
      return action;
  }
}

/**
 * The frame around the editor: what the entry is, what just happened, and its
 * history. Presentation only; the editor itself (a client component) holds
 * what is being typed, and the server actions do the saving.
 */
export function FaqEditorView({ entry, base, basePlace, categories, places, audit, auditFailed, names, me, canWrite, canPublish, notice, error }: FaqEditorViewProps) {
  const who = (userId: string | null) => (!userId ? "Database (SQL)" : userId === me ? "You" : (names.get(userId) ?? "Former member of staff"));
  const replaces = entry ? entry.base_id !== null : base !== null;
  const title = base ? base.q : entry ? entry.question : "New question";

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href={CONTENT_PATH} className="link-quiet">
          Content
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <Link href={FAQ_CONSOLE_PATH} className="link-quiet">
          Help &amp; FAQ
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">{replaces ? "Question from the code" : entry ? "Added question" : "New question"}</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title={<span className="break-words">{title}</span>}
          lead={
            entry ? (
              <>
                {replaces ? "A question from the code, changed here" : "A question added here"} · last changed <span className="num">{fmtDateTime(entry.updated_at)}</span> by {who(entry.updated_by)} · created{" "}
                <span className="num">{fmtDateTime(entry.created_at)}</span> by {who(entry.created_by)}
              </>
            ) : base ? (
              "This question comes from the website’s code. Write a replacement for its text, or hide it; the original is kept and can always be restored."
            ) : (
              "A question the code does not have. Nothing is on the website until it is published."
            )
          }
        />
      </div>

      <div className="mt-21 grid gap-13 empty:hidden">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
      </div>

      <div className="mt-13">
        {/* a saved entry comes back with a new change time: the editor starts again from what was saved */}
        <FaqEditor key={entry ? `${entry.id}:${entry.updated_at}` : base ? `base:${base.id}` : "new"} entry={entry} base={base} basePlace={basePlace} categories={categories} places={places} canWrite={canWrite} canPublish={canPublish} />
      </div>

      {entry && (
        <section aria-labelledby="faq-history" className="mt-34">
          <h2 id="faq-history" className="label">
            History
          </h2>
          {auditFailed ? (
            <div className="mt-13">
              <Notice title="The history could not be read" tone="error" />
            </div>
          ) : audit.length ? (
            <ol className="mt-13 border-t border-line">
              {audit.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-3 border-b border-line py-8 text-sm">
                  <span className="text-ink">{describe(item.action, replaces)}</span>
                  <span className="text-xs text-ink-3">
                    {who(item.actor)} · <span className="num">{fmtDateTime(item.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-13 border-y border-line py-13 text-sm text-ink-3">Nothing recorded yet.</p>
          )}
          <p className="mt-8 max-w-measure text-xs text-ink-3">Recorded by the database itself: when an entry is created, published, hidden or taken off the website, and every edit made while it is published. Ordinary drafting is not recorded.</p>
        </section>
      )}
    </>
  );
}
