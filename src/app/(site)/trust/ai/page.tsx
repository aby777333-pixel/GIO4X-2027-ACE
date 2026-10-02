import Link from "next/link";
import { Backdrop } from "@/components/figures/Backdrop";
import { FigureNote } from "@/components/figures/Figure";
import { NotedChapter } from "@/components/figures/trust/NotedChapter";
import { SevenBounds } from "@/components/figures/trust/SevenBounds";
import { JsonLd } from "@/components/seo/JsonLd";
import { Chapter, Rows } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "What is and is not artificial intelligence on the GIO4X website today, and the limits any future AI assistant will keep: labelled, grounded in published sources, no advice, a human always reachable.";

export const metadata = pageMeta({ title: "AI at GIO4X", description, path: "/trust/ai" });

const today: { t: string; state: string; d: string }[] = [
  { t: "Site search", state: "Not AI", d: "A small, deterministic search over the site’s own index. It matches symbols, aliases and misspellings by rule. The same query always gives the same result." },
  { t: "Command bar", state: "Not AI", d: "The same engine with a few fixed prefixes, such as define: and verify:. It does not generate text and does not learn from what you type." },
  { t: "Calculators and market tools", state: "Not AI", d: "Arithmetic on your inputs, with the formula shown. No model is involved." },
  { t: "Generative AI assistant", state: "Not live", d: "There is no chatbot or generative assistant on the public website in this release." },
];

const commitments: { t: string; d: string }[] = [
  { t: "It will be labelled as AI.", d: "Every answer will say that it was produced by a language model, at the point where you read it. It will not be given a human name or a photograph, and it will not pretend to be a member of staff." },
  { t: "It will answer from published sources, and cite them.", d: "Answers will be grounded in pages GIO4X has published, and each answer will link to the pages it drew on, so you can read the source instead of taking the summary on trust." },
  { t: "It will not give trading advice.", d: "It will not tell you what to buy or sell, when to trade, how much to risk or whether a product suits you. It will explain how something works and point to the tool or document that lets you decide." },
  { t: "It will not predict.", d: "No price targets, no forecasts, no probabilities of a market moving. If asked, it will say that it does not do this." },
  { t: "It will not act on an account.", d: "It will not open, fund, withdraw from, trade on or change any account, and it will not ask for a password or a one-time code." },
  { t: "It will say when it does not know.", d: "Where the published sources do not contain an answer, it will say so and will not improvise one. That includes every subject the transparency table marks as not yet published." },
  { t: "A human will always be reachable.", d: "Every AI answer will carry a route to a person. You will never have to get past the assistant to reach GIO4X." },
];

export default function AiPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/ai", name: "AI at GIO4X", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "AI at GIO4X", href: "/trust/ai" },
        ]}
        eyebrow="AI at GIO4X"
        title="No language model is answering you on this website."
        lead="That is the state of this release, and it is worth saying plainly. This page records what is and is not AI here today, and the limits any assistant will keep if one is introduced."
      />

      <section className="section-quiet" aria-labelledby="ai-today">
        <div className="wrap">
          <div className="phi items-end">
            <div data-reveal suppressHydrationWarning>
              <p className="eyebrow">This release</p>
              <h2 id="ai-today" className="h2 mt-13 max-w-[16ch]">
                What is on the site today.
              </h2>
            </div>
            <p className="text-ink-2" data-reveal suppressHydrationWarning>
              “Deterministic” means that the software follows fixed rules written by people. Nothing below composes sentences, and nothing below was trained on your behaviour.
            </p>
          </div>
          <ul className="mt-34 border-t border-line-strong">
            {today.map((r, i) => (
              <li key={r.t} className="grid gap-x-34 gap-y-5 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,1.618fr)] md:items-baseline" data-reveal suppressHydrationWarning style={{ ["--i" as string]: i }}>
                <h3 className="h4">{r.t}</h3>
                <p>
                  <span className="state state-off">{r.state}</span>
                </p>
                <p className="text-ink-2">{r.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <NotedChapter
        id="ai-commitments"
        eyebrow="If an assistant is introduced"
        title="Seven boundaries, stated in advance."
        lead="These are commitments. They are written before any assistant exists so that they cannot be shaped around what one turns out to do."
        paper
        stretch
        note={
          <FigureNote figure={<SevenBounds />} label="Today" className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
            None of the seven is in force yet, because there is no assistant on the public website in this release. Until one is introduced, every question goes to a person through the{" "}
            <Link href="/contact" className="link">
              contact page
            </Link>
            .
          </FigureNote>
        }
      >
        <Rows numbered items={commitments} />
      </NotedChapter>

      <Chapter id="ai-why" eyebrow="Why so narrow" title="A fluent answer is not the same as a true one." flip>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            Language models are persuasive. They can state an invented spread, a regulator that does not exist or a confident view on tomorrow’s market in the same even tone as a fact. In a business where people act on what they read with their own money, that is a risk to the
            client before it is a feature for the broker.
          </p>
          <p>
            So the order is fixed: the published sources come first, the assistant may only restate them, and where they are silent it is silent too. The rule that governs the rest of this site applies to it without exception: nothing fabricated.
          </p>
          <p className="text-sm text-ink-3">
            Platform features described on the{" "}
            <Link href="/platforms" className="link">
              platform pages
            </Link>{" "}
            belong to those platforms and their providers. This page covers the GIO4X website only.
          </p>
        </div>
      </Chapter>

      <section className="section-quiet hairline relative bg-paper" aria-labelledby="ai-change">
        <Backdrop variant="ledger" />
        <div className="wrap flex flex-col gap-21 md:flex-row md:items-end md:justify-between">
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">When this changes</p>
            <h2 id="ai-change" className="h3 mt-13">
              This page will change first.
            </h2>
            <p className="mt-13 max-w-measure text-ink-2">Before any AI feature reaches the public site, this page will name it, say which model provider is used, what it can read and what it cannot do. Until then, every question goes to a person.</p>
          </div>
          <Link href="/contact" className="btn btn-primary shrink-0" data-reveal suppressHydrationWarning>
            Contact a person
          </Link>
        </div>
      </section>

      <NextSteps
        items={[
          { label: "Editorial standards", href: "/trust/editorial-standards", kind: "Trust", note: "How published sources are written" },
          { label: "Data methodology", href: "/trust/data-methodology", kind: "Source", note: "Where the numbers come from" },
          { label: "What we disclose", href: "/trust/transparency", kind: "Disclose", note: "Published and not yet published" },
          { label: "Search the site", href: "/search", kind: "Deterministic", note: "Rules, not a model" },
        ]}
      />
    </>
  );
}
