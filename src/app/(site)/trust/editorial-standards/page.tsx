import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { AgeingLine } from "@/components/figures/trust/AgeingLine";
import { FactOrAnalysis } from "@/components/figures/trust/FactOrAnalysis";
import { ColumnNote, NotedChapter } from "@/components/figures/trust/NotedChapter";
import { OpenCorrection } from "@/components/figures/trust/OpenCorrection";
import { JsonLd } from "@/components/seo/JsonLd";
import { AskGio4x, Chapter, Rows } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "How GIO4X Intelligence handles sources, the line between fact and analysis, desk bylines, corrections, market data, updates and the conflict of interest a broker has when it publishes.";

export const metadata = pageMeta({ title: "Editorial standards", description, path: "/trust/editorial-standards" });

export default function EditorialStandardsPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/editorial-standards", name: "Editorial standards", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "Editorial standards", href: "/trust/editorial-standards" },
        ]}
        eyebrow="Editorial standards"
        title="How GIO4X Intelligence is written."
        lead="GIO4X Intelligence explains markets. It is published by a broker, and a reader is entitled to know what that means for what they are reading. These are the rules it is written under."
      />

      <section className="section-quiet" aria-labelledby="conflict">
        <div className="wrap phi items-start">
          <figure className="border-y border-line-strong py-34" data-reveal suppressHydrationWarning>
            <p className="label">Conflict of interest</p>
            <blockquote className="mt-13 max-w-[30ch] font-display text-xl leading-[1.35] text-ink md:text-2xl">GIO4X is a broker. It earns money when clients trade.</blockquote>
            <figcaption className="mt-21 max-w-measure text-ink-2">
              That gives GIO4X a commercial interest in readers trading more often. It is the reason nothing in Intelligence tells you to trade, and the reason this sentence is at the top of the page and not in a footnote.
            </figcaption>
          </figure>
          <div data-reveal suppressHydrationWarning>
            <h2 id="conflict" className="eyebrow">
              What follows from it
            </h2>
            <ul className="mt-21 border-t border-line">
              {[
                "No article recommends buying or selling an instrument, or says when to do it.",
                "No price targets, forecasts or probability of a move.",
                "No urgency: no countdowns, no “before it is too late”.",
                "An article that mentions a GIO4X product says that it is a GIO4X product.",
              ].map((x) => (
                <li key={x} className="flat relative border-b border-line py-13 pl-21 text-ink-2 before:absolute before:left-0 before:top-[1.6em] before:h-px before:w-8 before:bg-accent">
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-13 text-sm text-ink-3">{educationalNote}</p>
          </div>
        </div>
      </section>

      <NotedChapter
        id="sources"
        eyebrow="Sources"
        title="Primary sources first, and named."
        paper
        note={
          <ColumnNote label="In practice">
            Where an article links to its source, follow the link and read the statement where it was made. The numbers in an article follow the same rule, set out in the{" "}
            <Link href="/trust/data-methodology" className="link">
              data methodology
            </Link>
            .
          </ColumnNote>
        }
      >
        <Rows
          items={[
            {
              t: "Where facts come from",
              d: "A fact about policy, the economy or a market’s rules is taken from the body that produced it: a central bank, a statistical agency, an exchange, a regulator’s published text. Where an article relies on such a source it names it and, where one exists, links to it.",
            },
            { t: "What is not used", d: "Unattributed social-media posts, rumours, anonymous tips and figures that cannot be traced to a published source are not used as the basis for a statement of fact." },
            { t: "When a source cannot be found", d: "The statement is removed or rewritten as what it is: an opinion, an illustration or an open question." },
          ]}
        />
      </NotedChapter>

      <NotedChapter
        id="fact-and-analysis"
        eyebrow="Facts and analysis"
        title="The reader should always know which one they are reading."
        flip
        note={
          <FigureNote figure={<FactOrAnalysis />} label="Two quick checks">
            The format label comes first: every article in{" "}
            <Link href="/intelligence" className="link">
              GIO4X Intelligence
            </Link>{" "}
            carries one. The words of explanation come second: where they appear, the sentence describes a relationship and does not state a fact.
          </FigureNote>
        }
      >
        <Rows
          items={[
            { t: "Facts are stated as facts", d: "What was announced, what a rule says, how an instrument is specified. These can be checked against the source." },
            {
              t: "Analysis is marked by its language",
              d: "Explanation of why something may matter uses the words of explanation: “commonly monitored”, “can be sensitive to”, “has historically”. It describes relationships. It does not say what will happen next.",
            },
            { t: "Format labels say what a piece is", d: "Each article carries a format, such as Explainer, Guide or Analysis, so that a reader knows before starting whether it teaches a mechanism or discusses a market." },
            { t: "Worked examples are labelled", d: "A figure invented to show how a calculation works is called an example, uses round numbers, and is never presented as a market price." },
          ]}
        />
      </NotedChapter>

      <Chapter id="bylines" eyebrow="Bylines" title="Desks, not invented people." paper>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            Articles are published under the name of a desk. A desk byline says honestly who stands behind a piece: the organisation. GIO4X does not attach an article to a named individual unless that person exists, wrote or reviewed it, and has agreed to be named.
          </p>
          <p>There are no stock portraits, no composite “analysts” and no credentials that cannot be verified. The previous website carried named authors that could not be confirmed; those names were not carried over.</p>
        </div>
      </Chapter>

      <NotedChapter
        id="corrections"
        eyebrow="Corrections"
        title="A mistake is corrected in the open."
        flip
        note={
          <FigureNote figure={<OpenCorrection />} label="Worth knowing">
            A correction never moves the publication date. The date a piece first appeared stays as it is, and the date of the material update is shown with it.
          </FigureNote>
        }
      >
        <Rows
          numbered
          items={[
            { t: "A visible note, with a date.", d: "When a factual article changes materially, a correction note appears on the article itself, stating what was changed and the date of the change. The article is not silently rewritten." },
            { t: "What counts as material.", d: "Anything a reader might have relied on: a figure, a date, a name, the description of a rule or a product. Fixing a typing error or a broken link is not material and is not noted." },
            { t: "Both dates are shown.", d: "An updated article shows the date it was first published and the date of its last material update." },
            { t: "How to report an error.", d: "Tell us which article and what is wrong, with the source if you have it." },
          ]}
        />
        <AskGio4x className="mt-34">Seen something that is wrong? Reports about an article are welcome from anyone, client or not.</AskGio4x>
      </NotedChapter>

      <Chapter id="market-data" eyebrow="Market data in articles" title="No price is quoted without its source and date." paper>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            GIO4X Intelligence follows the same rules as the rest of the site. A number in an article is a reference fixing with its date, a published trading condition marked as indicative, a figure from a named primary source, or a worked example labelled as one. Articles do not
            quote live prices, because GIO4X has no licensed source of its own for them.
          </p>
          <p>
            Charts and market panels embedded from TradingView are third-party frames, loaded at the reader’s request and attributed to TradingView. The full account of each kind of figure is in the{" "}
            <Link href="/trust/data-methodology" className="link">
              data methodology
            </Link>
            .
          </p>
        </div>
      </Chapter>

      <NotedChapter
        id="updates"
        eyebrow="Updates"
        title="Articles age. The page should say so."
        flip
        note={
          <FigureNote figure={<AgeingLine />}>
            Read the publication date before the text, and the notice above it where there is one. Both are there so that an older piece is read as an older piece.
          </FigureNote>
        }
      >
        <Rows
          items={[
            { t: "Time-sensitive pieces carry a notice", d: "Where an article describes conditions that will change, a notice above the text says so, and the publication date is always shown." },
            { t: "Carried-over articles were audited", d: "Articles brought from the previous GIO4X website were reviewed before republication. Statements that could not be supported were removed, in the same way as on the rest of this site." },
            { t: "Nothing is backdated", d: "A publication date is the date a piece first appeared. Changing an article does not change it." },
          ]}
        />
      </NotedChapter>

      <NextSteps
        items={[
          { label: "GIO4X Intelligence", href: "/intelligence", kind: "Read", note: "The publication these rules govern" },
          { label: "Data methodology", href: "/trust/data-methodology", kind: "Source", note: "Reference, indicative, schedule" },
          { label: "AI at GIO4X", href: "/trust/ai", kind: "Trust", note: "What is and is not a language model here" },
          { label: "Contact GIO4X", href: "/contact", kind: "Correct", note: "Report an error" },
        ]}
      />
    </>
  );
}
