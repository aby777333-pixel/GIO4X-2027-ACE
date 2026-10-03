import Link from "next/link";
import { TradeAnatomy } from "@/components/labs/trade-anatomy/TradeAnatomy";
import { ALL_TERMS, STAGES } from "@/components/labs/trade-anatomy/stages";
import { OrderLife } from "@/components/figures/trading/OrderLife";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { getTerm } from "@/data/glossary";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const TITLE = "Trade Anatomy";
const DESCRIPTION =
  "One order followed through the seven stages of its life: the ticket, the checks, routing, the fill, the open position, the close and settlement into the balance. General mechanics in plain language, with no prices and no advice.";

export const metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/labs/trade-anatomy" });

// Only glossary entries that exist are linked: the names come from the glossary itself.
const terms: Record<string, string> = Object.fromEntries(
  ALL_TERMS.flatMap((slug) => {
    const t = getTerm(slug);
    return t ? [[slug, t.term] as const] : [];
  }),
);

export default function TradeAnatomyPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/trade-anatomy", name: TITLE, description: DESCRIPTION })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: TITLE, href: "/labs/trade-anatomy" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title={TITLE}
        lead="One order, followed from the click to the balance. Seven stages, each with the branches where its path can change, and what can go wrong at every one."
      />

      <section className="section-quiet" aria-label="The walkthrough">
        <div className="wrap">
          <TradeAnatomy terms={terms} />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="ta-method">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">Method</p>
            <h2 id="ta-method" className="h2 mt-13">
              General mechanics. Not a description of one broker.
            </h2>
            {/* the short column was empty beneath the heading: a figure that says the same thing as the text beside it */}
            <div className="mt-34 max-w-[28rem]">
              <div className="flat gx-stage">
                <OrderLife />
              </div>
            </div>
          </div>
          <div>
            <div className="prose-gx">
              <p>
                The walkthrough describes how an order is commonly handled in margin trading, in the order things happen. Practice differs between brokers and platforms, which is why the text says “may”, “commonly” and “depends on the broker” where it does. The branches are the points at which two orders that look the same on the ticket can end differently.
              </p>
              <p>
                <strong>What it is not.</strong> There is no market data in it, no price, no symbol and no figure. It does not describe how GIO4X routes or fills orders: the note under each stage says what this site publishes on that subject and what it does not yet publish, and links to the page concerned. It is not advice, and it does not suggest a trade.
              </p>
              <p>
                The scene is an illustration. Everything it shows is written in the panel beside it, so the page reads the same with the animation switched off; with reduced motion each stage is a still picture and the stepper works as before. To see where each order type rests against a moving price, use{" "}
                <Link href="/tools/order-anatomy">Order Anatomy</Link> in the Trader Toolkit.
              </p>
            </div>
            <ol className="mt-34 grid gap-x-34 border-t border-line-strong sm:grid-cols-2">
              {STAGES.map((s, i) => (
                <li key={s.key} className="grid grid-cols-[2.125rem_1fr] items-baseline gap-x-8 border-b border-line py-13">
                  <span className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">0{i + 1}</span>
                  <span className="text-sm text-ink">{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Tools", label: "Order Anatomy", href: "/tools/order-anatomy", note: "Where each order type rests, and when it triggers." },
          { kind: "Trading", label: "Trading conditions", href: "/trading/conditions", note: "Margin call, stop out and the four cost words." },
          { kind: "Trust", label: "Transparency", href: "/trust/transparency", note: "What is published and what is not yet." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
