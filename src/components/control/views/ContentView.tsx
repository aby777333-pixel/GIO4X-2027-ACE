import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead } from "@/components/control/bits";
import { FAQ_CONSOLE_PATH, type FaqCounts } from "@/components/control/views/content-shared";
import { FAQ_PATH } from "@/lib/faq";

export type ContentViewProps = {
  /** counted from the code's questions and the rows; null when the rows could not be read */
  faq: FaqCounts | null;
  /** how many questions the code holds: known without the database */
  faqInCode: number;
  /** whether this person's menu includes the Blog (blog.read) */
  canReadBlog: boolean;
};

function Card({ id, title, state, children }: { id: string; title: string; state: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="gxc-card flex min-w-0 flex-col">
      <div className="gxc-card-head">
        <h3 id={`${id}-h`} className="gxc-card-title">
          {title}
        </h3>
        {state}
      </div>
      <div className="gxc-card-body flex grow flex-col gap-13 text-sm text-ink-2">{children}</div>
    </section>
  );
}

const HERE = <span className="state state-open">Edited here</span>;
const IN_CODE = <span className="state state-off">In the code</span>;

/**
 * What of the website's words can be changed in the console, and what cannot.
 * Presentation only. The only figures are the FAQ's, counted from the code and
 * from the rows; when the rows could not be read, the figures that depend on
 * them are left out rather than shown as zero.
 */
export function ContentView({ faq, faqInCode, canReadBlog }: ContentViewProps) {
  return (
    <>
      <ControlHead title="Content" lead="The words on the website: which of them are edited here, and which live in the website’s code and change when a new version of the site is deployed." />

      <section aria-labelledby="content-here" className="mt-21">
        <h2 id="content-here" className="label">
          Edited here
        </h2>
        <div className="mt-13 grid gap-13 md:grid-cols-2">
          <Card id="content-faq" title="Help & FAQ" state={HERE}>
            <p>
              The questions on the website’s FAQ page. The code holds the original list; here you can replace an answer, hide a question, or add a new one. A change is on the website within a minute of being published, and the original always comes
              back with one button.
            </p>
            <p className="num text-xs text-ink-3" data-faq-figures>
              {faq
                ? `${faq.live} on the website: ${faq.code} from the code, ${faq.replaced} replaced, ${faq.added} added. ${faq.hidden} hidden. ${faq.drafts} ${faq.drafts === 1 ? "draft" : "drafts"}.`
                : `${faqInCode} questions in the code. What has been changed here could not be read just now.`}
            </p>
            <p className="mt-auto flex flex-wrap items-center gap-13 pt-8">
              <Link href={FAQ_CONSOLE_PATH} className="btn btn-primary btn-sm">
                Edit the FAQ
              </Link>
              <a href={FAQ_PATH} target="_blank" rel="noopener" className="gxc-card-link">
                Open the FAQ on the website<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </Card>

          <Card id="content-blog" title="Blog" state={HERE}>
            <p>The daily blog is written, scheduled and published in its own section, with its pictures and how each post appears in search results.</p>
            <p className="mt-auto pt-8">
              {canReadBlog ? (
                <Link href="/control/blog" className="btn btn-ghost btn-sm">
                  Go to the Blog
                </Link>
              ) : (
                <span className="text-xs text-ink-3">Your role does not include the Blog section.</span>
              )}
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="content-code" className="mt-34">
        <h2 id="content-code" className="label">
          In the code: changed by a deploy
        </h2>
        <p className="mt-8 max-w-measure text-sm text-ink-3">
          These are not edited here yet. Each carries more than words, and needs an editor made for it. Until then, a change is made in the website’s source files, reviewed, and goes live when the site is deployed: ask whoever maintains the website.
        </p>
        <div className="mt-13 grid gap-13 md:grid-cols-3">
          <Card id="content-glossary" title="Glossary" state={IN_CODE}>
            <p>Terms link to one another and to the rest of the site, and the glossary’s quizzes are built from the same list. Changing a term means keeping all of those in step, so it is done in the code.</p>
            <p className="mt-auto pt-8">
              <a href="/glossary" target="_blank" rel="noopener" className="gxc-card-link">
                Open the glossary<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </Card>
          <Card id="content-academy" title="Academy lessons" state={IN_CODE}>
            <p>A lesson is text together with its diagrams and quiz questions, in a set order. Those parts are written and checked together, so a lesson is changed in the code.</p>
            <p className="mt-auto pt-8">
              <a href="/academy" target="_blank" rel="noopener" className="gxc-card-link">
                Open the Academy<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </Card>
          <Card id="content-legal" title="Legal documents" state={IN_CODE}>
            <p>Terms, the privacy and cookie notices and the risk disclosure are versioned: what a person accepted, and when, must stay on record. A new version is written, reviewed and dated in the code, never edited in place.</p>
            <p className="mt-auto pt-8">
              <a href="/legal" target="_blank" rel="noopener" className="gxc-card-link">
                Open the legal documents<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </Card>
        </div>
      </section>
    </>
  );
}
