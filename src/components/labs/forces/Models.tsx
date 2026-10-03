"use client";

import { useEffect, useMemo, useState } from "react";
import { TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";
import { ALERT, Note, Slider, Stage } from "@/components/labs/kit";
import { signalSound } from "@/components/sound/signal";
import { fxSessions, localTime } from "@/lib/sessions";

/**
 * FORCES — four models of what moves a market, made physical.
 *
 * Each is a textbook simplification and says so: the directions shown are the
 * ones economics teaches as the usual tendency, other things being equal.
 * Real markets weigh many things at once and often do the opposite of the
 * textbook. Nothing here is a forecast, and no price is shown.
 */

/* ---------------------------------------------------------------------------
 * 1. THE TUG OF WAR
 * A currency pair is one currency priced in another, so it is always a
 * contest between two. Add weights to either side and the flag on the rope
 * moves: towards the base, the pair rises; towards the quote, it falls.
 * ------------------------------------------------------------------------- */

const WEIGHTS = [
  { key: "rate", name: "Higher interest rate", pull: 2 },
  { key: "growth", name: "Stronger growth", pull: 1 },
  { key: "surplus", name: "Trade surplus", pull: 1 },
  { key: "doubt", name: "Political uncertainty", pull: -2 },
] as const;

export function TugOfWar() {
  const [base, setBase] = useState<Record<string, boolean>>({ rate: true });
  const [quote, setQuote] = useState<Record<string, boolean>>({});
  const sum = (s: Record<string, boolean>) => WEIGHTS.reduce((n, x) => n + (s[x.key] ? x.pull : 0), 0);
  const net = sum(base) - sum(quote);

  const draw = useMemo<FigureDraw>(() => {
    let shown = 0;
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 110) return;
      shown = still ? net : shown + (net - shown) * (1 - Math.exp(-dt * 4));
      const y = h * 0.52;
      const strain = still ? 0 : Math.sin(t * 9) * 1.2;
      const flagX = w / 2 - clamp(shown / 5, -1, 1) * (w * 0.28) + strain;
      ctx.textBaseline = "middle";
      ctx.lineCap = "round";

      // the ground and the centre mark
      ctx.strokeStyle = rgba(pal.ink3, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, y - 26);
      ctx.lineTo(w / 2, y + 30);
      ctx.stroke();
      // the rope
      ctx.strokeStyle = rgba(pal.ink2, 1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.lineTo(w - 22, y);
      ctx.stroke();
      // the two teams: one figure for each weight on that side
      const team = (side: -1 | 1, state: Record<string, boolean>, tone: typeof pal.accent) => {
        const members = Math.max(1, WEIGHTS.filter((x) => state[x.key] && x.pull > 0).length + 1 - WEIGHTS.filter((x) => state[x.key] && x.pull < 0).length);
        for (let i = 0; i < Math.max(1, members); i++) {
          const x = (side < 0 ? 34 : w - 34) - side * i * 20;
          const lean = side * 0.35;
          ctx.save();
          ctx.translate(x - clamp(shown / 5, -1, 1) * (w * 0.06), y);
          ctx.rotate(lean);
          ctx.strokeStyle = rgba(tone, 1);
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -16);
          ctx.moveTo(-5, 16);
          ctx.lineTo(0, 0);
          ctx.lineTo(5, 16);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, -22, 5, 0, TAU);
          ctx.fillStyle = rgba(tone, 1);
          ctx.fill();
          ctx.restore();
        }
      };
      team(-1, base, pal.accent);
      team(1, quote, pal.gold);
      // the flag
      ctx.fillStyle = rgba(net === 0 ? pal.ink3 : net > 0 ? pal.accent : pal.gold, 1);
      ctx.beginPath();
      ctx.moveTo(flagX, y - 3);
      ctx.lineTo(flagX, y - 24);
      ctx.lineTo(flagX + (net >= 0 ? -16 : 16), y - 17);
      ctx.lineTo(flagX, y - 10);
      ctx.fill();
      ctx.font = `600 10px ${pal.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(pal.accent, 1);
      ctx.fillText("BASE CURRENCY", 14, 14);
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.fillText("QUOTE CURRENCY", w - 14, 14);
    };
  }, [base, quote, net]);

  const toggles = (state: Record<string, boolean>, set: (s: Record<string, boolean>) => void, label: string) => (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="mt-5 grid gap-3">
        {WEIGHTS.map((x) => (
          <label key={x.key} className="flex min-h-[2.75rem] items-center gap-8 text-sm text-ink-2">
            <input type="checkbox" checked={!!state[x.key]} onChange={(e) => set({ ...state, [x.key]: e.target.checked })} className="h-[1.125rem] w-[1.125rem] accent-[var(--accent)]" />
            {x.name}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div>
      <Stage draw={draw} ratio={2.3} rev={net * 10 + Object.values(base).filter(Boolean).length} />
      <div className="mt-13 grid gap-21 sm:grid-cols-2">
        {toggles(base, setBase, "On the base currency’s side")}
        {toggles(quote, setQuote, "On the quote currency’s side")}
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        {net === 0 && "Evenly matched: the textbook gives the pair no reason to go either way."}
        {net > 0 && "The base currency has the stronger pull: the textbook tendency is for the pair to rise."}
        {net < 0 && "The quote currency has the stronger pull: the textbook tendency is for the pair to fall."}
      </p>
      <Note>The usual tendency, other things being equal. Markets weigh expectations as well as facts, and often move the other way.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. THE LEVER ROOM
 * A central bank moves its policy rate. The textbook chain runs from the rate
 * through borrowing costs and spending to prices and the currency, each link
 * following the last, the later ones after a long delay.
 * ------------------------------------------------------------------------- */

const CHAIN = [
  { name: "Policy rate", up: "raised", down: "cut" },
  { name: "Borrowing costs", up: "rise", down: "fall" },
  { name: "Spending", up: "slows", down: "picks up" },
  { name: "Inflation", up: "eases, later", down: "builds, later" },
  { name: "Currency", up: "tends to firm", down: "tends to soften" },
] as const;
/** which way each link moves when the rate goes up: 1 up, -1 down */
const DIR = [1, 1, -1, -1, 1] as const;

export function LeverRoom() {
  const [move, setMove] = useState<1 | -1>(1);
  const [n, setN] = useState(0);
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 120) return;
      if (began === null) began = t;
      const T = still ? 99 : t - began;
      const pad = 16;
      const gap = (w - pad * 2) / CHAIN.length;
      const y = h * 0.46;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      CHAIN.forEach((c, i) => {
        const x = pad + gap * (i + 0.5);
        const lit = smooth((T - i * 0.9) / 0.5);
        const dir = DIR[i] * move;
        if (i < CHAIN.length - 1) {
          // the link to the next: a pulse runs along it
          ctx.strokeStyle = rgba(pal.ink3, 0.5);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + 15, y);
          ctx.lineTo(x + gap - 15, y);
          ctx.stroke();
          const p = clamp((T - i * 0.9 - 0.4) / 0.5);
          if (p > 0 && p < 1) {
            ctx.beginPath();
            ctx.arc(lerp(x + 15, x + gap - 15, p), y, 3.2, 0, TAU);
            ctx.fillStyle = rgba(pal.gold, 1);
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, TAU);
        ctx.fillStyle = rgba(pal.surface, 1);
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = rgba(lit > 0.5 ? pal.accent : pal.ink3, 0.95);
        ctx.stroke();
        if (lit > 0.05) {
          // an arrow, up or down
          ctx.strokeStyle = rgba(dir > 0 ? pal.emerald : ALERT, lit);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y + 6 * dir);
          ctx.lineTo(x, y - 6 * dir);
          ctx.moveTo(x - 4, y - 2 * dir);
          ctx.lineTo(x, y - 6 * dir);
          ctx.lineTo(x + 4, y - 2 * dir);
          ctx.stroke();
        }
        ctx.font = `600 ${gap < 70 ? 8 : 10}px ${pal.font}`;
        ctx.fillStyle = rgba(lit > 0.5 ? pal.ink : pal.ink3, 1);
        const words = c.name.toUpperCase().split(" ");
        words.forEach((word, k) => ctx.fillText(word, x, y + 28 + k * 11));
      });
    };
    // a new pull of the lever starts the chain again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move, n]);

  const pull = (m: 1 | -1) => {
    setMove(m);
    setN((v) => v + 1);
    signalSound("knock");
  };
  return (
    <div>
      <Stage draw={draw} ratio={2.3} rev={n} />
      <div className="mt-13 flex flex-wrap gap-13">
        <button type="button" className="btn btn-ghost" aria-pressed={move === 1} onClick={() => pull(1)}>
          Raise the rate
        </button>
        <button type="button" className="btn btn-ghost" aria-pressed={move === -1} onClick={() => pull(-1)}>
          Cut the rate
        </button>
      </div>
      <ol className="mt-13 grid gap-3 text-sm text-ink-2">
        {CHAIN.map((c) => (
          <li key={c.name}>
            <span className="font-medium text-ink">{c.name}</span>: {move > 0 ? c.up : c.down}
          </li>
        ))}
      </ol>
      <Note>The textbook chain. Each link takes time, the later ones many months, and a currency often moves on what was expected rather than on the decision itself.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. THE SHOCKWAVE
 * A scheduled release lands like a stone in a pond. The ripple reaches first
 * what is tied to it most directly and then what is tied to it less. The
 * rings are a general reading of those ties, not a measurement.
 * ------------------------------------------------------------------------- */

const RELEASES = [
  { key: "rate", name: "A US rate decision", rings: [["US dollar pairs"], ["Gold", "US indices"], ["Other currencies", "Crypto"]] },
  { key: "jobs", name: "The US jobs report", rings: [["US dollar pairs"], ["US indices", "Gold"], ["Other currencies"]] },
  { key: "cpi", name: "Euro-area inflation", rings: [["Euro pairs"], ["European indices"], ["US dollar pairs", "Gold"]] },
  { key: "oil", name: "Oil inventories", rings: [["Crude oil"], ["Oil-linked currencies"], ["Energy shares"]] },
] as const;

export function Shockwave() {
  const [at, setAt] = useState(0);
  const [n, setN] = useState(0);
  const rel = RELEASES[at];
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 130) return;
      if (began === null) began = t;
      const T = still ? 99 : t - began;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w / 2 - 10, h / 2 - 8) * 1.25;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const wave = T * 0.36; // the ripple's radius, as a share of R
      rel.rings.forEach((names, ring) => {
        const rr = ((ring + 1) / 3.4) * R;
        const reached = wave * R >= rr;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * 0.62, 0, 0, TAU);
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(reached ? pal.accent : pal.ink3, reached ? 0.9 : 0.4);
        ctx.stroke();
        ctx.setLineDash([]);
        names.forEach((name, k) => {
          const a = -Math.PI / 2 + ((k + 0.5) / names.length) * TAU + ring * 0.9;
          ctx.font = `${reached ? 600 : 500} ${w < 360 ? 9 : 10}px ${pal.font}`;
          const tw = ctx.measureText(name).width + 12;
          // kept inside the canvas: on a phone the outer ring is wider than the room for its names
          const x = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, cx + Math.cos(a) * rr));
          const y = cy + Math.sin(a) * rr * 0.62;
          ctx.fillStyle = rgba(pal.surface, 1);
          ctx.fillRect(x - tw / 2, y - 8, tw, 16);
          ctx.fillStyle = rgba(reached ? pal.ink : pal.ink3, 1);
          ctx.fillText(name, x, y);
        });
      });
      // the travelling ripples
      for (let k = 0; k < 3; k++) {
        const u = wave - k * 0.12;
        if (u <= 0 || u > 1.15) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, u * R, u * R * 0.62, 0, 0, TAU);
        ctx.lineWidth = 2 - k * 0.5;
        ctx.strokeStyle = rgba(pal.gold, (1 - u / 1.15) * (1 - k * 0.3));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, TAU);
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.fill();
    };
    // dropping the stone again restarts the ripple
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel, n]);
  return (
    <div>
      <Stage draw={draw} ratio={1.7} rev={n} />
      <div className="mt-13 flex flex-wrap gap-8" role="group" aria-label="Choose a release">
        {RELEASES.map((r, i) => (
          <button
            key={r.key}
            type="button"
            className="btn btn-ghost"
            aria-pressed={i === at}
            onClick={() => {
              setAt(i);
              setN((v) => v + 1);
              signalSound("soft");
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        {rel.name}: felt first by {rel.rings[0].join(" and ").toLowerCase()}, then by {rel.rings[1].join(" and ").toLowerCase()}, and more faintly by {rel.rings[2].join(" and ").toLowerCase()}.
      </p>
      <Note>A general reading of how directly each market is tied to the release. It is not a measurement, and it says nothing about direction or size.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. THE LIQUIDITY TIDE
 * A harbour through twenty-four hours of UTC. The water stands for how many
 * of the four conventional FX windows are open, read from the same timetable
 * as the clock. When the water is high the market is full and spreads are
 * usually at their narrowest; at low water they usually widen.
 * ------------------------------------------------------------------------- */

type Arc = { from: number; to: number };
let arcs: Arc[] | null = null;
function windows(): Arc[] {
  if (arcs) return arcs;
  const now = new Date();
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  arcs = fxSessions.map((s) => {
    const offset = ((((localTime(now, s.tz).minutes - utc + 720) % 1440) + 1440) % 1440) - 720;
    const wrap = (m: number) => (((m - offset) % 1440) + 1440) % 1440;
    return { from: wrap(s.open) / 60, to: wrap(s.close) / 60 };
  });
  return arcs;
}
const openAt = (hour: number) => windows().filter((a) => (a.from <= a.to ? hour >= a.from && hour < a.to : hour >= a.from || hour < a.to)).length;

export function Tide() {
  const [hour, setHour] = useState(14);
  const [open, setOpen] = useState(2);
  useEffect(() => setOpen(openAt(hour)), [hour]);
  const draw = useMemo<FigureDraw>(() => {
    let level = open;
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 120) return;
      level = still ? open : level + (open - level) * (1 - Math.exp(-dt * 3));
      const floor = h - 14;
      const water = lerp(floor - 16, h * 0.32, clamp(level / 3));
      const time = still ? 0 : t;
      // the harbour wall, with its depth marks
      ctx.fillStyle = rgba(pal.ink3, 0.5);
      ctx.fillRect(10, h * 0.2, 5, floor - h * 0.2);
      ctx.font = `600 9px ${pal.font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (let k = 0; k <= 3; k++) {
        const y = lerp(floor - 16, h * 0.32, k / 3);
        ctx.fillStyle = rgba(pal.ink3, 0.95);
        ctx.fillRect(15, y, 7, 1);
        ctx.fillText(String(k), 26, y);
      }
      // the water
      ctx.beginPath();
      ctx.moveTo(15, floor);
      for (let x = 15; x <= w; x += 8) ctx.lineTo(x, water + Math.sin(x * 0.045 + time * 1.6) * 3);
      ctx.lineTo(w, floor);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.accent, 0.22);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.accent, 0.95);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = rgba(pal.ink3, 0.6);
      ctx.fillRect(0, floor, w, 2);
      // a boat that rides the water, or sits on the bottom
      const bx = w * 0.62;
      const by = Math.min(water + Math.sin(bx * 0.045 + time * 1.6) * 3, floor - 2);
      ctx.fillStyle = rgba(pal.ink, 0.9);
      ctx.beginPath();
      ctx.moveTo(bx - 24, by - 9);
      ctx.lineTo(bx + 24, by - 9);
      ctx.lineTo(bx + 15, by);
      ctx.lineTo(bx - 15, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink, 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by - 9);
      ctx.lineTo(bx, by - 34);
      ctx.stroke();
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.beginPath();
      ctx.moveTo(bx + 2, by - 33);
      ctx.lineTo(bx + 18, by - 14);
      ctx.lineTo(bx + 2, by - 14);
      ctx.fill();
      // the spread, as a gap that widens when the water is low
      const gapW = lerp(40, 9, clamp(level / 3));
      const gx = w - 20 - gapW;
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(pal.ink3, 1);
      ctx.fillText("SPREAD, USUALLY", w - 14, 12);
      ctx.fillStyle = rgba(level < 1 ? ALERT : pal.emerald, 1);
      ctx.fillRect(gx, 22, gapW, 5);
    };
  }, [open]);
  return (
    <div>
      <Stage draw={draw} ratio={2.1} rev={hour} />
      <Slider label="Hour of the day" value={hour} min={0} max={23} onChange={setHour} text={`${String(hour).padStart(2, "0")}:00 UTC`} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        At {String(hour).padStart(2, "0")}:00 UTC, <strong className="num text-ink">{open}</strong> of the four FX windows {open === 1 ? "is" : "are"} open.{" "}
        {open >= 2 ? "High water: the fullest hours, when spreads on the major pairs are usually narrowest." : open === 1 ? "A middling tide." : "Low water: the quiet hours, when spreads usually widen."}
      </p>
      <Note>The windows are the conventional ones, shifted by each city’s offset today. “Usually” is a tendency: a release can widen spreads at high water too.</Note>
    </div>
  );
}
