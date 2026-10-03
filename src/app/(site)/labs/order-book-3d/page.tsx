import Link from "next/link";
import { OrderBook3D } from "@/components/labs/order-book-3d/OrderBook3D";
import { OrderBookStill } from "@/components/labs/order-book-3d/OrderBookStill";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";
import "@/components/labs/three/labs3d.css";

const DESCRIPTION =
  "A 3D model you can turn that explains how an order book is laid out: bids, asks, the spread between them, depth, and how a market order walks the book. An illustration generated from a fixed seed, not market data: it holds no prices and no quantities.";

export const metadata = pageMeta({ title: "Order book in 3D", description: DESCRIPTION, path: "/labs/order-book-3d" });

const absent = [
  "Prices and quantities. The heights are relative, and generated: they belong to no instrument and no moment.",
  "Time. A real book changes many times a second as orders arrive, are cancelled and are filled; this one stands still so that it can be read.",
  "Hidden and off-book liquidity, which no displayed book shows.",
  "How any particular venue, GIO4X or its liquidity providers quote. Over-the-counter products such as CFDs are priced by the provider, not on a central book.",
];

export default function OrderBook3DPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/labs/order-book-3d", name: "Order book in 3D", description: DESCRIPTION })} />
      <PageHero
        quiet
        scene="spread"
        crumbs={[
          { name: "Labs", href: "/labs" },
          { name: "Order book in 3D", href: "/labs/order-book-3d" },
        ]}
        eyebrow="GIO4X Labs · Experiment"
        title="Order book in 3D"
        lead="Buyers on one side, sellers on the other, and a gap between them. A model you can turn, built to explain an idea. It is an illustration, not market data."
      />

      <section className="section-quiet" aria-label="The model and its readings">
        <div className="wrap">
          <OrderBook3D still={<OrderBookStill />} />
        </div>
      </section>

      <section className="section hairline bg-paper" aria-labelledby="ob-read">
        <div className="wrap phi phi-r items-start">
          <div>
            <p className="eyebrow">What it is, and is not</p>
            <h2 id="ob-read" className="h2 mt-13">
              A diagram with depth. Not a market.
            </h2>
            <p className="lead mt-13 max-w-[30rem]">
              The shapes come from a generator with a fixed seed, so the model is the same on every visit and nothing in it moves by itself. To see what a spread costs in figures you choose yourself, use the{" "}
              <Link href="/tools/spread-visualizer" className="link">
                Spread visualiser
              </Link>
              .
            </p>
          </div>
          <div className="min-w-0">
            <h3 className="label">What the model leaves out</h3>
            <ul className="mt-8 border-t border-line-strong">
              {absent.map((x) => (
                <li key={x} className="flex gap-8 border-b border-line py-8 text-sm text-ink-2">
                  <span aria-hidden className="mt-[0.7em] h-px w-13 shrink-0 bg-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              Bids are drawn in the site’s “positive” colour and asks in its “negative” colour only to tell the two sides apart; neither is good or bad, and each side is also named on the model. The 3D view needs WebGL: where it is not available a flat figure stands in its place and the readings are unchanged.{" "}
              <Link href="/trust/data-methodology" className="link">
                Data methodology
              </Link>
            </p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Tool", label: "Spread visualiser", href: "/tools/spread-visualizer", note: "What a spread costs, in figures you enter." },
          { kind: "Labs", label: "Trade Anatomy", href: "/labs/trade-anatomy", note: "One order followed from the ticket to the balance." },
          { kind: "Tool", label: "Order anatomy", href: "/tools/order-anatomy", note: "Entry, stop and target on one order." },
          { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
        ]}
      />
    </>
  );
}
