"use client";

import { useMemo } from "react";
import { clamp, lerp, rgba, smooth, type Palette } from "@/components/figures/Figure";
import { DiagramShell, type DiagramDraw } from "./Shell";
import { disc, hash, label, names, seg, textSize, timeline, unit, type Spec } from "./kit";

/**
 * A candle, or a few. A candle is a summary of where the price went in one
 * period, so the drawing shows it being made.
 *
 * One candle (and the doji): the price wanders on the left, and the candle on
 * the right is built from it as it goes: the body between the open and the
 * latest price, the wicks out to the highest and lowest prices reached. The
 * lesson's labels name the parts as each comes into being.
 *
 * A run or a reversal: the candles form one after another. A label that names
 * highs, lows or closes rules a guide through them.
 *
 * A candle that closes above its open is drawn hollow, one that closes below
 * it is drawn solid: the difference never rests on colour.
 *
 * The value is how far the forming has gone.
 */

type Shape = Spec<"candles">["shape"];
type C = { o: number; c: number; hi: number; lo: number };
type Ctx = CanvasRenderingContext2D;

const Yof = (h: number) => (p: number) => lerp(h * 0.86, h * 0.1, p);

function candle(ctx: Ctx, pal: Palette, Y: (p: number) => number, x: number, bw: number, o: number, c: number, hi: number, lo: number, alpha = 1, up = c >= o) {
  const top = Y(Math.max(o, c));
  const bh = Math.max(2, Y(Math.min(o, c)) - top);
  ctx.strokeStyle = up ? rgba(pal.emerald, alpha) : rgba(pal.ink, 0.9 * alpha);
  ctx.lineWidth = 1.75;
  seg(ctx, x, Y(hi), x, Y(lo));
  ctx.fillStyle = up ? rgba(pal.surface, alpha > 0.5 ? 1 : 0) : rgba(pal.ink, 0.85 * alpha);
  ctx.fillRect(x - bw / 2, top, bw, bh);
  ctx.strokeRect(x - bw / 2, top, bw, bh);
}

/* ---- one candle, built from the path of the price ------------------------ */

const N = 80;
const ONE: Record<"single" | "doji", readonly (readonly [number, number])[]> = {
  single: [[0, 0.32], [0.28, 0.12], [0.68, 0.9], [1, 0.72]],
  doji: [[0, 0.5], [0.3, 0.88], [0.7, 0.13], [1, 0.5]],
};

type Part = "body" | "upper" | "lower" | "high" | "low" | "open" | "close" | "other";
function partOf(name: string): Part {
  const m = name.toLowerCase();
  if (/wick|shadow|tail/.test(m)) return /lower|bottom|down/.test(m) ? "lower" : "upper";
  if (/body/.test(m)) return "body";
  if (/high/.test(m)) return "high";
  if (/low/.test(m)) return "low";
  if (/open/.test(m)) return "open";
  if (/clos/.test(m)) return "close";
  return "other";
}

function One({ shape, labels }: { shape: "single" | "doji"; labels: string[] }) {
  const knots = ONE[shape];
  const ys = useMemo(() => {
    const out = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let j = 0;
      while (j < knots.length - 2 && u > knots[j + 1][0]) j++;
      const p = clamp((u - knots[j][0]) / (knots[j + 1][0] - knots[j][0]));
      out[i] = lerp(knots[j][1], knots[j + 1][1], smooth(p)) + 0.05 * Math.sin(Math.PI * p) * (hash(i, 21) - 0.5);
    }
    return out;
  }, [knots]);
  const parts = useMemo(() => labels.map((text) => ({ text, part: partOf(text) })), [labels]);

  const draw: DiagramDraw = ({ ctx, w, h, pal }, v) => {
    const k = unit(w);
    const Y = Yof(h);
    const size = textSize(w);
    const x0 = w * 0.06;
    const x1 = w * 0.38;
    const cx = w * 0.54;
    const bw = Math.min(w * 0.1, 56);
    const at = clamp(v) * N;
    const whole = Math.min(N, Math.floor(at));
    const cur = whole >= N ? ys[N] : lerp(ys[whole], ys[whole + 1], at - whole);
    const o = ys[0];
    let hi = Math.max(o, cur);
    let lo = Math.min(o, cur);
    for (let i = 0; i <= whole; i++) {
      if (ys[i] > hi) hi = ys[i];
      if (ys[i] < lo) lo = ys[i];
    }
    const X = (u: number) => lerp(x0, x1, u);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // the period, on the left: its floor and the price moving through it
    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    ctx.lineWidth = 1;
    seg(ctx, x0, h * 0.93, x1, h * 0.93);
    ctx.strokeStyle = rgba(pal.ink, 0.16);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i) ctx.lineTo(X(i / N), Y(ys[i]));
      else ctx.moveTo(X(0), Y(ys[0]));
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(ys[0]));
    for (let i = 1; i <= whole; i++) ctx.lineTo(X(i / N), Y(ys[i]));
    if (whole < N) ctx.lineTo(X(at / N), Y(cur));
    ctx.stroke();

    // the four prices the candle keeps, carried across to it
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.75);
    for (const p of [hi, lo, o]) seg(ctx, x0, Y(p), cx - bw / 2 - 4, Y(p));
    ctx.strokeStyle = rgba(pal.accent, 0.8);
    seg(ctx, X(at / N), Y(cur), cx - bw / 2 - 4, Y(cur));
    ctx.setLineDash([]);
    disc(ctx, X(0), Y(o), 3, rgba(pal.surface, 1), rgba(pal.ink, 0.9));
    disc(ctx, X(at / N), Y(cur), 4.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));

    // the candle
    candle(ctx, pal, Y, cx, bw, o, cur, hi, lo);

    // its parts, named as they come into being
    const bodyTop = Math.max(o, cur);
    const bodyBottom = Math.min(o, cur);
    const lx = cx + bw / 2 + 18 * k;
    const rows: { text: string; y: number; a: number; from: number }[] = [];
    let spare = 0;
    for (const p of parts) {
      let y = 0;
      let a = 0;
      let from = cx + bw / 2;
      if (p.part === "body") {
        y = Y((bodyTop + bodyBottom) / 2);
        a = clamp((bodyTop - bodyBottom - 0.05) / 0.06);
      } else if (p.part === "upper") {
        y = Y((hi + bodyTop) / 2);
        a = clamp((hi - bodyTop - 0.04) / 0.05);
        from = cx;
      } else if (p.part === "lower") {
        y = Y((lo + bodyBottom) / 2);
        a = clamp((bodyBottom - lo - 0.04) / 0.05);
        from = cx;
      } else if (p.part === "high") {
        y = Y(hi);
        a = clamp((hi - o - 0.04) / 0.05);
        from = cx;
      } else if (p.part === "low") {
        y = Y(lo);
        a = clamp((o - lo - 0.04) / 0.05);
        from = cx;
      } else if (p.part === "open") {
        y = Y(o);
        a = 1;
      } else if (p.part === "close") {
        y = Y(cur);
        a = clamp((v - 0.95) / 0.05);
      } else {
        // a label that names no part is set under the period it describes
        label(ctx, pal, p.text, x0, h * 0.06 + spare * (size + 6), { align: "left", size, weight: 600, colour: pal.ink2, maxW: w * 0.42 });
        spare++;
        continue;
      }
      rows.push({ text: p.text, y, a, from });
    }
    // keep the names from sitting on one another
    rows.sort((a, b) => a.y - b.y);
    const gap = size + 7;
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < gap) rows[i].y = rows[i - 1].y + gap;
    const overflow = rows.length ? rows[rows.length - 1].y - (h - 10) : 0;
    if (overflow > 0) for (const r of rows) r.y -= overflow;
    for (const r of rows) {
      if (r.a <= 0.01) continue;
      ctx.strokeStyle = rgba(pal.ink3, 0.8 * r.a);
      ctx.lineWidth = 1;
      seg(ctx, r.from + 3, r.y, lx - 5, r.y);
      label(ctx, pal, r.text, lx, r.y, { align: "left", size, weight: 600, colour: pal.ink, alpha: r.a, maxW: w - lx - 8 });
    }
  };

  const [, low, high] = knots;
  const first = low[1] < knots[0][1] ? "falls to its low" : "rises to its high";
  const second = low[1] < knots[0][1] ? "rises to its high" : "falls to its low";
  return (
    <DiagramShell
      ratio={1.8}
      draw={draw}
      auto={(t) => timeline(t, 6.5, 3)}
      rest={1}
      control="Form the candle"
      describe={(v) =>
        v < 0.03
          ? "The period opens"
          : v < low[0]
            ? `The price ${first}`
            : v < high[0]
              ? `The price ${second}`
              : v < 0.98
                ? "The price settles towards the close"
                : shape === "doji"
                  ? "The period closes where it opened: a doji"
                  : "The period closes: the candle is complete"
      }
    />
  );
}

/* ---- a run of candles, or a reversal -------------------------------------- */

function series(shape: Exclude<Shape, "single" | "doji">): { list: C[]; pivot: number } {
  const list: C[] = [];
  if (shape === "bullish-run" || shape === "bearish-run") {
    for (let i = 0; i < 6; i++) {
      const o = 0.1 + i * 0.122;
      const c = o + 0.17;
      const up = { o, c, hi: c + 0.05 + 0.02 * hash(i, 1), lo: o - 0.045 - 0.02 * hash(i, 2) };
      list.push(shape === "bullish-run" ? up : { o: 1 - up.o, c: 1 - up.c, hi: 1 - up.lo, lo: 1 - up.hi });
    }
    return { list, pivot: -1 };
  }
  // three candles one way, a small candle with a long wick at the turn, three the other way
  const rise: C[] = [0, 1, 2].map((i) => ({ o: 0.14 + i * 0.17, c: 0.33 + i * 0.17, hi: 0.37 + i * 0.17, lo: 0.1 + i * 0.17 }));
  const turn: C = { o: 0.7, c: 0.67, hi: 0.94, lo: 0.64 };
  const fall: C[] = [0, 1, 2].map((i) => ({ o: 0.64 - i * 0.16, c: 0.46 - i * 0.16, hi: 0.68 - i * 0.16, lo: 0.42 - i * 0.16 }));
  const top = [...rise, turn, ...fall];
  return { list: shape === "reversal-top" ? top : top.map((k) => ({ o: 1 - k.o, c: 1 - k.c, hi: 1 - k.lo, lo: 1 - k.hi })), pivot: 3 };
}

type Role = "highs" | "lows" | "closes" | "pivot" | "first" | "second" | "other";
function roleOf(name: string, shape: Shape): Role {
  const m = name.toLowerCase();
  if (/\bhighs?\b/.test(m)) return "highs";
  if (/\blows?\b/.test(m)) return "lows";
  if (/clos/.test(m)) return "closes";
  if (shape === "reversal-top" || shape === "reversal-bottom") {
    if (/revers|turn|top|bottom|peak|trough|star|hammer|signal|reject|exhaust|wick|shadow|indecision/.test(m)) return "pivot";
    const rising = /\bup|bull|ris|advanc|rally|buy/.test(m);
    const falling = /down|bear|fall|declin|sell/.test(m);
    if (rising) return shape === "reversal-top" ? "first" : "second";
    if (falling) return shape === "reversal-top" ? "second" : "first";
  }
  return "other";
}

function Run({ shape, labels }: { shape: Exclude<Shape, "single" | "doji">; labels: string[] }) {
  const { list, pivot } = useMemo(() => series(shape), [shape]);
  const roles = useMemo(() => labels.map((text) => ({ text, role: roleOf(text, shape) })), [labels, shape]);
  const n = list.length;

  const draw: DiagramDraw = ({ ctx, w, h, pal }, v) => {
    const k = unit(w);
    const Y = Yof(h);
    const size = textSize(w);
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    const slot = (x1 - x0) / n;
    const bw = Math.min(slot * 0.5, 34);
    const X = (i: number) => x0 + slot * (i + 0.5);
    const done = clamp(v) * n;
    const formed = Math.min(n, Math.floor(done + 1e-6));

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = rgba(pal.ink3, 0.4);
    ctx.lineWidth = 1;
    seg(ctx, w * 0.06, h * 0.93, w * 0.94, h * 0.93);

    for (let i = 0; i < n; i++) {
      const c = list[i];
      if (i < formed) candle(ctx, pal, Y, X(i), bw, c.o, c.c, c.hi, c.lo);
      else if (i > formed) candle(ctx, pal, Y, X(i), bw, c.o, c.c, c.hi, c.lo, 0.16);
      else {
        // the candle being made: the price leaves the open, reaches one extreme, then the other, and closes
        const p = done - formed;
        const up = c.c >= c.o;
        const a = up ? c.lo : c.hi;
        const b = up ? c.hi : c.lo;
        const cur = p < 0.25 ? lerp(c.o, a, p / 0.25) : p < 0.7 ? lerp(a, b, (p - 0.25) / 0.45) : lerp(b, c.c, (p - 0.7) / 0.3);
        const far = p < 0.7 ? (up ? Math.max(c.o, cur) : Math.min(c.o, cur)) : b;
        const near = p < 0.25 ? cur : a;
        // drawn from the start in the manner it will close in, so a rising run never flashes solid
        candle(ctx, pal, Y, X(i), bw, c.o, cur, up ? far : near, up ? near : far, 1, up);
        disc(ctx, X(i) + bw / 2 + 5, Y(cur), 3.5 * k, rgba(pal.gold, 1), rgba(pal.ink, 0.9));
      }
    }

    // guides and names
    const mid = Math.floor((n - 1) / 2);
    const rising = list[n - 1].c > list[0].c;
    let spare = 0;
    for (const r of roles) {
      if (r.role === "highs" || r.role === "lows" || r.role === "closes") {
        const val = (c: C) => (r.role === "highs" ? c.hi : r.role === "lows" ? c.lo : c.c);
        const off = r.role === "lows" ? 1 : -1;
        if (formed >= 2) {
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = rgba(r.role === "lows" ? pal.gold : pal.accent, 1);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < formed; i++) {
            const y = Y(val(list[i])) + off * 5;
            if (i) ctx.lineTo(X(i), y);
            else ctx.moveTo(X(0), y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          for (let i = 0; i < formed; i++) disc(ctx, X(i), Y(val(list[i])) + off * 5, 2.5, rgba(r.role === "lows" ? pal.gold : pal.accent, 1));
        }
        // the name sits on the open side of its guide
        const a = clamp(done - mid - 0.6);
        const above = r.role !== "lows";
        const toLeft = pivot >= 0 ? above === (shape === "reversal-bottom") : above === rising;
        label(ctx, pal, r.text, X(mid) + (toLeft ? -1 : 1) * (bw / 2 + 4), Y(val(list[mid])) + off * (16 * k + 8), {
          align: toLeft ? "right" : "left",
          size,
          weight: 700,
          colour: pal.ink,
          alpha: a,
          tag: true,
          maxW: w * 0.42,
          within: w,
        });
      } else if (r.role === "pivot" && pivot >= 0) {
        const c = list[pivot];
        const top = shape === "reversal-top";
        const a = clamp(done - pivot - 0.6);
        if (a > 0.01) {
          ctx.beginPath();
          ctx.ellipse(X(pivot), Y((c.hi + c.lo) / 2), bw / 2 + 9, (Y(c.lo) - Y(c.hi)) / 2 + 9, 0, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(pal.accent, a);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        label(ctx, pal, r.text, X(pivot) + bw / 2 + 14, top ? Y(c.hi) + 4 : Y(c.lo) - 4, { align: "left", size, weight: 700, colour: pal.ink, alpha: a, maxW: w * 0.36, within: w });
      } else if ((r.role === "first" || r.role === "second") && pivot >= 0) {
        const from = r.role === "first" ? 0 : pivot + 1;
        const to = r.role === "first" ? pivot - 1 : n - 1;
        const a = clamp((done - to - 0.6) / 0.4);
        const y = h * 0.965;
        if (a > 0.01) {
          ctx.strokeStyle = rgba(pal.ink3, a);
          ctx.lineWidth = 1;
          seg(ctx, X(from) - bw / 2, h * 0.93, X(to) + bw / 2, h * 0.93);
        }
        label(ctx, pal, r.text, (X(from) + X(to)) / 2, y + 2, { size: size - 1, weight: 600, colour: pal.ink2, alpha: a, maxW: slot * 3 });
      } else {
        label(ctx, pal, r.text, w * (rising ? 0.06 : 0.94), h * 0.07 + spare * (size + 6), { align: rising ? "left" : "right", size, weight: 600, colour: pal.ink2, maxW: w * 0.45, within: w });
        spare++;
      }
    }
  };

  return (
    <DiagramShell
      ratio={1.8}
      draw={draw}
      auto={(t) => timeline(t, n * 1.15, 2.8)}
      rest={1}
      control="Add the candles one by one"
      describe={(v) => {
        const i = Math.min(n - 1, Math.floor(clamp(v) * n));
        const c = list[i];
        const closed = v * n >= i + 0.999;
        return `Candle ${i + 1} of ${n}: ${closed ? "closed" : "closing"} ${c.c >= c.o ? "above" : "below"} where it opened`;
      }}
    />
  );
}

export function Candles({ spec }: { spec: Spec<"candles"> }) {
  const labels = names(spec.labels, 0, 4, []);
  if (spec.shape === "bullish-run" || spec.shape === "bearish-run" || spec.shape === "reversal-top" || spec.shape === "reversal-bottom") return <Run shape={spec.shape} labels={labels} />;
  return <One shape={spec.shape === "doji" ? "doji" : "single"} labels={labels} />;
}
