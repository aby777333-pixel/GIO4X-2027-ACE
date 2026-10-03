import Link from "next/link";
import { Certificate } from "@/components/academy/practice/Certificate";
import { FixTheTrade, FlashDuel, type Card } from "@/components/academy/practice/Drills";
import { MistakeMuseum } from "@/components/academy/practice/Mistakes";
import { OrderBuilder } from "@/components/academy/practice/OrderBuilder";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { PunchLine } from "@/components/ui/PunchLine";
import { riskWarning } from "@/config/legal";
import { glossary } from "@/data/glossary";
import { couplets } from "@/data/glossary-couplets";
import { milestoneData } from "@/data/milestones";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const DESCRIPTION =
  "The Academy’s practice room: build an order by dragging its entry, stop and target; find what is wrong with an order ticket; race the glossary against the clock; walk the museum of classic mistakes; and print a certificate for each level completed. Invented figures only, and nothing is advice.";

export const metadata = pageMeta({ title: "Practice room | Academy", description: DESCRIPTION, path: "/academy/practice" });

// the flashcards: every glossary term that has a couplet, sent as names and two lines
const cards: Card[] = glossary.flatMap((t) => {
  const c = couplets[t.slug];
  return c ? [{ slug: t.slug, term: t.term, a: c[0], b: c[1] }] : [];
});
const levels = milestoneData().levels;

const rooms = [
  {
    id: "build",
    eyebrow: "Build the order",
    title: "Entry, stop, target: then the size.",
    lead: "Drag the three lines. The order reads itself back: its side, its distances, its ratio, and the size that makes the stop cost what you chose.",
    go: { href: "/tools/position-size", label: "Position size calculator" },
    body: <OrderBuilder />,
  },
  {
    id: "fix",
    eyebrow: "Fix the trade",
    title: "One thing is wrong. Or nothing is.",
    lead: "Six order tickets. Check each the way you would check your own, before it is sent.",
    go: { href: "/tools/order-anatomy", label: "Order anatomy" },
    body: <FixTheTrade />,
  },
  {
    id: "duel",
    eyebrow: "The flashcard duel",
    title: "A couplet, four terms, sixty seconds.",
    lead: `Every one of the ${cards.length} glossary couplets is in the pack. The ones you miss are listed at the end.`,
    go: { href: "/glossary", label: "The glossary" },
    body: <FlashDuel cards={cards} />,
  },
  {
    id: "museum",
    eyebrow: "The mistake museum",
    title: "Five classic errors, watched from outside.",
    lead: "Each is replayed on the same invented price, with what it costs and the habit that prevents it.",
    go: { href: "/academy/managing-trading-psychology", label: "Lesson: trading psychology" },
    body: <MistakeMuseum />,
  },
  {
    id: "certificate",
    eyebrow: "The certificate",
    title: "A level finished is worth marking.",
    lead: "Complete every lesson of a level and a certificate appears, to print. It records lessons read on this device. It is not a qualification.",
    go: { href: "/academy", label: "The Academy" },
    body: <Certificate levels={levels} />,
  },
];

export default function PracticePage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/academy/practice", name: "Practice room", description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Academy", href: "/academy" },
          { name: "Practice room", href: "/academy/practice" },
        ]}
        eyebrow="Academy"
        title="The practice room"
        lead="Five ways to use what the lessons teach, with your hands. Every figure is invented, nothing is scored against money, and none of it is advice."
      >
        <a href="#build" className="btn btn-primary">
          Build an order
        </a>
      </PageHero>

      {rooms.map((m, i) => (
        <section key={m.id} id={m.id} className={`section scroll-mt-[var(--header-h)] ${i ? "hairline" : ""} ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`${m.id}-h`}>
          <div className="wrap phi phi-r items-start">
            <div className="no-print lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
              <p className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</p>
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

      <section className="section-quiet hairline no-print" aria-label="Risk warning">
        <div className="wrap">
          <p className="max-w-measure text-sm text-ink-3">{riskWarning}</p>
        </div>
      </section>

      <PunchLine k="stop" />

      <NextSteps
        items={[
          { kind: "Academy", label: "All lessons", href: "/academy", note: "The course, by level and by learning path." },
          { kind: "Labs", label: "The Engine Room", href: "/labs/engine-room", note: "Margin call, swap, slippage, compounding, correlation." },
          { kind: "Labs", label: "Practice desk", href: "/labs/simulator", note: "A practice trade on invented prices, told step by step." },
          { kind: "Desk", label: "My desk", href: "/desk", note: "Your milestones, passport and constellation." },
        ]}
      />
    </>
  );
}
