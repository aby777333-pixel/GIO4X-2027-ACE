"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { rgba, type Colour } from "@/components/figures/Figure";
import { fmt } from "@/components/tools/calc";
import { pipsBetween, quote, r5, SIM, type SimState } from "./engine";
import { pips, px } from "./working";

/**
 * The chart of the practice desk: candles forming from the ticks of the
 * invented market, the bid and ask, and a line for every entry, stop loss,
 * take profit and waiting order.
 *
 * The canvas is a drawing and is hidden from assistive technology. Everything
 * that can be moved on it is ALSO a real element laid over it: each stop,
 * target and order level is a slider that can be dragged with a pointer or
 * moved with the arrow keys, and the same levels are fields in the list of
 * positions below. Colours come only from the design tokens. Nothing here
 * animates: the picture changes because the simulated price does, so reduced
 * motion needs no special case. The words "SIMULATION · invented prices" are
 * part of the drawing and cannot be scrolled or cropped out of it.
 */

export type DragKey = { target: "position" | "order"; id: number; field: "sl" | "tp" | "level" };

type Pal = { ink: Colour; ink2: Colour; ink3: Colour; line: Colour; accent: Colour; pos: Colour; neg: Colour; warn: Colour; surface: Colour; font: string };
type Scale = { lo: number; hi: number; top: number; h: number };
type Handle = { k: string; key: DragKey; price: number; label: string; name: string; from: number; tone: "neg" | "pos" | "ink" };

const AXIS_H = 24;
const PAD_T = 10;
const PIP = SIM.pip;

const yOf = (s: Scale, p: number) => s.top + ((s.hi - p) / (s.hi - s.lo)) * s.h;
const priceAt = (s: Scale, y: number) => s.hi - ((y - s.top) / s.h) * (s.hi - s.lo);
const toPip = (p: number) => r5(Math.round(p / PIP) * PIP);

function readPalette(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Pal {
  const cs = getComputedStyle(canvas);
  /** any CSS colour, through the canvas's own parser, as numbers */
  const parse = (value: string): Colour | null => {
    if (!value) return null;
    ctx.fillStyle = "rgba(1,2,3,0.004)";
    const before = ctx.fillStyle;
    ctx.fillStyle = value;
    const s = String(ctx.fillStyle);
    if (s === before) return null;
    if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
    const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
    if (!m || m.length < 3) return null;
    const k = s.startsWith("color(") ? 255 : 1;
    return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
  };
  const text = parse(cs.color) ?? [128, 128, 128, 1];
  const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
  const ink = v("--ink", text);
  return {
    ink,
    ink2: v("--ink-2", ink),
    ink3: v("--ink-3", ink),
    line: v("--line", [ink[0], ink[1], ink[2], 0.11]),
    accent: v("--accent", ink),
    pos: v("--pos", ink),
    neg: v("--neg", ink),
    warn: v("--warn", ink),
    surface: v("--surface", [255, 255, 255, 1]),
    font: cs.fontFamily || "system-ui, sans-serif",
  };
}

/** a step for the price axis that gives five to eight labels */
function axisStep(range: number, h: number): number {
  const want = Math.max(3, Math.floor(h / 44));
  for (const p of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) if (range / (p * PIP) <= want) return p * PIP;
  return 10000 * PIP;
}

export function Chart({ sim, onMove }: { sim: SimState; onMove: (key: DragKey, price: number) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [palTick, setPalTick] = useState(0);
  /** while a level is being dragged the price axis holds still (`scale`), so the line stays under the pointer */
  const [drag, setDrag] = useState<{ k: string; key: DragKey; price: number; scale: Scale } | null>(null);
  const [hot, setHot] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    measure();
    // theme or accent changed: read the tokens again on the next frame
    const repaint = () => requestAnimationFrame(() => setPalTick((n) => n + 1));
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("gx:prefs", repaint);
    scheme.addEventListener("change", repaint);
    void document.fonts?.ready.then(repaint);
    return () => {
      ro.disconnect();
      window.removeEventListener("gx:prefs", repaint);
      scheme.removeEventListener("change", repaint);
    };
  }, []);

  const narrow = size.w < 520;
  const gutter = narrow ? 58 : 70;
  // room to the right of the newest candle for the handles; on a phone they are allowed to stand over the last few candles
  const zone = narrow ? 56 : 132;
  const slot = narrow ? 5 : 8;
  const plotW = Math.max(0, size.w - gutter);
  const count = Math.max(8, Math.floor((plotW - zone - 4) / slot));
  const q = quote(sim);

  const handles = useMemo<Handle[]>(() => {
    const out: Handle[] = [];
    for (const p of sim.positions) {
      if (p.sl !== null) out.push({ k: `p${p.id}sl`, key: { target: "position", id: p.id, field: "sl" }, price: p.sl, label: `#${p.id} stop`, name: `Stop loss of position ${p.id}`, from: p.entry, tone: "neg" });
      if (p.tp !== null) out.push({ k: `p${p.id}tp`, key: { target: "position", id: p.id, field: "tp" }, price: p.tp, label: `#${p.id} target`, name: `Take profit of position ${p.id}`, from: p.entry, tone: "pos" });
    }
    for (const o of sim.orders) out.push({ k: `o${o.id}`, key: { target: "order", id: o.id, field: "level" }, price: o.level, label: `#${o.id} ${o.side} ${o.order}`, name: `Level of ${o.side} ${o.order} order ${o.id}`, from: o.side === "buy" ? q.ask : q.bid, tone: "ink" });
    return out;
  }, [sim.positions, sim.orders, q.ask, q.bid]);

  const candles = sim.candles.slice(-count);
  const live = useMemo<Scale>(() => {
    let lo = Math.min(q.bid, q.ask);
    let hi = Math.max(q.bid, q.ask);
    const see = (p: number | null) => {
      if (p === null) return;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    };
    for (const c of sim.candles.slice(-count)) {
      see(c.l);
      see(c.h);
    }
    for (const p of sim.positions) {
      see(p.entry);
      see(p.sl);
      see(p.tp);
    }
    for (const o of sim.orders) {
      see(o.level);
      see(o.sl);
      see(o.tp);
    }
    const pad = Math.max((hi - lo) * 0.14, 5 * PIP);
    lo -= pad;
    hi += pad;
    // the bounds move in whole steps of five pips, so the axis does not shiver with every tick
    const snap = 5 * PIP;
    lo = Math.floor(lo / snap) * snap;
    hi = Math.ceil(hi / snap) * snap;
    return { lo, hi, top: PAD_T, h: Math.max(1, size.h - AXIS_H - PAD_T) };
  }, [sim.candles, sim.positions, sim.orders, q.bid, q.ask, count, size.h]);
  const scale = drag ? drag.scale : live;

  /* ---- drawing ------------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || size.w < 40 || size.h < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(size.w * dpr);
    const ch = Math.round(size.h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pal = readPalette(canvas, ctx);
    const { w, h } = size;
    const bottom = h - AXIS_H;
    const y = (p: number) => Math.round(yOf(scale, p)) + 0.5;
    const small = `${narrow ? 10 : 11}px ${pal.font}`;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;

    // price axis
    const stepP = axisStep(scale.hi - scale.lo, scale.h);
    ctx.font = small;
    ctx.textAlign = "left";
    for (let p = Math.ceil(scale.lo / stepP) * stepP; p < scale.hi; p += stepP) {
      const yy = y(p);
      if (yy < PAD_T + 4 || yy > bottom - 2) continue;
      ctx.strokeStyle = rgba(pal.line, 0.9);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(plotW, yy);
      ctx.stroke();
      // the bid and ask carry their own prices in the margin: an axis label under them would only be half hidden
      if (yy > y(q.ask) - 22 && yy < y(q.bid) + 22) continue;
      ctx.fillStyle = rgba(pal.ink3);
      ctx.fillText(fmt(p, 4, 4), plotW + 6, yy);
    }
    ctx.strokeStyle = rgba(pal.line, 1.6);
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, bottom);
    ctx.moveTo(0, bottom + 0.5);
    ctx.lineTo(w, bottom + 0.5);
    ctx.stroke();

    // the mark that cannot be cropped out
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(pal.ink, 0.1);
    ctx.font = `600 ${narrow ? 13 : 19}px ${pal.font}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.16em";
    ctx.fillText("SIMULATION", plotW / 2, PAD_T + scale.h * 0.46);
    ctx.font = `500 ${narrow ? 10 : 13}px ${pal.font}`;
    ctx.fillText("INVENTED PRICES", plotW / 2, PAD_T + scale.h * 0.46 + (narrow ? 17 : 24));
    ctx.restore();

    // candles: hollow closed higher, filled closed lower, so direction never rests on colour
    const right = plotW - zone;
    const body = slot - 2;
    ctx.font = `${narrow ? 9 : 10}px ${pal.font}`;
    candles.forEach((c, i) => {
      const x = Math.round(right - (candles.length - i) * slot + slot / 2);
      const up = c.c >= c.o;
      const yo = y(c.o);
      const yc = y(c.c);
      const top = Math.min(yo, yc);
      const bh = Math.max(1, Math.abs(yc - yo));
      ctx.strokeStyle = rgba(pal.ink2, 0.9);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y(c.h));
      ctx.lineTo(x + 0.5, y(c.l));
      ctx.stroke();
      ctx.fillStyle = up ? rgba(pal.surface) : rgba(pal.ink2, 0.9);
      ctx.fillRect(x - body / 2 + 0.5, top, body, bh);
      ctx.strokeRect(x - body / 2 + 0.5, top, body, bh);
      if (c.gap) {
        ctx.fillStyle = rgba(pal.warn);
        ctx.textAlign = "center";
        ctx.fillText("gap", x, Math.max(PAD_T + 6, y(c.h) - 9));
      }
      // time axis in simulated minutes; a dotted line where the simulated rollover fell
      if (c.m % 10 === 0) {
        ctx.fillStyle = rgba(pal.ink3);
        ctx.textAlign = "center";
        ctx.fillText(String(c.m), x, bottom + AXIS_H / 2);
        ctx.strokeStyle = rgba(pal.line, 1.4);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, bottom);
        ctx.lineTo(x + 0.5, bottom + 4);
        ctx.stroke();
      }
      if (c.m > 0 && c.m % SIM.rolloverMinutes === 0) {
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = rgba(pal.ink3, 0.8);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, PAD_T);
        ctx.lineTo(x + 0.5, bottom);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = rgba(pal.ink3);
        ctx.textAlign = "left";
        ctx.fillText("rollover", x + 4, PAD_T + 5);
      }
    });
    ctx.fillStyle = rgba(pal.ink3);
    ctx.textAlign = "left";
    ctx.font = `${narrow ? 9 : 10}px ${pal.font}`;
    ctx.fillText("sim. min", plotW + 6, bottom + AXIS_H / 2);

    // levels
    const level = (p: number, colour: Colour, dash: number[], alpha: number, label?: string) => {
      const yy = y(p);
      if (yy < PAD_T - 2 || yy > bottom) return;
      ctx.save();
      ctx.setLineDash(dash);
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(plotW, yy);
      ctx.stroke();
      ctx.restore();
      if (label) {
        ctx.font = small;
        ctx.textAlign = "left";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = rgba(pal.surface, 0.86);
        ctx.fillRect(4, yy - 15, tw + 8, 13);
        ctx.fillStyle = rgba(colour);
        ctx.fillText(label, 8, yy - 8);
      }
    };
    const moved = (k: string, p: number) => (drag && drag.k === k ? drag.price : p);
    for (const o of sim.orders) {
      const at = moved(`o${o.id}`, o.level);
      const shift = at - o.level;
      level(at, pal.ink2, [7, 3, 2, 3], 0.9);
      if (o.sl !== null) level(o.sl + shift, pal.neg, [2, 4], 0.6, `#${o.id} stop, once filled`);
      if (o.tp !== null) level(o.tp + shift, pal.pos, [2, 4], 0.6, `#${o.id} target, once filled`);
    }
    for (const p of sim.positions) {
      level(p.entry, pal.ink, [6, 4], 0.7, `#${p.id} ${p.side} ${fmt(p.lots, 2, 2)} · entry`);
      if (p.sl !== null) level(moved(`p${p.id}sl`, p.sl), pal.neg, [3, 3], 0.95);
      if (p.tp !== null) level(moved(`p${p.id}tp`, p.tp), pal.pos, [3, 3], 0.95);
    }

    // bid (solid) and ask (dashed), with their prices in the margin
    const tag = (p: number, letter: string, above: boolean) => {
      const yy = y(p);
      ctx.font = small;
      ctx.textAlign = "left";
      const text = `${letter} ${px(p)}`;
      const th = 15;
      const ty = above ? yy - th : yy;
      ctx.fillStyle = rgba(pal.accent);
      ctx.fillRect(plotW + 1, ty, gutter - 1, th);
      ctx.fillStyle = rgba(pal.surface);
      ctx.fillText(text, plotW + 5, ty + th / 2 + 0.5);
    };
    level(q.ask, pal.accent, [4, 3], 0.9);
    level(q.bid, pal.accent, [], 0.95);
    tag(q.ask, "A", true);
    tag(q.bid, "B", false);
  }, [sim, size, scale, drag, palTick, candles, plotW, zone, slot, narrow, gutter, q.ask, q.bid]);

  /* ---- moving a level ------------------------------------------------------ */
  const yIn = (clientY: number) => clientY - (boxRef.current?.getBoundingClientRect().top ?? 0);
  const begin = (hd: Handle, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ k: hd.k, key: hd.key, price: hd.price, scale: live });
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const s = drag.scale;
    const yy = Math.min(s.top + s.h, Math.max(s.top, yIn(e.clientY)));
    const price = toPip(priceAt(s, yy));
    if (price !== drag.price) setDrag({ ...drag, price });
  };
  const end = (commit: boolean) => {
    if (!drag) return;
    const d = drag;
    const hd = handles.find((x) => x.k === d.k);
    setDrag(null);
    if (commit && hd && d.price !== hd.price) onMove(d.key, d.price);
  };
  /** with a mouse the line itself can be taken hold of, anywhere along it */
  const nearest = (e: PointerEvent<HTMLElement>): Handle | null => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || e.clientX - r.left > plotW) return null;
    const yy = e.clientY - r.top;
    let best: Handle | null = null;
    let dist = 7;
    for (const hd of handles) {
      const dy = Math.abs(yOf(live, hd.price) - yy);
      if (dy < dist) {
        dist = dy;
        best = hd;
      }
    }
    return best;
  };
  const onKey = (hd: Handle, e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
    if (by === 0) return;
    e.preventDefault();
    // exactly one pip (or ten) from where it is: a level set to a fraction of a pip keeps its fraction
    onMove(hd.key, r5(hd.price + by * PIP));
  };

  const last = sim.candles[sim.candles.length - 1];
  const toneClass = { neg: "border-neg text-neg", pos: "border-pos text-pos", ink: "border-line-strong text-ink" } as const;

  return (
    <div
      ref={boxRef}
      className={`relative h-[19rem] w-full select-none overflow-hidden sm:h-[24rem] lg:h-[28rem] ${hot || drag ? "cursor-ns-resize" : ""}`}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" || e.target !== canvasRef.current) return;
        const hd = nearest(e);
        if (hd) begin(hd, e);
      }}
      onPointerMove={(e) => {
        if (drag) move(e);
        else if (e.pointerType !== "touch") {
          const near = e.target === canvasRef.current && nearest(e) !== null;
          if (near !== hot) setHot(near);
        }
      }}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(false)}
      onPointerLeave={() => {
        if (hot) setHot(false);
      }}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <p className="sr-only">
        Candle chart of the invented {SIM.instrument}. Simulated minute {last ? last.m : 0}. Bid {px(q.bid)}, ask {px(q.ask)}. {sim.positions.length} open {sim.positions.length === 1 ? "position" : "positions"} and {sim.orders.length} waiting {sim.orders.length === 1 ? "order" : "orders"}; their levels are listed and editable below the chart.
      </p>
      {size.w > 0 &&
        handles.map((hd) => {
          const price = drag && drag.k === hd.k ? drag.price : hd.price;
          const top = yOf(scale, price);
          if (top < PAD_T - 2 || top > size.h - AXIS_H + 2) return null;
          const away = pipsBetween(hd.from, price);
          return (
            <div
              key={hd.k}
              role="slider"
              tabIndex={0}
              aria-label={hd.name}
              aria-orientation="vertical"
              aria-valuemin={Number(scale.lo.toFixed(5))}
              aria-valuemax={Number(scale.hi.toFixed(5))}
              aria-valuenow={price}
              aria-valuetext={`${px(price)}, ${pips(away)} ${away < 0 ? "below" : "above"} ${hd.key.target === "position" ? "the entry" : "the price"}`}
              data-handle={hd.k}
              onPointerDown={(e) => {
                e.stopPropagation();
                begin(hd, e);
              }}
              onKeyDown={(e) => onKey(hd, e)}
              style={{ top: top - 12, right: gutter + 4, touchAction: "none" }}
              className={`num absolute flex h-[24px] cursor-ns-resize items-center gap-5 whitespace-nowrap rounded-sm border bg-surface px-5 text-[0.6875rem] leading-none before:absolute before:-inset-y-[10px] before:inset-x-0 before:content-[''] focus-visible:z-10 ${toneClass[hd.tone]} ${drag && drag.k === hd.k ? "z-10" : ""}`}
            >
              <span aria-hidden>↕</span>
              <span>
                {hd.label} {fmt(price, 4, 5)}
              </span>
            </div>
          );
        })}
    </div>
  );
}
