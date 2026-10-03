import Link from "next/link";
import { PlayThumb } from "@/components/playbook/Thumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { PLAYBOOK } from "@/data/playbook";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "The Playbook: candlestick patterns and common trading situations, one page each. What a doji, a hammer or an engulfing pattern is and how to read it; what happens when a price gaps, a stop is hit by a wick, a margin call arrives or the spread widens. Explanations, not advice.";

export const metadata = pageMeta({ title: "The Playbook: candlestick patterns and trading situations", description: DESCRIPTION, path: "/playbook" });

const GROUPS = [
  { kind: "pattern" as const, id: "patterns", eyebrow: "Candlestick patterns", title: "Twelve shapes, and what each is taken to mean.", lead: "A pattern describes what a price did. None of them is a forecast, and each page says what to check before giving it any weight." },
  { kind: "scenario" as const, id: "situations", eyebrow: "When this happens", title: "Twelve situations every trader meets.", lead: "What is going on, why, what people look at next and where they usually go wrong." },
];

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/playbook", name: "The Playbook", description: DESCRIPTION, type: "CollectionPage" })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "The Playbook", href: "/playbook" },
        ]}
        eyebrow="Academy · patterns and situations"
        title="The Playbook"
        lead={`${PLAYBOOK.length} short pages. Each takes one candlestick pattern or one situation, shows it, and says what it is, what it is taken to mean and what to check. None of them says what to do.`}
      />
      {GROUPS.map((g, gi) => (
        <section key={g.id} id={g.id} className={`section scroll-mt-[var(--header-h)] ${gi ? "hairline bg-paper" : ""}`} aria-labelledby={`${g.id}-h`}>
          <div className="wrap">
            <p className="gx-numeral" aria-hidden>
              {String(gi + 1).padStart(2, "0")}
            </p>
            <p className="eyebrow mt-8">{g.eyebrow}</p>
            <h2 id={`${g.id}-h`} className="h2 mt-13 max-w-[24ch]">
              {g.title}
            </h2>
            <p className="lead mt-13 max-w-[44rem]">{g.lead}</p>
            <ul className="mt-34 grid gap-13 sm:grid-cols-2 lg:grid-cols-3">
              {PLAYBOOK.filter((p) => p.kind === g.kind).map((p) => (
                <li key={p.slug}>
                  <Link href={`/playbook/${p.slug}`} className="gx-play-card group">
                    <PlayThumb play={p} />
                    <span className="mt-13 block font-display text-xl text-ink transition-colors duration-fast group-hover:text-accent">{p.name}</span>
                    <span className="mt-5 block text-sm text-ink-2">{p.is.split(/(?<=\.)\s/)[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>
      <PunchLine k="academy" />
      <NextSteps
        items={[
          { kind: "Academy", label: "Lesson: candlestick patterns", href: "/academy/candlestick-patterns", note: "The full lesson, with its questions." },
          { kind: "Labs", label: "Build a candle", href: "/labs/workshop#build", note: "Four handles, one shape, and its name." },
          { kind: "Academy", label: "Cheat sheets", href: "/academy/cheat-sheets", note: "Three pages to print." },
          { kind: "Glossary", label: "The glossary", href: "/glossary", note: "Every term on these pages." },
        ]}
      />
    </>
  );
}
