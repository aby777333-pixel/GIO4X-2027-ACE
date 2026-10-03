"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { STEPS, type Focus } from "@/components/labs/order-book-3d/book";
import type { BookLabel, OrderBookScene } from "@/components/labs/order-book-3d/scene";
import { calmNow, useScene } from "@/components/labs/three/useScene";
import { DataNote } from "@/components/ui/Page";

/**
 * The order-book model and its six readings.
 *
 * The readings are the lesson; the model is the picture of it. All six are in
 * the page as text whether or not the model runs, and choosing one only lights
 * the part of the model it is about.
 *
 * `still` is the server-drawn figure that stands in the frame until, and
 * unless, the WebGL scene runs. Three.js is fetched by a dynamic import when
 * the frame comes near the viewport.
 */

const LABELS: { key: string; text: string; sub?: string; tone?: string }[] = [
  { key: "bids", text: "Bids", sub: "buyers" },
  { key: "asks", text: "Asks", sub: "sellers" },
  { key: "spread", text: "Spread", tone: "gold" },
  { key: "depth", text: "Depth", sub: "running total" },
  { key: "price", text: "Price →" },
];

export function OrderBook3D({ still }: { still: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [focus, setFocus] = useState<Focus>("all");

  const { scene, state } = useScene<OrderBookScene>(hostRef, async (host) => {
    const { createOrderBook } = await import("@/components/labs/order-book-3d/scene");
    const place = (labels: BookLabel[]) => {
      for (const l of labels) {
        const el = labelRefs.current[l.key];
        if (!el) continue;
        if (l.show) {
          el.style.transform = `translate3d(${l.x.toFixed(1)}px,${l.y.toFixed(1)}px,0) translate(-50%,-50%)`;
          el.dataset.show = "";
        } else delete el.dataset.show;
      }
    };
    return createOrderBook(host, calmNow, place);
  });

  useEffect(() => {
    if (state === "live") scene.current?.focus(focus);
  }, [state, focus, scene]);

  return (
    <div className="grid gap-34 lg:grid-cols-phi lg:items-start lg:gap-55">
      <figure className="min-w-0">
        <div ref={hostRef} className="gx3d" tabIndex={0} role="group" aria-label="A 3D model of an order book. Illustration, not market data. Arrow keys turn it and Home returns it. The readings after it say everything the model shows.">
          <p className="gx3d-tag chip">Illustration, not market data</p>
          <div className="gx3d-still">{still}</div>
          <div className="gx3d-labels" aria-hidden>
            {LABELS.map((l) => (
              <span
                key={l.key}
                ref={(el) => {
                  labelRefs.current[l.key] = el;
                }}
                className="gx3d-label"
                data-tone={l.tone}
              >
                {l.text}
                {l.sub && <small>{l.sub}</small>}
              </span>
            ))}
          </div>
          <p className="gx3d-hint" aria-hidden>
            Drag to turn · arrow keys when focused
          </p>
        </div>
        <figcaption className="mt-8 text-xs text-ink-3">
          {state === "none" ? "This browser could not start the 3D view, so the flat figure stands in for it. The readings carry everything the model would show. " : ""}
          Front row: what is waiting at each price. Back row: the running total out from the middle. The strip between them is the spread. The heights are generated from a fixed seed to make the idea visible; there are no prices or quantities in it.
        </figcaption>
      </figure>

      <div className="min-w-0">
        <h2 className="h3">Six readings of one book</h2>
        <p className="mt-8 text-ink-2">{state === "live" ? "Choose a reading and the model lights the part it is about." : "Each reading describes one part of the figure."}</p>
        <ol className="mt-21 border-t border-line-strong">
          {STEPS.map((s, i) => {
            const on = focus === s.key;
            return (
              <li key={s.key} className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13 border-b border-line py-13">
                <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="h4">
                    {state === "live" ? (
                      <button type="button" aria-pressed={on} onClick={() => setFocus(s.key)} className={`text-left underline decoration-dotted underline-offset-4 transition-colors duration-fast hover:text-accent ${on ? "text-accent decoration-accent" : "decoration-line-strong"}`}>
                        {s.title}
                        <span className="sr-only">{on ? " (lit on the model)" : ": light it on the model"}</span>
                      </button>
                    ) : (
                      s.title
                    )}
                  </h3>
                  <p className="mt-5 max-w-measure text-sm text-ink-2">{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <DataNote status="simulation" source="A seeded generator, the same on every visit" className="mt-21">
          An illustration of how an order book is laid out. It is not a feed, a snapshot or a reconstruction of any market, and it is not how GIO4X or its liquidity providers quote.
        </DataNote>
      </div>
    </div>
  );
}
