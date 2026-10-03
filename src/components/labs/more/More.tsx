"use client";

import { useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { ALERT, Note, Slider, Stage } from "@/components/labs/kit";
import { seeded } from "@/components/labs/workshop/rng";
import { signalSound } from "@/components/sound/signal";

/**
 * Six more machines. Three are set pieces for the Screening Room (the liquid
 * chart, the candle garden, the paper trail) and three are for the Workshop,
 * made to be handled (build a candle, draw a chart, the risk dial).
 *
 * As everywhere in Labs: every shape is invented or drawn by the visitor,
 * every figure is arithmetic and says so, and nothing forecasts a market.
 */

const PALE: Colour = [232, 240, 246, 1];

/* ---------------------------------------------------------------------------
 * THE LIQUID CHART — support, as water. Three shelves, each holding a pool.
 * Water runs in from the top; a shelf holds until its pool is full, then the
 * water goes over the edge and the shelf below takes it. A level holds only
 * as long as what is resting on it can take what arrives.
 * ------------------------------------------------------------------------- */

export function Liquid() {
  const [flow, setFlow] = useState(3);
  const draw = useMemo<FigureDraw>(() => {
    let filled = 0; // total water so far, in pools (0 to 3)
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 120) return;
      filled = still ? 1.6 : (filled + dt * flow * 0.09) % 3.6;
      const shelves = [0, 1, 2].map((i) => ({ x0: w * (0.08 + i * 0.3), x1: w * (0.08 + i * 0.3) + w * 0.24, y: h * (0.34 + i * 0.22), depth: h * 0.13 }));
      ctx.lineCap = "round";
      ctx.textBaseline = "middle";
      shelves.forEach((s, i) => {
        const level = clamp(filled - i);
        // the shelf: a basin with a lip on its downhill side
        ctx.strokeStyle = rgba(pal.ink2, 0.95);
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y - s.depth);
        ctx.lineTo(s.x0, s.y);
        ctx.lineTo(s.x1, s.y);
        ctx.lineTo(s.x1, s.y - s.depth * 0.82);
        ctx.stroke();
        if (level > 0) {
          const top = s.y - s.depth * 0.82 * level;
          ctx.beginPath();
          ctx.moveTo(s.x0 + 1, s.y - 1);
          for (let x = s.x0 + 1; x <= s.x1 - 1; x += 6) ctx.lineTo(x, top + (still ? 0 : Math.sin(x * 0.12 + t * 3) * 1.5));
          ctx.lineTo(s.x1 - 1, s.y - 1);
          ctx.closePath();
          ctx.fillStyle = rgba(pal.accent, 0.35);
          ctx.fill();
        }
        ctx.font = `600 10px ${pal.font}`;
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(level >= 1 ? ALERT : level > 0 ? pal.accent : pal.ink3, 1);
        ctx.fillText(level >= 1 ? "GIVEN WAY" : level > 0 ? "HOLDING" : `LEVEL ${i + 1}`, s.x0, s.y + 12);
        // the water going over the lip, to the shelf below (or away, off the last)
        if (level >= 1 && !still) {
          const nx = i < 2 ? shelves[i + 1].x0 + 14 : w - 8;
          const ny = i < 2 ? shelves[i + 1].y - 4 : h;
          ctx.strokeStyle = rgba(pal.accent, 0.85);
          ctx.lineWidth = 2 + flow * 0.4;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -t * 60;
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y - s.depth * 0.82);
          ctx.quadraticCurveTo(s.x1 + 16, s.y - s.depth, nx, ny);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      // the source
      if (!still) {
        ctx.strokeStyle = rgba(pal.accent, 0.85);
        ctx.lineWidth = 2 + flow * 0.4;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 60;
        ctx.beginPath();
        ctx.moveTo(shelves[0].x0 + 18, 0);
        ctx.lineTo(shelves[0].x0 + 18, shelves[0].y - 3);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
  }, [flow]);
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={flow} />
      <Slider label="How much is arriving" value={flow} min={1} max={8} onChange={setFlow} text={flow <= 2 ? "a trickle" : flow <= 5 ? "a steady flow" : "a flood"} />
      <p className="mt-8 text-ink-2">A level holds for as long as it can take what arrives. When it is full it gives way, and the next level below takes the flow. More arriving means each gives way sooner.</p>
      <Note>A picture of support levels under selling. An idea, drawn: not a description of any market.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * THE CANDLE GARDEN — a row of candles that sway like plants. The wind is
 * volatility: in still air they stand, in a gale they whip about. Close the
 * session and night falls: nothing new grows until it opens again.
 * ------------------------------------------------------------------------- */

const GARDEN = (() => {
  const r = seeded(4477);
  return Array.from({ length: 16 }, () => ({ h: 0.3 + r() * 0.5, body: 0.12 + r() * 0.2, up: r() < 0.55, phase: r() * TAU }));
})();

export function Garden() {
  const [wind, setWind] = useState(2);
  const [open, setOpen] = useState(true);
  const draw = useMemo<FigureDraw>(() => {
    let night = open ? 0 : 1;
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 120) return;
      night = still ? (open ? 0 : 1) : night + ((open ? 0 : 1) - night) * (1 - Math.exp(-dt * 2));
      const ground = h - 22;
      ctx.fillStyle = rgba([10, 14, 20, 1], night * 0.82);
      ctx.fillRect(0, 0, w, ground);
      for (let s = 0; s < 24; s++) {
        ctx.fillStyle = rgba(PALE, night * (0.3 + 0.4 * ((Math.sin(t + s) + 1) / 2)));
        ctx.fillRect((s * 97) % w, (s * 41) % (ground * 0.6), 1.3, 1.3);
      }
      ctx.lineCap = "round";
      GARDEN.forEach((c, i) => {
        const x = lerp(18, w - 18, i / (GARDEN.length - 1));
        // at night the garden is still; by day it sways with the wind
        const sway = still ? 0 : Math.sin(t * (1 + wind * 0.5) + c.phase) * 0.05 * wind * (1 - night);
        const stem = (ground - 16) * c.h * (1 + (still ? 0 : Math.sin(t * 2 + c.phase) * 0.03 * wind * (1 - night)));
        const tone = mixTone(c.up ? pal.emerald : ALERT, pal.ink3, night * 0.7);
        ctx.save();
        ctx.translate(x, ground);
        ctx.rotate(sway);
        ctx.strokeStyle = rgba(tone, 0.95);
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -stem);
        ctx.stroke();
        const bh = stem * c.body * 2;
        ctx.fillStyle = rgba(tone, 0.95);
        ctx.fillRect(-5, -stem * 0.62 - bh / 2, 10, bh);
        ctx.restore();
      });
      ctx.strokeStyle = rgba(pal.ink3, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ground + 0.5);
      ctx.lineTo(w, ground + 0.5);
      ctx.stroke();
      ctx.font = `600 10px ${pal.font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(night > 0.5 ? PALE : pal.ink3, 1);
      ctx.fillText(night > 0.5 ? "SESSION CLOSED" : "SESSION OPEN", 10, h - 10);
    };
  }, [wind, open]);
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={wind + (open ? 0 : 10)} />
      <Slider label="The wind" value={wind} min={0} max={5} onChange={setWind} text={["still air", "a breeze", "fresh", "blowing", "a gale", "a storm"][wind]} />
      <div className="mt-8 flex flex-wrap gap-13">
        <button type="button" className="btn btn-ghost" aria-pressed={!open} onClick={() => setOpen((v) => !v)}>
          {open ? "Close the session" : "Open the session"}
        </button>
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        {open ? (wind <= 1 ? "Still air: the candles barely move. Low volatility." : wind <= 3 ? "The same garden in a wind: the swings are wider, in both directions." : "A gale: nothing about the candles has changed but how far they are thrown.") : "Night: the session is closed and the garden is still. Nothing new forms until it opens."}
      </p>
      <Note>Invented candles. The wind is volatility: it is not a direction.</Note>
    </div>
  );
}
const mixTone = (a: Colour, b: Colour, k: number): Colour => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), 1];

/* ---------------------------------------------------------------------------
 * THE PAPER TRAIL — the ticket folds itself into a paper plane and flies the
 * order's route: past the checks, through the routing, to the fill, leaving
 * its trail behind it.
 * ------------------------------------------------------------------------- */

const STOPS = ["CHECKS", "ROUTING", "FILL"] as const;

export function PaperTrail() {
  const [n, setN] = useState(0);
  const [at, setAt] = useState(-1);
  const shown = useRef(-1);
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 120) return;
      if (began === null) began = t;
      const T = n === 0 ? 0 : still ? 99 : t - began;
      const fold = smooth(T / 1.1);
      const fly = clamp((T - 1.1) / 4.4);
      const start = { x: w * 0.12, y: h * 0.62 };
      const pts = STOPS.map((_, i) => ({ x: w * (0.36 + i * 0.24), y: h * (0.3 + (i % 2) * 0.3) }));
      // the route, and the stops on it
      const pos = (u: number) => {
        const all = [start, ...pts];
        const seg = Math.min(all.length - 2, Math.floor(u * (all.length - 1)));
        const k = u * (all.length - 1) - seg;
        const a = all[seg];
        const b = all[seg + 1];
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * h * 0.12, ang: Math.atan2(b.y - a.y - Math.cos(k * Math.PI) * h * 0.38, b.x - a.x) };
      };
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const reached = Math.floor(fly * STOPS.length + 0.001) - 1;
      if (n > 0 && reached !== shown.current) {
        shown.current = reached;
        setAt(reached);
        if (reached >= 0) signalSound(reached === 2 ? "chime" : "tick");
      }
      pts.forEach((p, i) => {
        const on = fly * STOPS.length >= i + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, TAU);
        ctx.fillStyle = rgba(pal.surface, 1);
        ctx.fill();
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = rgba(on ? (i === 2 ? pal.gold : pal.accent) : pal.ink3, 0.95);
        ctx.stroke();
        ctx.font = `600 10px ${pal.font}`;
        ctx.fillStyle = rgba(on ? pal.ink : pal.ink3, 1);
        ctx.fillText(STOPS[i], p.x, p.y + 22);
      });
      // the trail behind the plane
      if (fly > 0) {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = rgba(pal.accent, 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let u = 0; u <= fly; u += 0.01) {
          const p = pos(u);
          if (u === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // the ticket, folding into a plane, then the plane in flight
      const p = fly > 0 ? pos(fly) : { x: start.x, y: start.y, ang: 0 };
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang * fold);
      const tw = lerp(54, 40, fold);
      const th = lerp(70, 22, fold);
      ctx.beginPath();
      ctx.moveTo(lerp(-tw / 2, -tw / 2, fold), lerp(-th / 2, -th / 2, fold));
      ctx.lineTo(lerp(tw / 2, tw / 2 + 8, fold), lerp(-th / 2, 0, fold));
      ctx.lineTo(lerp(tw / 2, tw / 2 + 8, fold), lerp(th / 2, 0, fold));
      ctx.lineTo(lerp(-tw / 2, -tw / 2, fold), lerp(th / 2, th / 2, fold));
      ctx.lineTo(lerp(-tw / 2, -tw / 4, fold), 0);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.surface, 1);
      ctx.fill();
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = rgba(pal.ink, 0.9);
      ctx.stroke();
      if (fold < 0.6) {
        // the ticket's lines, before it is folded
        ctx.strokeStyle = rgba(pal.ink3, 1 - fold * 1.6);
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-tw / 2 + 8, -th / 2 + 14 + i * 12);
          ctx.lineTo(tw / 2 - (i % 2 ? 16 : 8), -th / 2 + 14 + i * 12);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(-tw / 4, 0);
        ctx.lineTo(tw / 2 + 8, 0);
        ctx.strokeStyle = rgba(pal.ink3, 0.9);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    };
  }, [n]);
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={n * 10 + at} />
      <div className="mt-13 flex flex-wrap gap-13">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            shown.current = -1;
            setAt(-1);
            setN((v) => v + 1);
          }}
        >
          {n ? "Send another" : "Send the ticket"}
        </button>
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {n === 0 && "A ticket waits to be sent."}
        {n > 0 && at < 0 && "Folded, and away."}
        {at === 0 && "Past the checks: there is margin for it and the size is allowed."}
        {at === 1 && "Through the routing: on its way to where it can be filled."}
        {at >= 2 && "Filled. The trail behind it is the record of the order."}
      </p>
      <Note>General mechanics, in order. Not a description of how any one broker handles an order.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * BUILD A CANDLE — four handles: where it opened, where it closed, how far
 * above it reached, how far below. The shape you make is named.
 * ------------------------------------------------------------------------- */

function nameCandle(o: number, c: number, up: number, lo: number): { name: string; says: string } {
  const body = Math.abs(c - o);
  const range = body + up + lo;
  if (range === 0) return { name: "Four prices the same", says: "It opened, never moved, and closed. A dash on the chart." };
  const b = body / range;
  const u = up / range;
  const l = lo / range;
  const rose = c > o;
  if (b < 0.1) {
    if (l > 0.6 && u < 0.15) return { name: "Dragonfly doji", says: "It fell a long way and came all the way back to where it opened." };
    if (u > 0.6 && l < 0.15) return { name: "Gravestone doji", says: "It rose a long way and came all the way back to where it opened." };
    return { name: "Doji", says: "It closed where it opened: the period ended undecided." };
  }
  if (b > 0.9) return { name: rose ? "Marubozu, up" : "Marubozu, down", says: rose ? "All body: it opened at its low and closed at its high." : "All body: it opened at its high and closed at its low." };
  if (l > 0.55 && u < 0.15 && b < 0.35) return { name: "Hammer shape", says: "A small body at the top and a long lower wick: sold down, then bought back up. After a rise the same shape is called a hanging man." };
  if (u > 0.55 && l < 0.15 && b < 0.35) return { name: "Shooting-star shape", says: "A small body at the bottom and a long upper wick: bought up, then sold back down. After a fall the same shape is called an inverted hammer." };
  if (b < 0.35 && u > 0.2 && l > 0.2) return { name: "Spinning top", says: "A small body with a wick each side: it went both ways and ended near the middle." };
  return { name: rose ? "A rising candle" : "A falling candle", says: rose ? "It closed above its open, with a body that takes up much of its range." : "It closed below its open, with a body that takes up much of its range." };
}

export function BuildCandle() {
  const [v, setV] = useState({ o: 40, c: 62, up: 8, lo: 14 });
  const got = nameCandle(v.o, v.c, v.up, v.lo);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 160 || h < 120) return;
        const hi = Math.max(v.o, v.c) + v.up;
        const lowest = Math.min(v.o, v.c) - v.lo;
        const y = (p: number) => lerp(h - 14, 14, (p + 45) / 190);
        const cx = w * 0.42;
        const tone = v.c >= v.o ? pal.emerald : ALERT;
        ctx.strokeStyle = rgba(tone, 1);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, y(hi));
        ctx.lineTo(cx, y(lowest));
        ctx.stroke();
        ctx.fillStyle = rgba(tone, 1);
        ctx.fillRect(cx - 26, y(Math.max(v.o, v.c)), 52, Math.max(3, y(Math.min(v.o, v.c)) - y(Math.max(v.o, v.c))));
        ctx.font = `600 10px ${pal.font}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        for (const [label, p] of [["HIGH", hi], ["LOW", lowest], ["OPEN", v.o], ["CLOSE", v.c]] as const) {
          const side = label === "OPEN" ? -1 : 1;
          ctx.strokeStyle = rgba(pal.ink3, 0.9);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + side * 32, y(p));
          ctx.lineTo(cx + side * 56, y(p));
          ctx.stroke();
          ctx.textAlign = side > 0 ? "left" : "right";
          ctx.fillStyle = rgba(pal.ink2, 1);
          ctx.fillText(label, cx + side * 62, y(p));
        }
      },
    [v],
  );
  const rows: [keyof typeof v, string, number, number][] = [
    ["o", "Where it opened", 0, 100],
    ["c", "Where it closed", 0, 100],
    ["up", "How far above it reached", 0, 45],
    ["lo", "How far below it reached", 0, 45],
  ];
  return (
    <div>
      <Stage draw={draw} ratio={1.5} rev={v.o + v.c * 3 + v.up * 7 + v.lo * 11} />
      <div className="grid gap-x-21 sm:grid-cols-2">
        {rows.map(([key, label, min, max]) => (
          <Slider key={key} label={label} value={v[key]} min={min} max={max} onChange={(n) => setV((s) => ({ ...s, [key]: n }))} text={String(v[key])} />
        ))}
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        <strong className="font-display text-xl font-normal text-ink">{got.name}.</strong> {got.says}
      </p>
      <Note>A name describes a shape. It does not say what the next candle will do.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * DRAW A CHART — sketch a line with a finger or the mouse. When the pen is
 * lifted the line's average is laid over it and each stretch is named: a
 * rise, a fall, or a range. It is your drawing that is read, nothing else.
 * ------------------------------------------------------------------------- */

const COLS = 96;

export function DrawChart() {
  const pts = useRef<(number | null)[]>(Array(COLS).fill(null));
  const pen = useRef(false);
  const lastCol = useRef(-1);
  const [rev, setRev] = useState(0);
  const [read, setRead] = useState<string>("");
  const id = useId();

  const analyse = () => {
    const ys = pts.current;
    const have = ys.filter((v) => v !== null).length;
    if (have < COLS * 0.4) {
      setRead(have ? "Draw a little further across, and it can be read." : "");
      return;
    }
    const parts: string[] = [];
    for (let s = 0; s < 4; s++) {
      const seg = ys.slice(s * 24, s * 24 + 24).filter((v): v is number => v !== null);
      if (seg.length < 8) continue;
      const slope = seg[0] - seg[seg.length - 1]; // y grows downward, so a positive value is a rise
      parts.push(Math.abs(slope) < 0.08 ? "a range" : slope > 0 ? "a rise" : "a fall");
    }
    const merged = parts.filter((p, i) => p !== parts[i - 1]);
    setRead(`Read from left to right: ${merged.join(", then ")}. The gold line is the average of the last twelve points of your own line: it follows, and it turns late.`);
  };

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { col: clamp(Math.floor(((e.clientX - r.left) / r.width) * COLS), 0, COLS - 1), y: clamp((e.clientY - r.top) / r.height, 0.04, 0.96) };
  };
  const put = (e: PointerEvent<HTMLDivElement>) => {
    const p = at(e);
    const from = lastCol.current < 0 ? p.col : lastCol.current;
    const y0 = pts.current[from] ?? p.y;
    const step = p.col >= from ? 1 : -1;
    for (let c = from; c !== p.col + step; c += step) pts.current[c] = lerp(y0, p.y, from === p.col ? 1 : (c - from) / (p.col - from));
    lastCol.current = p.col;
    setRev((v) => v + 1);
  };

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 160 || h < 100) return;
        const ys = pts.current;
        const x = (c: number) => ((c + 0.5) / COLS) * w;
        if (ys.every((v) => v === null)) {
          ctx.font = `500 13px ${pal.font}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(pal.ink3, 1);
          ctx.fillText("Draw a line across here", w / 2, h / 2);
          return;
        }
        const line = (get: (c: number) => number | null, colour: string, width: number) => {
          ctx.beginPath();
          let down = false;
          for (let c = 0; c < COLS; c++) {
            const v = get(c);
            if (v === null) {
              down = false;
              continue;
            }
            if (!down) ctx.moveTo(x(c), v * h);
            else ctx.lineTo(x(c), v * h);
            down = true;
          }
          ctx.lineWidth = width;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.strokeStyle = colour;
          ctx.stroke();
        };
        line((c) => ys[c], rgba(pal.accent, 1), 2.2);
        if (!pen.current) {
          line((c) => {
            let s = 0;
            let n = 0;
            for (let k = Math.max(0, c - 11); k <= c; k++) {
              const v = ys[k];
              if (v !== null) {
                s += v;
                n++;
              }
            }
            return n >= 6 && ys[c] !== null ? s / n : null;
          }, rgba(pal.gold, 1), 1.7);
        }
      },
    [],
  );

  return (
    <div>
      <div className="gx-stage max-sm:[&>div>div]:![aspect-ratio:1.4]">
        <div className="relative">
          <Figure draw={draw} ratio={1.9} rev={rev} />
          <div
            className="absolute inset-0 cursor-crosshair touch-none"
            aria-hidden
            onPointerDown={(e) => {
              pen.current = true;
              lastCol.current = -1;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* the pointer has already gone */
              }
              put(e);
            }}
            onPointerMove={(e) => pen.current && put(e)}
            onPointerUp={() => {
              pen.current = false;
              analyse();
              setRev((v) => v + 1);
            }}
            onPointerCancel={() => {
              pen.current = false;
            }}
          />
        </div>
      </div>
      <div className="mt-13 flex flex-wrap gap-13">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            pts.current = Array(COLS).fill(null);
            setRead("");
            setRev((v) => v + 1);
          }}
        >
          Clear it
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            // for anyone who cannot draw with a pointer: a line is drawn for them, and read the same way
            const r = seeded(Date.now() % 100000);
            let y = 0.6;
            pts.current = Array.from({ length: COLS }, (_, c) => (y = clamp(y + (r() - 0.5) * 0.06 + (c < 40 ? -0.006 : c < 64 ? 0 : 0.005), 0.08, 0.92)));
            analyse();
            setRev((v) => v + 1);
          }}
        >
          Draw one for me
        </button>
      </div>
      <p id={id} className="mt-13 min-h-[4.5rem] text-ink-2" aria-live="polite">
        {read || "Sketch a line from left to right with the mouse or a finger. Lift the pen and it is read."}
      </p>
      <Note>It reads the line you drew. A stretch is called a range when it ends about where it began.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * THE RISK DIAL — one dial: the share of the account risked on each trade.
 * Turn it up and the weather behind it turns. The figure beneath is
 * arithmetic: what is left of an account after ten losses in a row.
 * ------------------------------------------------------------------------- */

export function RiskDial() {
  const [risk, setRisk] = useState(2);
  const left = Math.pow(1 - risk / 100, 10) * 100;
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 160 || h < 120) return;
        const k = clamp((risk - 0.5) / 19.5); // 0 calm, 1 storm
        const time = still ? 1 : t;
        // the weather behind the dial
        ctx.fillStyle = rgba([10, 14, 20, 1], k * 0.7);
        ctx.fillRect(0, 0, w, h);
        for (let layer = 0; layer < 3; layer++) {
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.72 + layer * 0.07) + Math.sin(x * 0.03 + time * (1 + k * 3) + layer) * (3 + k * 22));
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = rgba(k > 0.5 ? ALERT : pal.accent, 0.12 + layer * 0.05);
          ctx.fill();
        }
        if (k > 0.55 && !still && Math.sin(time * 7) > 0.96) {
          ctx.fillStyle = rgba(PALE, 0.3);
          ctx.fillRect(0, 0, w, h);
        }
        // the dial
        const cx = w / 2;
        const cy = h * 0.6;
        const R = Math.min(w * 0.3, h * 0.46);
        const a0 = Math.PI * 0.85;
        const a1 = Math.PI * 2.15;
        ctx.lineCap = "round";
        ctx.lineWidth = 9;
        ctx.strokeStyle = rgba(pal.line, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0, a1);
        ctx.stroke();
        const grad = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
        grad.addColorStop(0, rgba(pal.emerald, 1));
        grad.addColorStop(0.5, rgba(pal.gold, 1));
        grad.addColorStop(1, rgba(ALERT, 1));
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0, lerp(a0, a1, k));
        ctx.stroke();
        const a = lerp(a0, a1, k) + (still ? 0 : Math.sin(time * (2 + k * 14)) * 0.012 * (1 + k * 6));
        ctx.strokeStyle = rgba(k > 0.5 ? PALE : pal.ink, 1);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, TAU);
        ctx.fillStyle = rgba(pal.gold, 1);
        ctx.fill();
        ctx.font = `300 ${Math.min(34, R * 0.5)}px ${pal.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = rgba(k > 0.5 ? PALE : pal.ink, 1);
        ctx.fillText(`${risk}%`, cx, cy + R * 0.42);
      },
    [risk],
  );
  return (
    <div>
      <Stage draw={draw} ratio={1.7} rev={risk * 2} />
      <Slider label="Share of the account risked on each trade" value={risk} min={0.5} max={20} step={0.5} onChange={setRisk} text={`${risk}%`} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        At <strong className="num text-ink">{risk}%</strong> a trade, ten losses in a row leave <strong className="num text-ink">{left.toFixed(left < 10 ? 1 : 0)}%</strong> of the account.
        {risk <= 2 ? " A long losing run is survivable." : risk <= 6 ? " A bad run takes a large bite." : " A bad run, which comes to everyone eventually, is close to the end of the account."}
      </p>
      <Note>Arithmetic: (1 − risk)¹⁰. With an even chance on each trade, a run of ten losses is to be expected about once in a thousand trades.</Note>
    </div>
  );
}
