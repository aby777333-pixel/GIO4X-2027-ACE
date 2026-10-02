"use client";

import { TAU, clamp, rgba } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, head, label, names, seg, textSize, unit, type Spec } from "./kit";

/**
 * Two currencies bound together: one cord over a wheel, a currency hanging
 * from each end. Neither can rise unless the other falls. Between them a
 * marker shows which way the pair's price goes: up when the base (on the
 * left) rises against the quote, down when it falls.
 *
 * The value is how far the base has risen: half is level.
 */

export function Pair({ spec }: { spec: Spec<"pair"> }) {
  const [base, quote] = names(spec.labels, 2, 2, ["Base", "Quote"]);
  // three-letter codes are written on the weights themselves; longer names go beside them
  const codes = base.length <= 4 && quote.length <= 4;

  const draw: DiagramDraw = ({ ctx, w, h, pal }, v) => {
    const k = unit(w);
    const cx = w / 2;
    const wheelY = h * 0.17;
    const wr = Math.min(h * 0.1, 26);
    const reach = Math.min(w * 0.2, 150);
    const midY = h * 0.6;
    const travel = h * 0.17;
    const r = Math.min(h * 0.13, w * 0.075);
    const size = textSize(w);
    const lift = (clamp(v) - 0.5) * 2;
    const yB = midY - lift * travel;
    const yQ = midY + lift * travel;
    const xB = cx - reach;
    const xQ = cx + reach;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // two wheels hang from a rail at the top of the frame
    const wB = xB + wr;
    const wQ = xQ - wr;
    ctx.strokeStyle = rgba(pal.ink3, 0.7);
    ctx.lineWidth = 1;
    seg(ctx, wB - 14, 4, wQ + 14, 4);
    seg(ctx, wB, 4, wB, wheelY);
    seg(ctx, wQ, 4, wQ, wheelY);

    // the wheels turn as the cord runs over them
    const turn = (lift * travel) / wr;
    for (const x of [wB, wQ]) {
      disc(ctx, x, wheelY, wr - 2.5, rgba(pal.surface, 1), rgba(pal.ink2, 0.8), 1.25);
      ctx.strokeStyle = rgba(pal.ink3, 0.8);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = turn + (i * TAU) / 4;
        seg(ctx, x, wheelY, x + (wr - 5) * Math.cos(a), wheelY + (wr - 5) * Math.sin(a));
      }
      disc(ctx, x, wheelY, 2.5, rgba(pal.ink, 0.9));
    }

    // one cord: up from the base, over both wheels, down to the quote
    ctx.strokeStyle = rgba(pal.ink, 0.88);
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(xB, yB - r);
    ctx.lineTo(xB, wheelY);
    ctx.arc(wB, wheelY, wr, Math.PI, Math.PI * 1.5);
    ctx.lineTo(wQ, wheelY - wr);
    ctx.arc(wQ, wheelY, wr, Math.PI * 1.5, TAU);
    ctx.lineTo(xQ, yQ - r);
    ctx.stroke();
    // a knot on the cord shows it running towards the side that falls
    disc(ctx, cx + lift * travel, wheelY - wr, 3.5, rgba(pal.ink, 0.9));

    // the two currencies
    const coin = (x: number, y: number, name: string, colour: typeof pal.accent, up: boolean) => {
      disc(ctx, x, y, r, rgba(pal.surface, 1));
      disc(ctx, x, y, r, rgba(colour, 0.18), rgba(colour, 1), 2);
      ctx.beginPath();
      ctx.arc(x, y, r - 4, 0, TAU);
      ctx.strokeStyle = rgba(colour, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (codes) label(ctx, pal, name, x, y, { size: size + 1, weight: 700, colour: pal.ink, maxW: r * 1.7 });
      else label(ctx, pal, name, x, y + r + 12 * k + 2, { size, weight: up ? 700 : 500, colour: up ? pal.ink : pal.ink2, maxW: w * 0.4, within: w });
    };
    coin(xB, yB, base, pal.accent, lift > 0.1);
    coin(xQ, yQ, quote, pal.gold, lift < -0.1);

    // the pair's price: a marker on a track between them, with an arrow for its direction
    const top = midY - travel;
    const bottom = midY + travel;
    ctx.strokeStyle = rgba(pal.ink3, 0.55);
    ctx.lineWidth = 1;
    seg(ctx, cx, top - 6, cx, bottom + 6);
    seg(ctx, cx - 5, midY, cx + 5, midY);
    const my = midY - lift * travel;
    if (Math.abs(lift) > 0.08) {
      ctx.strokeStyle = rgba(pal.ink, 0.9);
      ctx.lineWidth = 2;
      seg(ctx, cx, midY, cx, my);
      head(ctx, cx, my, lift > 0 ? -Math.PI / 2 : Math.PI / 2, 7 * k);
    } else disc(ctx, cx, midY, 3, rgba(pal.ink, 0.9));
    if (codes) label(ctx, pal, `${base}/${quote}`, cx, bottom + 22 * k, { size, weight: 600, colour: pal.ink2, maxW: reach * 1.5 });
  };

  return (
    <DiagramShell
      draw={draw}
      auto={(t) => 0.5 + 0.38 * Math.sin(t * 0.6)}
      rest={0.82}
      control={`Raise or lower ${base}`}
      fromPointer={(fx, fy, touch) => (touch ? clamp((fx - 0.07) / 0.86) : clamp(1 - (fy - 0.2) / 0.65))}
      describe={(v) => (v > 0.56 ? `${base} rises against ${quote}: the pair’s price goes up` : v < 0.44 ? `${base} falls against ${quote}: the pair’s price goes down` : `${base} and ${quote} are level: the price is unchanged`)}
    />
  );
}
