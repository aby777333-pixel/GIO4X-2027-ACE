"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { TAU, clamp, lerp, rgba, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { Note, Slider, Stage } from "@/components/labs/kit";
import { centreNames, centresOpen, windowsOpen } from "@/components/labs/timetable";
import { seeded } from "@/components/labs/workshop/rng";
import { signalSound } from "@/components/sound/signal";

/**
 * THE SCREENING ROOM — six set pieces. Each is a picture of one idea, made to
 * be watched and handled. They are metaphors and say so: no price is shown,
 * nothing is forecast, and where a piece reads the timetable it reads the
 * same one the clocks use. Each states its point in words under the canvas.
 */

const PALE: Colour = [232, 240, 246, 1];

/* ---------------------------------------------------------------------------
 * 1. THE FLOOR AT NIGHT — a dark room of lit screens, each a way into one
 *    section of the site. The room turns a little with the pointer. Every
 *    screen is an ordinary link; on a phone they are simply a list.
 * ------------------------------------------------------------------------- */

const DOORS = [
  { name: "Markets", href: "/markets", note: "Six asset classes" },
  { name: "Trading", href: "/trading", note: "Accounts and conditions" },
  { name: "Platforms", href: "/platforms", note: "Raptor and MetaTrader 5" },
  { name: "Intelligence", href: "/intelligence", note: "Analysis and the blog" },
  { name: "Academy", href: "/academy", note: "Lessons and practice" },
  { name: "Labs", href: "/labs", note: "Experiments" },
] as const;

export function NightFloor() {
  const room = useRef<HTMLDivElement>(null);
  const turn = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || !room.current) return;
    const root = document.documentElement;
    if (root.dataset.motion === "reduced" || root.dataset.effects === "low") return;
    const r = e.currentTarget.getBoundingClientRect();
    room.current.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * -26).toFixed(1)}deg`);
    room.current.style.setProperty("--rx", `${(((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(1)}deg`);
  };
  return (
    <div>
      <div className="gx-floor on-night" onPointerMove={turn}>
        <div ref={room} className="gx-floor-room">
          <div className="gx-floor-grid" aria-hidden />
          {DOORS.map((d, i) => (
            <Link key={d.href} href={d.href} className="gx-floor-screen" style={{ ["--a" as string]: `${(i - 2.5) * 21}deg`, ["--i" as string]: i }}>
              <span className="gx-floor-trace" aria-hidden />
              <span className="gx-floor-name">{d.name}</span>
              <span className="gx-floor-note">{d.note}</span>
            </Link>
          ))}
        </div>
      </div>
      <Note>Six screens, six sections. Move the pointer to look round the room; each screen is a link.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. ORDER IN FLIGHT — the order's journey, seen from the order. Five gates
 *    come out of the dark and are passed in turn: the ticket, the checks, the
 *    routing, the fill, the position. General mechanics, as Trade Anatomy
 *    tells them: not a description of one broker.
 * ------------------------------------------------------------------------- */

const GATES = [
  { name: "TICKET", line: "The order leaves the ticket: instrument, side, size and stop." },
  { name: "CHECKS", line: "Checks: is there margin for it, and is the size allowed?" },
  { name: "ROUTING", line: "Routing: it goes to where it can be filled." },
  { name: "FILL", line: "The fill: it meets a price. That price is the entry." },
  { name: "POSITION", line: "A position: it is live now, and valued against every new price." },
] as const;

export function OrderFlight() {
  const [n, setN] = useState(0);
  const [at, setAt] = useState(-1);
  const shown = useRef(-1);
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 120) return;
      if (began === null) began = t;
      const flying = n > 0;
      const T = still ? (flying ? 99 : 0) : flying ? t - began : 0;
      const pos = flying ? Math.min(GATES.length + 0.4, T * 0.62) : 0; // gates passed so far
      const now = Math.min(GATES.length - 1, Math.floor(pos - 0.02));
      if (flying && now !== shown.current) {
        shown.current = now;
        setAt(now);
        if (now >= 0) signalSound(now === 3 ? "chime" : "tick");
      }
      const cx = w / 2;
      const cy = h / 2;
      // points of light streaming out from the centre, faster once in flight
      for (let s = 0; s < 80; s++) {
        const a = s * 2.399;
        const speed = flying ? 0.9 : 0.12;
        const z = 1 - (((still ? 0.3 : t * speed) + s * 0.137) % 1);
        const d = (1 - z) * Math.max(w, h) * 0.75;
        const len = (1 - z) * (flying ? 26 : 4);
        ctx.strokeStyle = rgba(s % 3 ? pal.accent : PALE, (1 - z) * 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        ctx.lineTo(cx + Math.cos(a) * (d + len), cy + Math.sin(a) * (d + len));
        ctx.stroke();
      }
      // the gates, far to near
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let g = GATES.length - 1; g >= 0; g--) {
        const z = g + 1 - pos; // distance to this gate, in gates
        if (z <= 0.04) continue;
        const k = 1 / z;
        const gw = Math.min(w * 0.36, 200) * k;
        const gh = gw * 0.6;
        if (gw > w * 3) continue;
        const a = clamp(1.3 - z * 0.25) * clamp(z * 6);
        ctx.lineWidth = Math.max(1, 2.2 * k);
        ctx.strokeStyle = rgba(g === 3 ? pal.gold : pal.accent, a);
        ctx.shadowColor = rgba(g === 3 ? pal.gold : pal.accent, 0.8);
        ctx.shadowBlur = 14 * Math.min(1, k);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - gw / 2, cy - gh / 2, gw, gh, 8 * k);
        else ctx.rect(cx - gw / 2, cy - gh / 2, gw, gh);
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (k < 3.2) {
          ctx.font = `700 ${Math.max(8, Math.min(40, 13 * k))}px ${pal.font}`;
          ctx.fillStyle = rgba(pal.ink, a);
          ctx.fillText(GATES[g].name, cx, cy - gh / 2 - 12 * k);
        }
      }
      if (!flying) {
        ctx.font = `500 13px ${pal.font}`;
        ctx.fillStyle = rgba(pal.ink3, 1);
        ctx.fillText("Five gates wait in the dark", cx, h - 16);
      }
    };
  }, [n]);
  return (
    <div>
      <Stage draw={draw} ratio={1.8} rev={n * 10 + at} />
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
          {n ? "Send another" : "Send the order"}
        </button>
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {at < 0 ? "Press the button and travel with the order." : `${String(at + 1).padStart(2, "0")}. ${GATES[at].line}`}
      </p>
      <Note>General mechanics, in the order they happen. Not a description of how any one broker handles an order.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. THE SPREAD CANYON — a walk between two walls, the bid on one side and
 *    the ask on the other. Its width at each hour follows how many FX windows
 *    are open then: narrow when the market is full, wide in the quiet hours.
 * ------------------------------------------------------------------------- */

export function Canyon() {
  const [hour, setHour] = useState(13);
  const [open, setOpen] = useState(2);
  useEffect(() => setOpen(windowsOpen(hour)), [hour]);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 200 || h < 120) return;
        const vx = w / 2 + (still ? 0 : Math.sin(t * 0.4) * 6);
        const horizon = h * 0.42;
        const f = h * 0.9;
        const half = (hr: number) => lerp(2.6, 0.5, clamp(windowsOpen(((hr % 24) + 24) % 24) / 3));
        const slices = 18;
        const pt = (side: number, i: number, y: number): [number, number] => {
          const z = 1 + i * 0.75;
          return [vx + (side * half(hour + i) * f) / z, horizon + (y * f) / z];
        };
        for (const side of [-1, 1]) {
          for (let i = slices - 1; i >= 0; i--) {
            const [x0, yb0] = pt(side, i, 0.62);
            const [x1, yb1] = pt(side, i + 1, 0.62);
            const [, yt0] = pt(side, i, -0.9);
            const [, yt1] = pt(side, i + 1, -0.9);
            const tone = side < 0 ? pal.accent : pal.gold;
            ctx.beginPath();
            ctx.moveTo(x0, yb0);
            ctx.lineTo(x1, yb1);
            ctx.lineTo(x1, yt1);
            ctx.lineTo(x0, yt0);
            ctx.closePath();
            ctx.fillStyle = rgba(tone, 0.07 + (0.2 * (slices - i)) / slices);
            ctx.fill();
            ctx.strokeStyle = rgba(tone, 0.5 * (1 - i / slices) + 0.1);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        // the floor between them: one mark for each hour ahead
        for (let i = 0; i < slices; i++) {
          const [xl, y0] = pt(-1, i, 0.62);
          const [xr] = pt(1, i, 0.62);
          ctx.strokeStyle = rgba(pal.ink3, 0.5 * (1 - i / slices));
          ctx.beginPath();
          ctx.moveTo(xl, y0);
          ctx.lineTo(xr, y0);
          ctx.stroke();
        }
        ctx.font = `700 11px ${pal.font}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(pal.accent, 1);
        ctx.fillText("BID", 12, h - 14);
        ctx.textAlign = "right";
        ctx.fillStyle = rgba(pal.gold, 1);
        ctx.fillText("ASK", w - 12, h - 14);
      },
    [hour],
  );
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={hour} />
      <Slider label="You are standing at" value={hour} min={0} max={23} onChange={setHour} text={`${String(hour).padStart(2, "0")}:00 UTC`} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        {open >= 2 ? "A narrow pass: the market is full and the two prices stand close." : open === 1 ? "The walls are drawing apart: one window open." : "A wide canyon: the quiet hours, when the spread usually opens out."} The walls ahead are the hours to come.
      </p>
      <Note>The width follows how many of the four FX windows are open, on a weekday. It is a tendency: a release can widen a spread at the busiest hour too.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. THE STORM CHART — volatility as weather. A boat rides the sea and leaves
 *    its path behind it: that path is the chart. Calm water draws a smooth
 *    line; a storm draws a jagged one; a release strikes like lightning and
 *    the path jumps, with nothing drawn between.
 * ------------------------------------------------------------------------- */

const SEAS = ["Calm", "Choppy", "Storm"] as const;

export function Storm() {
  const [sea, setSea] = useState(0);
  const [strike, setStrike] = useState(0);
  const draw = useMemo<FigureDraw>(() => {
    const trail: number[] = [];
    let amp = 6;
    let jump = 0;
    let struck = -9;
    let lastStrike = strike;
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 120) return;
      const time = still ? 4 : t;
      const want = [5, 15, 32][sea];
      amp = still ? want : amp + (want - amp) * (1 - Math.exp(-dt * 2));
      if (strike !== lastStrike) {
        lastStrike = strike;
        struck = time;
        jump += (strike % 2 ? 1 : -1) * 34;
        trail.push(NaN); // the gap: nothing is drawn across it
      }
      const base = h * 0.6;
      const wave = (x: number, layer: number) =>
        Math.sin(x * 0.02 + time * (1.2 + layer * 0.3) + layer) * amp + Math.sin(x * 0.047 - time * 1.9) * amp * 0.45 + Math.sin(x * 0.11 + time * 3.1) * amp * 0.18 * sea;
      const bx = w * 0.62;
      const by = base + wave(bx, 0) - jump * 0;
      const mark = base - 60 + wave(bx, 0) * 1.4 + jump;
      if (!still) {
        trail.push(mark);
        if (trail.length > 220) trail.shift();
      }
      const flash = Math.max(0, 1 - (time - struck) * 2.2);
      if (flash > 0) {
        ctx.fillStyle = rgba(PALE, flash * 0.35);
        ctx.fillRect(0, 0, w, h);
        // the bolt
        const r = seeded(strike * 31 + 7);
        ctx.beginPath();
        let lx = w * 0.3 + r() * w * 0.4;
        let ly = 0;
        ctx.moveTo(lx, ly);
        while (ly < base - 20) {
          lx += (r() - 0.5) * 46;
          ly += 14 + r() * 22;
          ctx.lineTo(lx, ly);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(PALE, flash);
        ctx.stroke();
      }
      // rain, in a storm
      if (sea === 2 && !still) {
        ctx.strokeStyle = rgba(pal.ink3, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const rx = (i * 97 + time * 380) % (w + 40);
          const ry = (i * 53 + time * 520) % h;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 6, ry + 14);
        }
        ctx.stroke();
      }
      // the path the boat has left: the chart
      ctx.beginPath();
      let pen = false;
      trail.forEach((v, i) => {
        const x = bx - (trail.length - 1 - i) * 2.2;
        if (Number.isNaN(v)) {
          pen = false;
          return;
        }
        if (!pen) ctx.moveTo(x, v);
        else ctx.lineTo(x, v);
        pen = true;
      });
      ctx.lineWidth = 1.7;
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(pal.gold, 0.95);
      ctx.stroke();
      // the sea, three layers deep
      for (let layer = 2; layer >= 0; layer--) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + layer * 10 + wave(x, layer));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = rgba(pal.accent, 0.12 + layer * 0.06);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.accent, 0.8 - layer * 0.22);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // the boat
      const slope = (wave(bx + 6, 0) - wave(bx - 6, 0)) / 12;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan(slope));
      ctx.fillStyle = rgba(pal.ink, 0.95);
      ctx.beginPath();
      ctx.moveTo(-20, -8);
      ctx.lineTo(20, -8);
      ctx.lineTo(13, 1);
      ctx.lineTo(-13, 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink, 0.95);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -30);
      ctx.stroke();
      ctx.fillStyle = rgba(PALE, 0.95);
      ctx.beginPath();
      ctx.moveTo(2, -29);
      ctx.lineTo(15, -12);
      ctx.lineTo(2, -12);
      ctx.fill();
      ctx.restore();
    };
  }, [sea, strike]);
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={sea * 100 + strike} />
      <div className="mt-13 flex flex-wrap items-center gap-8" role="group" aria-label="The weather">
        {SEAS.map((s, i) => (
          <button key={s} type="button" className="btn btn-ghost" aria-pressed={sea === i} onClick={() => setSea(i)}>
            {s}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setStrike((v) => v + 1);
            signalSound("knock");
          }}
        >
          A release lands
        </button>
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        {sea === 0 && "Calm: the path behind the boat is smooth. Low volatility."}
        {sea === 1 && "Choppy: the same boat, a rougher line. The swings are larger, in both directions."}
        {sea === 2 && "A storm: the line is jagged and wide. High volatility is not a direction; it is the size of the swings."}
        {strike > 0 ? " Where the lightning struck, the path jumped and nothing is drawn between: a gap." : ""}
      </p>
      <Note>A picture of volatility and of a gap. The line is the boat’s path, not a price.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 5. GRAVITY WELLS — a way of picturing support and resistance. A comet runs
 *    between a floor and a ceiling and is turned back as it nears each. Push
 *    it harder and sooner or later it goes through, and the level it broke
 *    changes role: the old ceiling becomes the new floor. An idea from
 *    technical analysis, drawn; not a law of markets.
 * ------------------------------------------------------------------------- */

export function Gravity() {
  const [push, setPush] = useState(3);
  const [breaks, setBreaks] = useState(0);
  const count = useRef(0);
  const draw = useMemo<FigureDraw>(() => {
    const r = seeded(9090);
    let y = 0.5; // 0 floor, 1 ceiling, within the range
    let v = 0;
    let shift = 0; // how many ranges the pair of levels has moved (eased)
    let target = 0;
    let flash = -9;
    const trail: number[] = [];
    return ({ ctx, w, h, t, dt, pal, still }) => {
      if (w < 200 || h < 120) return;
      const steps = still ? 0 : Math.max(1, Math.round(dt / 0.016));
      for (let s = 0; s < steps; s++) {
        v += (r() - 0.5) * 0.004 * push;
        // each level pushes back, harder the nearer the comet is
        v -= Math.pow(clamp(y - 0.72) / 0.28, 2) * 0.0045;
        v += Math.pow(clamp(0.28 - y) / 0.28, 2) * 0.0045;
        v *= 0.985;
        y += v;
        if (y > 1.06) {
          y -= 1;
          target += 1;
          flash = t;
          count.current += 1;
          setBreaks(count.current);
        } else if (y < -0.06) {
          y += 1;
          target -= 1;
          flash = t;
          count.current += 1;
          setBreaks(count.current);
        }
        trail.push(y + target);
        if (trail.length > 260) trail.shift();
      }
      shift = still ? target : shift + (target - shift) * (1 - Math.exp(-dt * 3));
      const range = h * 0.44;
      const mid = h / 2;
      const Y = (abs: number) => mid - (abs - shift - 0.5) * range;
      ctx.textBaseline = "middle";
      const lit = Math.max(0, 1 - (t - flash) * 1.2);
      for (const [abs, name] of [[shift + 1 - (shift - Math.round(shift)), "CEILING"], [shift - (shift - Math.round(shift)), "FLOOR"]] as const) {
        const ly = Y(abs);
        const g = ctx.createLinearGradient(0, ly - 26, 0, ly + 26);
        const tone = name === "CEILING" ? pal.gold : pal.accent;
        g.addColorStop(0, rgba(tone, 0));
        g.addColorStop(0.5, rgba(tone, 0.22 + lit * 0.3));
        g.addColorStop(1, rgba(tone, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, ly - 26, w, 52);
        ctx.strokeStyle = rgba(tone, 0.95);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
        ctx.font = `700 10px ${pal.font}`;
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(tone, 1);
        ctx.fillText(name, 10, ly - 10);
      }
      // the comet and its tail
      const hx = w * 0.72;
      ctx.beginPath();
      trail.forEach((p, i) => {
        const x = hx - (trail.length - 1 - i) * 2;
        if (i === 0) ctx.moveTo(x, Y(p));
        else ctx.lineTo(x, Y(p));
      });
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(PALE, 0.75);
      ctx.stroke();
      const cy = Y(y + target);
      const halo = ctx.createRadialGradient(hx, cy, 0, hx, cy, 22);
      halo.addColorStop(0, rgba(PALE, 0.9));
      halo.addColorStop(1, rgba(PALE, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(hx - 22, cy - 22, 44, 44);
      ctx.beginPath();
      ctx.arc(hx, cy, 4, 0, TAU);
      ctx.fillStyle = rgba(PALE, 1);
      ctx.fill();
      if (lit > 0) {
        ctx.font = `700 12px ${pal.font}`;
        ctx.textAlign = "center";
        ctx.fillStyle = rgba(PALE, lit);
        ctx.fillText("BROKEN THROUGH", w / 2, 16);
      }
    };
  }, [push]);
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={push} />
      <Slider label="How hard it is pushed" value={push} min={1} max={8} onChange={setPush} text={push <= 2 ? "gently" : push <= 5 ? "firmly" : "hard"} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        {breaks === 0 ? "The comet is turned back as it nears each level. Push harder and wait." : `Broken through ${breaks} ${breaks === 1 ? "time" : "times"}. Each time the level it broke changed role: the old ceiling became the new floor, or the old floor the new ceiling.`}
      </p>
      <Note>Support and resistance, pictured. An idea from technical analysis about where orders have gathered before; it is not a law, and a level can give way at any time.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 6. THE CITY, IN TIME-LAPSE — nine towers, one for each financial centre.
 *    A tower's windows are lit while its exchange is in its regular session,
 *    read from the timetable. Run the day and watch the light cross the row.
 * ------------------------------------------------------------------------- */

export function City() {
  const [hour, setHour] = useState(8);
  const [playing, setPlaying] = useState(false);
  const [lit, setLit] = useState<boolean[]>([]);
  useEffect(() => setLit(centresOpen(hour)), [hour]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((v) => (v + 1) % 24), 650);
    return () => window.clearInterval(id);
  }, [playing]);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 200 || h < 130) return;
        const n = centreNames.length;
        const pad = 10;
        const bw = (w - pad * 2) / n;
        const ground = h - 30;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let s = 0; s < 34; s++) {
          ctx.fillStyle = rgba(PALE, 0.25 + 0.3 * ((Math.sin(t * 1.1 + s) + 1) / 2));
          ctx.fillRect((s * 131) % w, (s * 47) % (ground * 0.55), 1.3, 1.3);
        }
        centreNames.forEach((name, i) => {
          const on = lit[i];
          const tall = ground * (0.42 + ((i * 37) % 31) / 78);
          const x = pad + i * bw + bw * 0.14;
          const tw = bw * 0.72;
          ctx.fillStyle = rgba(pal.ink, 0.16);
          ctx.fillRect(x, ground - tall, tw, tall);
          ctx.strokeStyle = rgba(on ? pal.gold : pal.ink3, on ? 0.95 : 0.6);
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, ground - tall + 0.5, tw - 1, tall - 1);
          const cols = Math.max(2, Math.floor(tw / 9));
          const rows = Math.floor(tall / 11);
          for (let ry = 0; ry < rows; ry++) {
            for (let c = 0; c < cols; c++) {
              // most windows are lit while the session is open; a few stay dark, and a few stay on all night
              const seed = (i * 7 + ry * 13 + c * 29) % 10;
              const lights = on ? seed < 8 : seed < 1;
              const flicker = still ? 1 : 0.8 + 0.2 * Math.sin(t * 2 + seed * 3 + ry);
              ctx.fillStyle = lights ? rgba(pal.gold, 0.85 * flicker) : rgba(pal.ink3, 0.18);
              ctx.fillRect(x + 4 + (c * (tw - 8)) / cols, ground - tall + 5 + ry * 11, Math.max(2, (tw - 8) / cols - 3), 5);
            }
          }
          ctx.font = `${on ? 700 : 500} ${bw < 46 ? 7.5 : 9}px ${pal.font}`;
          ctx.fillStyle = rgba(on ? pal.ink : pal.ink3, 1);
          const words = name.toUpperCase().split(" ");
          words.forEach((word, k) => ctx.fillText(word, x + tw / 2, ground + 9 + k * 9));
        });
        ctx.strokeStyle = rgba(pal.ink3, 0.8);
        ctx.beginPath();
        ctx.moveTo(0, ground + 0.5);
        ctx.lineTo(w, ground + 0.5);
        ctx.stroke();
      },
    [lit],
  );
  const openNames = centreNames.filter((_, i) => lit[i]);
  return (
    <div>
      <div className="on-night rounded-[8px] bg-night p-0">
        <Stage draw={draw} ratio={2} rev={hour} />
      </div>
      <Slider label="Hour of the day" value={hour} min={0} max={23} onChange={setHour} text={`${String(hour).padStart(2, "0")}:00 UTC`} />
      <div className="mt-8 flex flex-wrap gap-13">
        <button type="button" className="btn btn-ghost" aria-pressed={playing} onClick={() => setPlaying((v) => !v)}>
          {playing ? "Stop the day" : "Run the day"}
        </button>
      </div>
      <p className="mt-13 text-ink-2" aria-live={playing ? "off" : "polite"}>
        At {String(hour).padStart(2, "0")}:00 UTC, {openNames.length === 0 ? "none of the nine exchanges is in its regular session" : `${openNames.join(", ")} ${openNames.length === 1 ? "is" : "are"} in regular session`}.
      </p>
      <Note>Regular weekday hours of each centre’s exchange, shifted by its city’s offset today. Weekends, holidays and early closes are not known to it.</Note>
    </div>
  );
}
