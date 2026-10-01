import Link from "next/link";
import type { ReactNode } from "react";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { riskWarning } from "@/config/legal";
import type { Crumb } from "@/lib/schema";
import { AgreedList, AskLine, NumberedRows, PendingList, Questions, RiskLedger, RiskNote } from "./Blocks";

type Props = {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  lead: string;
  diagram: ReactNode;
  diagramCaption: string;
  what: string[];
  mechanics: { title: string; body: string }[];
  /** "At GIO4X": what has been published consistently, and what has not */
  gioTitle: string;
  gioLead: string;
  gioSteps?: string[];
  gioAgreed: string[];
  pending: string[];
  risks: { title: string; body: string }[];
  risksLead: string;
  questions: string[];
  next: { label: string; href: string; note?: string; kind?: string }[];
};

/**
 * The shape shared by the two "someone else trades" arrangements (copy trading
 * and PAMM): what it is, how it works mechanically, what GIO4X has published,
 * the risks, and the questions to ask first. No leaderboards, no performance
 * figures, no percentages.
 */
export function Arrangement(p: Props) {
  return (
    <>
      <PageHero
        crumbs={p.crumbs}
        eyebrow={p.eyebrow}
        title={p.title}
        lead={p.lead}
        aside={
          <figure>
            <div className="panel p-21">{p.diagram}</div>
            <figcaption className="mt-8 text-xs text-ink-3">{p.diagramCaption}</figcaption>
          </figure>
        }
      />

      <section className="section" aria-labelledby="arr-how">
        <div className="wrap phi phi-r items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2.125rem)]">
            <p className="eyebrow">What it is</p>
            <div className="prose-gx mt-21">
              {p.what.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </div>
          <div>
            <h2 id="arr-how" className="h3 mb-21">
              How it works, mechanically.
            </h2>
            <NumberedRows items={p.mechanics} reveal={false} />
            <p className="mt-13 text-xs text-ink-3">A general description of the arrangement. GIO4X’s own terms are set out below, where they have been published.</p>
          </div>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="arr-gio">
        <div className="wrap">
          <SectionHead eyebrow="At GIO4X" title={<span id="arr-gio">{p.gioTitle}</span>} lead={p.gioLead} />
          <div className="mt-34 grid gap-55 lg:mt-55 lg:grid-cols-2 lg:gap-89">
            <div data-reveal>
              <h3 className="label">Published consistently</h3>
              <div className="mt-13">
                <AgreedList items={p.gioAgreed} />
              </div>
              {p.gioSteps && (
                <>
                  <h3 className="label mt-34">The steps, as GIO4X has described them</h3>
                  <ol className="mt-13 border-t border-line-strong">
                    {p.gioSteps.map((s, i) => (
                      <li key={s} className="grid grid-cols-[2.125rem_1fr] items-baseline border-b border-line py-13">
                        <span className="num text-xs font-semibold text-prestige-ink">{i + 1}</span>
                        <span className="text-[0.9375rem] text-ink">{s}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
            <div data-reveal>
              <h3 className="label">Not yet published</h3>
              <PendingList items={p.pending} className="mt-13" />
              <AskLine className="mt-13">These have not been published consistently, so none is stated here. Ask before you take part:</AskLine>
            </div>
          </div>
        </div>
      </section>

      <section className="section hairline" aria-labelledby="arr-risks">
        <div className="wrap">
          <SectionHead eyebrow="Risks" title={<span id="arr-risks">What can go wrong.</span>} lead={p.risksLead} />
          <div className="mt-34 lg:mt-55">
            <RiskLedger items={p.risks} />
          </div>
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="arr-q">
        <div className="wrap">
          <SectionHead
            eyebrow="Before you take part"
            title={<span id="arr-q">Questions worth asking first.</span>}
            lead="If you cannot get a clear answer to one of these, that is itself an answer."
            action={
              <Link href="/contact" className="go min-h-[2.75rem] md:min-h-0">
                Ask GIO4X
              </Link>
            }
          />
          <div className="mt-34 lg:mt-55">
            <Questions items={p.questions} />
          </div>
        </div>
      </section>

      <RiskNote text={riskWarning} />
      <NextSteps items={p.next} />
    </>
  );
}
