import Link from "next/link";
import { LeverRoom, Shockwave, Tide, TugOfWar } from "@/components/labs/forces/Models";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION = "Four physical models of what moves a market: a tug of war between two currencies, a central bank’s lever and the chain it pulls, a release that spreads like a ripple, and the tide of liquidity through the day. Textbook tendencies, not forecasts.";

export const metadata = pageMeta({ title: "Forces", description: DESCRIPTION, path: "/labs/forces" });

const machines = [
  { id: "tug", eyebrow: "The tug of war", title: "A pair is always a contest of two.", lead: "Put weights on either currency and watch which way the rope goes.", go: { href: "/glossary/currency-pair", label: "Currency pair, defined" }, body: <TugOfWar /> },
  { id: "lever", eyebrow: "The lever room", title: "One lever, a long chain.", lead: "Raise or cut the policy rate and follow the textbook chain to the currency.", go: { href: "/markets/central-banks", label: "Central Bank Watch" }, body: <LeverRoom /> },
  { id: "wave", eyebrow: "The shockwave", title: "A release lands. Who feels it first?", lead: "Drop a scheduled release into the pond and see what the ripple reaches, and in what order.", go: { href: "/markets/events", label: "Economic events" }, body: <Shockwave /> },
  { id: "tide", eyebrow: "The liquidity tide", title: "High water, narrow spreads.", lead: "Twenty-four hours in a harbour: the water is how many FX windows are open.", go: { href: "/markets/clock", label: "World Market Clock" }, body: <Tide /> },
];

export default function Page() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/forces", name: "Forces", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Forces", href: "/labs/forces" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="Forces"
        lead="Four models of what moves a market, made physical. Each is the textbook tendency, other things being equal, and says so: none is a forecast."
      />

      {machines.map((m, i) => (
        <section key={m.id} id={m.id} data-machine className={`section scroll-mt-[var(--header-h)] ${i ? "hairline" : ""} ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${m.id}-h`}>
          <div className="wrap phi phi-r items-start">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <p className="gx-numeral" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="eyebrow mt-8">{m.eyebrow}</p>
              <h2 id={`${m.id}-h`} className="h2 mt-13">
                {m.title}
              </h2>
              <p className="lead mt-13 max-w-[30rem]">{m.lead}</p>
              <Link href={m.go.href} className="go mt-21">
                {m.go.label}
              </Link>
            </div>
            <div className="min-w-0">{m.body}</div>
          </div>
        </section>
      ))}

      <section className="section-quiet hairline" aria-label="Risk warning">
        <div className="wrap">
          <p className="text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>

      <PunchLine k="plan" />

      <NextSteps
        items={[
          { kind: "Labs", label: "The Engine Room", href: "/labs/engine-room", note: "Six machines about what happens to a trade." },
          { kind: "Labs", label: "One day of markets", href: "/labs/market-day", note: "Twenty-four hours of UTC as a short film." },
          { kind: "Markets", label: "Economic events", href: "/markets/events", note: "The scheduled releases, explained." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
