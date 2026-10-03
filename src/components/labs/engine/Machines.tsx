"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";
import { ALERT, AMBER, Note, Slider, Stage } from "@/components/labs/kit";
import { seeded } from "@/components/labs/workshop/rng";
import { signalSound } from "@/components/sound/signal";

/**
 * THE ENGINE ROOM — six machines about what happens to a trade once it is on.
 *
 * Every figure in them is either arithmetic the visitor can check or an
 * example chosen to make the idea visible. None is a condition of any GIO4X
 * account, and each machine says so where it shows a number. Nothing is
 * stored. Each machine also states its point in a sentence under the canvas,
 * so nothing depends on seeing the drawing.
 */

/* ---------------------------------------------------------------------------
 * 1. THE MARGIN-CALL COUNTDOWN
 * An example account: 2,000 in it, one standard lot open at 1:100, so 1,000
 * is set aside as margin and each pip is worth 10. Move the price against the
 * position and the equity drains; the margin level (equity ÷ margin) falls
 * through an example warning, margin call and stop-out.
 * ------------------------------------------------------------------------- */

const BAL = 2000;
const MARGIN = 1000;
const PIP_VALUE = 10;
const LEVELS = [
  { at: 150, name: "WARNING" },
  { at: 100, name: "MARGIN CALL" },
  { at: 50, name: "STOP-OUT" },
] as const;

export function MarginCountdown() {
  const [pips, setPips] = useState(20);
  const equity = BAL - pips * PIP_VALUE;
  const level = (equity / MARGIN) * 100;
  const state = level <= 50 ? 3 : level <= 100 ? 2 : level <= 150 ? 1 : 0;
  const last = useRef(0);
  useEffect(() => {
    if (state > last.current) signalSound(state === 3 ? "knock" : "chime");
    last.current = state;
  }, [state]);

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 200 || h < 130) return;
        const pad = 16;
        const barY = h * 0.3;
        const barH = 26;
        const bw = w - pad * 2;
        const tone = state >= 3 ? ALERT : state === 2 ? ALERT : state === 1 ? AMBER : pal.emerald;
        ctx.textBaseline = "middle";

        // the account: what is in it, and the part set aside as margin
        ctx.fillStyle = rgba(pal.line, 1);
        ctx.fillRect(pad, barY, bw, barH);
        ctx.fillStyle = rgba(tone, 0.9);
        ctx.fillRect(pad, barY, bw * clamp(equity / BAL), barH);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = rgba(pal.ink, 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad + bw * (MARGIN / BAL), barY - 8);
        ctx.lineTo(pad + bw * (MARGIN / BAL), barY + barH + 8);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 10px ${pal.font}`;
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(pal.ink3, 1);
        ctx.fillText("EQUITY", pad, barY - 12);
        ctx.textAlign = "center";
        ctx.fillText("MARGIN IN USE", pad + bw * (MARGIN / BAL), barY + barH + 18);

        // the three lamps
        const ly = h * 0.74;
        LEVELS.forEach((l, i) => {
          const x = pad + (bw * (i + 0.5)) / 3;
          const on = level <= l.at;
          const pulse = on && !still ? (Math.sin(t * (i === 2 ? 9 : 5)) + 1) / 2 : 0;
          const c = i === 0 ? AMBER : ALERT;
          ctx.beginPath();
          ctx.arc(x, ly, 9 + pulse * 3, 0, TAU);
          ctx.fillStyle = on ? rgba(c, 0.6 + pulse * 0.4) : rgba(pal.line, 1);
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = rgba(on ? c : pal.ink3, 0.9);
          ctx.stroke();
          ctx.font = `600 10px ${pal.font}`;
          ctx.textAlign = "center";
          ctx.fillStyle = rgba(on ? pal.ink : pal.ink3, 1);
          ctx.fillText(l.name, x, ly + 22);
          ctx.font = `600 9px ${pal.font}`;
          ctx.fillStyle = rgba(pal.ink3, 0.95);
          ctx.fillText(`at ${l.at}%`, x, ly + 34);
        });
      },
    [equity, level, state],
  );

  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={pips} />
      <Slider label="Price moves against the position" value={pips} min={0} max={170} step={5} onChange={setPips} text={`${pips} pips`} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        Equity <strong className="num text-ink">{equity.toLocaleString("en-GB")}</strong>, margin level <strong className="num text-ink">{level.toFixed(0)}%</strong>.{" "}
        {state === 0 && "Comfortable: the equity is well above the margin in use."}
        {state === 1 && "A warning: the cushion above the margin is getting thin."}
        {state === 2 && "Margin call: equity has fallen to the margin in use. More funds, or a smaller position, are needed."}
        {state === 3 && "Stop-out: the platform begins closing positions, at the prices then available."}
      </p>
      <Note>An example account: 2,000 in it, one standard lot at 1:100 (1,000 of margin), 10 per pip. The three levels are examples; each account’s own are set by its conditions.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. THE SWAP CLOCK
 * A position held through the week. Each day at the rollover one night of
 * swap is charged or credited; on one day of the week three nights are
 * settled at once, to cover the weekend. That day is commonly Wednesday for
 * currency pairs.
 * ------------------------------------------------------------------------- */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const NIGHTS = [1, 1, 3, 1, 1] as const;

export function SwapClock() {
  const [day, setDay] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setDay((d) => {
        if (d >= 5) {
          setRunning(false);
          return d;
        }
        signalSound(NIGHTS[d] === 3 ? "knock" : "tick");
        return d + 1;
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [running]);
  const nights = NIGHTS.slice(0, day).reduce<number>((a, b) => a + b, 0);

  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 200 || h < 120) return;
        const pad = 18;
        const cw = (w - pad * 2) / 5;
        const base = h - 40;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        DAYS.forEach((name, i) => {
          const x = pad + cw * (i + 0.5);
          const settled = i < day;
          const next = i === day && running;
          ctx.font = `600 11px ${pal.font}`;
          ctx.fillStyle = rgba(settled || next ? pal.ink : pal.ink3, 1);
          ctx.fillText(name.toUpperCase(), x, base + 20);
          // the nights settled at that day's rollover, as coins in a stack
          for (let k = 0; k < NIGHTS[i]; k++) {
            const y = base - 10 - k * 15;
            ctx.beginPath();
            ctx.ellipse(x, y, Math.min(20, cw * 0.3), 6, 0, 0, TAU);
            ctx.fillStyle = settled ? rgba(NIGHTS[i] === 3 ? pal.gold : pal.accent, 0.9) : rgba(pal.line, 1);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = rgba(settled ? pal.ink2 : pal.ink3, 0.7);
            ctx.stroke();
          }
          if (next && !still) {
            // the clock hand coming round to the rollover
            const a = (t * 2.2) % TAU;
            ctx.beginPath();
            ctx.arc(x, 30, 13, 0, TAU);
            ctx.strokeStyle = rgba(pal.ink3, 0.9);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, 30);
            ctx.lineTo(x + Math.cos(a) * 10, 30 + Math.sin(a) * 10);
            ctx.strokeStyle = rgba(pal.accent, 1);
            ctx.lineWidth = 1.7;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.moveTo(pad, base);
        ctx.lineTo(w - pad, base);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.ink3, 0.8);
        ctx.stroke();
      },
    [day, running],
  );

  return (
    <div>
      <Stage draw={draw} ratio={2.1} rev={day * 2 + (running ? 1 : 0)} />
      <div className="mt-13 flex flex-wrap gap-13">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (day >= 5) setDay(0);
            setRunning(true);
          }}
          disabled={running}
        >
          {day >= 5 ? "Hold another week" : "Hold through the week"}
        </button>
      </div>
      <p className="mt-13 min-h-[3rem] text-ink-2" aria-live="polite">
        {day === 0 && !running && "One position, held from Monday. Each day’s rollover settles the swap for the night."}
        {(day > 0 || running) && (
          <>
            <strong className="num text-ink">{nights}</strong> {nights === 1 ? "night" : "nights"} of swap settled over <span className="num">{day}</span> {day === 1 ? "rollover" : "rollovers"}.
            {day >= 3 ? " One rollover settled three nights at once: that is how the weekend is paid for." : ""}
            {day >= 5 ? " Five rollovers, seven nights: the whole week." : ""}
          </>
        )}
      </p>
      <Note>The triple rollover is commonly on Wednesday for currency pairs; the day, and whether swap is charged or credited, depend on the instrument and the account.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. SLIPPAGE, IN SLOW MOTION
 * A stop under a quiet price. A release lands; the next price is already
 * below the stop, with nothing traded in between. The stop becomes an order
 * to sell at the next available price, and that is where it fills. The
 * distance between the two is the slippage. A frame at a time.
 * ------------------------------------------------------------------------- */

const SLIP = (() => {
  const r = seeded(3391);
  const out: number[] = [];
  let p = 0.62;
  for (let i = 0; i < 26; i++) {
    out.push(p);
    p += (r() - 0.5) * 0.02;
  }
  p = 0.3; // the release: the next price is here, with nothing in between
  for (let i = 0; i < 12; i++) {
    out.push(p);
    p += (r() - 0.5) * 0.03;
  }
  return out;
})();
const STOP_AT = 0.5;
const GAP_I = 26;

export function SlowSlip() {
  const [f, setF] = useState(18);
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, pal }) => {
        if (w < 200 || h < 120) return;
        const pad = 14;
        const x = (i: number) => lerp(pad, w - pad - 70, i / (SLIP.length - 1));
        const y = (v: number) => lerp(h - 16, 14, v);
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";

        // the stop
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = rgba(ALERT, 0.95);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad, y(STOP_AT));
        ctx.lineTo(w - pad, y(STOP_AT));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 10px ${pal.font}`;
        ctx.textAlign = "right";
        ctx.fillStyle = rgba(ALERT, 1);
        ctx.fillText("YOUR STOP", w - pad, y(STOP_AT) - 9);

        // the price, as far as this frame
        ctx.beginPath();
        for (let i = 0; i <= Math.min(f, GAP_I - 1); i++) {
          if (i === 0) ctx.moveTo(x(i), y(SLIP[i]));
          else ctx.lineTo(x(i), y(SLIP[i]));
        }
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = rgba(pal.accent, 1);
        ctx.stroke();
        if (f >= GAP_I) {
          // the gap: nothing traded between these two prices
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = rgba(pal.ink3, 0.9);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x(GAP_I - 1), y(SLIP[GAP_I - 1]));
          ctx.lineTo(x(GAP_I), y(SLIP[GAP_I]));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          for (let i = GAP_I; i <= f; i++) {
            if (i === GAP_I) ctx.moveTo(x(i), y(SLIP[i]));
            else ctx.lineTo(x(i), y(SLIP[i]));
          }
          ctx.lineWidth = 1.7;
          ctx.strokeStyle = rgba(pal.accent, 1);
          ctx.stroke();
          // the fill, and the distance it missed by
          const fx = x(GAP_I);
          ctx.beginPath();
          ctx.arc(fx, y(SLIP[GAP_I]), 5, 0, TAU);
          ctx.fillStyle = rgba(pal.gold, 1);
          ctx.fill();
          ctx.strokeStyle = rgba(pal.gold, 1);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(fx + 14, y(STOP_AT));
          ctx.lineTo(fx + 14, y(SLIP[GAP_I]));
          ctx.moveTo(fx + 9, y(STOP_AT));
          ctx.lineTo(fx + 19, y(STOP_AT));
          ctx.moveTo(fx + 9, y(SLIP[GAP_I]));
          ctx.lineTo(fx + 19, y(SLIP[GAP_I]));
          ctx.stroke();
          ctx.textAlign = "left";
          ctx.fillStyle = rgba(pal.gold, 1);
          ctx.fillText("SLIPPAGE", fx + 24, (y(STOP_AT) + y(SLIP[GAP_I])) / 2);
          ctx.fillStyle = rgba(pal.ink, 1);
          ctx.fillText("FILLED HERE", fx + 10, y(SLIP[GAP_I]) + 14);
        }
        const i = Math.min(f, SLIP.length - 1);
        ctx.beginPath();
        ctx.arc(x(i), y(SLIP[i]), 3.5, 0, TAU);
        ctx.fillStyle = rgba(pal.accent, 1);
        ctx.fill();
        if (f >= GAP_I - 2 && f <= GAP_I + 1) {
          ctx.textAlign = "left";
          ctx.fillStyle = rgba(pal.ink2, 1);
          ctx.fillText("THE RELEASE", x(GAP_I - 1) - 30, 12);
        }
      },
    [f],
  );
  return (
    <div>
      <Stage draw={draw} ratio={2} rev={f} />
      <Slider label="Frame" value={f} min={0} max={SLIP.length - 1} onChange={setF} text={`${f + 1} of ${SLIP.length}`} />
      <p className="mt-8 min-h-[3rem] text-ink-2" aria-live="polite">
        {f < GAP_I - 2 && "A quiet price, with a stop waiting below it."}
        {f >= GAP_I - 2 && f < GAP_I && "The release is a moment away. The stop is still below the price."}
        {f >= GAP_I && "The next price was already beyond the stop, with nothing traded in between. The stop became an order to sell at the next available price, and filled there. The difference is slippage."}
      </p>
      <Note>An invented price. A stop limits a loss in ordinary conditions; it does not guarantee the level.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. THE COMPOUNDING STAIRCASE
 * Lose a share of an account and the climb back is taller than the fall,
 * because it is measured on what is left: to recover a loss of L you need a
 * gain of L ÷ (1 − L). Arithmetic, nothing else.
 * ------------------------------------------------------------------------- */

export function Staircase() {
  const [loss, setLoss] = useState(50);
  const need = (loss / (100 - loss)) * 100;
  const draw = useMemo<FigureDraw>(
    () =>
      ({ ctx, w, h, t, pal, still }) => {
        if (w < 200 || h < 130) return;
        const pad = 18;
        const top = 26;
        const base = h - 26;
        const full = base - top;
        const left = pad + 30;
        const mid = w / 2;
        const right = w - pad - 30;
        const after = top + full * (loss / 100); // where the account stands after the loss
        const steps = 6;
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";

        // the way down
        ctx.beginPath();
        ctx.moveTo(pad, top);
        for (let i = 0; i < steps; i++) {
          const x0 = lerp(left, mid, i / steps);
          const x1 = lerp(left, mid, (i + 1) / steps);
          const y1 = lerp(top, after, (i + 1) / steps);
          ctx.lineTo(x0, lerp(top, after, i / steps));
          ctx.lineTo(x0, y1);
          ctx.lineTo(x1, y1);
        }
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = rgba(ALERT, 1);
        ctx.stroke();
        // the way back up: the same height, but each step is a bigger share of what is left
        ctx.beginPath();
        ctx.moveTo(mid, after);
        for (let i = 0; i < steps; i++) {
          const x1 = lerp(mid, right, (i + 1) / steps);
          ctx.lineTo(x1, lerp(after, top, i / steps));
          ctx.lineTo(x1, lerp(after, top, (i + 1) / steps));
        }
        ctx.lineTo(w - pad, top);
        ctx.strokeStyle = rgba(pal.emerald, 1);
        ctx.stroke();

        // the two heights, measured
        ctx.font = `600 11px ${pal.font}`;
        ctx.textAlign = "center";
        ctx.fillStyle = rgba(ALERT, 1);
        ctx.fillText(`DOWN ${loss}%`, (left + mid) / 2, base + 12);
        ctx.fillStyle = rgba(pal.emerald, 1);
        ctx.fillText(`UP ${need >= 100 ? need.toFixed(0) : need.toFixed(1)}% TO GET BACK`, (mid + right) / 2, base + 12);
        ctx.setLineDash([2, 5]);
        ctx.strokeStyle = rgba(pal.ink3, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, top);
        ctx.lineTo(w - pad, top);
        ctx.stroke();
        ctx.setLineDash([]);

        // a climber on the way back
        const u = still ? 0.5 : (t * 0.18) % 1;
        const cx = lerp(mid, right, u);
        const cy = lerp(after, top, Math.ceil(u * steps) / steps) - 9;
        ctx.beginPath();
        ctx.arc(cx, cy - 8, 4.5, 0, TAU);
        ctx.fillStyle = rgba(pal.accent, 1);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.accent, 1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 3);
        ctx.lineTo(cx, cy + 8);
        ctx.stroke();
      },
    [loss, need],
  );
  return (
    <div>
      <Stage draw={draw} ratio={1.9} rev={loss} />
      <Slider label="The loss" value={loss} min={5} max={90} step={5} onChange={setLoss} text={`${loss}%`} />
      <p className="mt-8 text-ink-2" aria-live="polite">
        Lose <strong className="num text-ink">{loss}%</strong> and it takes a gain of <strong className="num text-ink">{need >= 100 ? need.toFixed(0) : need.toFixed(1)}%</strong> to stand where you began, because the gain is earned on what is left.
        {loss >= 50 ? " Past a half, the way back is longer than the way down was." : ""}
      </p>
      <Note>Arithmetic: loss ÷ (100 − loss). It is why a loss kept small is worth more than a gain made large.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 5. THE CORRELATION DANCE
 * Two invented series. Set how closely they are tied: at +1 they move as
 * one, at 0 each ignores the other, at −1 one goes up as the other goes
 * down. Two positions in closely tied things are, in effect, one larger
 * position.
 * ------------------------------------------------------------------------- */

const STEPS_A = (() => {
  const r = seeded(808);
  return Array.from({ length: 60 }, () => r() - 0.5);
})();
const STEPS_N = (() => {
  const r = seeded(1717);
  return Array.from({ length: 60 }, () => r() - 0.5);
})();

export function Dance() {
  const [rho, setRho] = useState(80);
  const draw = useMemo<FigureDraw>(() => {
    const k = rho / 100;
    const a: number[] = [];
    const b: number[] = [];
    let pa = 0;
    let pb = 0;
    for (let i = 0; i < 60; i++) {
      pa += STEPS_A[i];
      pb += k * STEPS_A[i] + Math.sqrt(1 - k * k) * STEPS_N[i];
      a.push(pa);
      b.push(pb);
    }
    const span = Math.max(...a.map(Math.abs), ...b.map(Math.abs), 1);
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 120) return;
      const pad = 14;
      const x = (i: number) => lerp(pad, w - pad - 34, i / 59);
      const y = (v: number) => h / 2 - (v / span) * (h / 2 - 18);
      const at = still ? 59 : Math.floor((t * 9) % 75);
      const upto = Math.min(59, at);
      ctx.lineJoin = "round";
      const line = (s: number[], c: Colour) => {
        ctx.beginPath();
        for (let i = 0; i <= upto; i++) {
          if (i === 0) ctx.moveTo(x(i), y(s[i]));
          else ctx.lineTo(x(i), y(s[i]));
        }
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = rgba(c, 1);
        ctx.stroke();
        // the dancer at the head of the line
        const hx = x(upto);
        const hy = y(s[upto]);
        ctx.beginPath();
        ctx.arc(hx + 12, hy - 9, 4, 0, TAU);
        ctx.fillStyle = rgba(c, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx + 12, hy - 5);
        ctx.lineTo(hx + 12, hy + 6);
        ctx.moveTo(hx + 5, hy - 1);
        ctx.lineTo(hx + 19, hy - 1);
        ctx.strokeStyle = rgba(c, 1);
        ctx.lineWidth = 1.7;
        ctx.stroke();
      };
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = rgba(pal.ink3, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, h / 2);
      ctx.lineTo(w - pad, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      line(a, pal.accent);
      line(b, pal.gold);
    };
  }, [rho]);
  const k = rho / 100;
  return (
    <div>
      <Stage draw={draw} ratio={2} rev={rho} />
      <Slider label="How closely the two are tied" value={rho} min={-100} max={100} step={10} onChange={setRho} text={`${k > 0 ? "+" : ""}${k.toFixed(1)}`} />
      <p className="mt-8 min-h-[3rem] text-ink-2" aria-live="polite">
        {k >= 0.7 && "Nearly in step. A position in each is close to one position twice the size."}
        {k > 0.2 && k < 0.7 && "Loosely together: they often move the same way, but not reliably."}
        {k >= -0.2 && k <= 0.2 && "Each ignores the other. Knowing what one did says little about the other."}
        {k < -0.2 && k > -0.7 && "Loosely opposed: one tends to rise as the other falls."}
        {k <= -0.7 && "Nearly mirror images. Holding both the same way largely cancels out; holding them opposite ways doubles up."}
      </p>
      <Note>Two invented series. A correlation is measured over a past period and can change; it is not a rule.</Note>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 6. THE MARBLES
 * A hundred accounts each take fifty coin-flip trades, risking the same share
 * of what they hold each time, winning or losing that share with equal
 * chance. Count how many end below half of where they started. The coin is
 * the same for every setting: only the share risked changes.
 * ------------------------------------------------------------------------- */

const RISKS = [1, 2, 5, 10, 20] as const;
function runMarbles(risk: number): boolean[] {
  const r = seeded(424242);
  const out: boolean[] = [];
  for (let a = 0; a < 100; a++) {
    let eq = 1;
    let low = 1;
    for (let i = 0; i < 50; i++) {
      eq *= r() < 0.5 ? 1 + risk / 100 : 1 - risk / 100;
      low = Math.min(low, eq);
    }
    out.push(low < 0.5);
  }
  return out;
}

export function Marbles() {
  const [at, setAt] = useState(1);
  const risk = RISKS[at];
  const fate = useMemo(() => runMarbles(risk), [risk]);
  const halved = fate.filter(Boolean).length;
  const draw = useMemo<FigureDraw>(() => {
    let began: number | null = null;
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 130) return;
      if (began === null) began = t;
      const T = still ? 99 : t - began;
      const pad = 14;
      const binY = h - 44;
      const half = (w - pad * 2) / 2;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = `600 10px ${pal.font}`;
      ctx.fillStyle = rgba(pal.emerald, 1);
      ctx.fillText(`STILL ABOVE HALF: ${100 - halved}`, pad + half / 2, h - 12);
      ctx.fillStyle = rgba(ALERT, 1);
      ctx.fillText(`FELL BELOW HALF: ${halved}`, pad + half * 1.5, h - 12);
      ctx.strokeStyle = rgba(pal.ink3, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, binY + 14);
      ctx.lineTo(w - pad, binY + 14);
      ctx.moveTo(w / 2, 18);
      ctx.lineTo(w / 2, binY + 14);
      ctx.stroke();

      // each account is a marble: it falls from the top and settles in its bin
      let li = 0;
      let ri = 0;
      const cols = Math.max(8, Math.floor((half - 16) / 11));
      for (let a = 0; a < 100; a++) {
        const down = fate[a];
        const slot = down ? ri++ : li++;
        const tx = (down ? w / 2 + 10 : pad + 8) + (slot % cols) * 11 + 4;
        const ty = binY + 6 - Math.floor(slot / cols) * 11;
        const u = smooth((T - a * 0.018) / 0.7);
        if (u <= 0) continue;
        const sx = w / 2 + Math.sin(a * 12.9) * 30;
        ctx.beginPath();
        ctx.arc(lerp(sx, tx, u), lerp(8, ty, u * u), 4, 0, TAU);
        ctx.fillStyle = rgba(down ? ALERT : pal.emerald, 0.9);
        ctx.fill();
      }
    };
  }, [fate, halved]);
  return (
    <div>
      <Stage draw={draw} ratio={1.7} rev={at} />
      <div className="mt-13 flex flex-wrap items-center gap-8" role="group" aria-label="Share of the account risked on each trade">
        <span className="label mr-5">Risk per trade</span>
        {RISKS.map((r, i) => (
          <button key={r} type="button" className="btn btn-ghost" aria-pressed={i === at} onClick={() => setAt(i)}>
            {r}%
          </button>
        ))}
      </div>
      <p className="mt-13 text-ink-2" aria-live="polite">
        Risking <strong className="num text-ink">{risk}%</strong> a trade, <strong className="num text-ink">{halved}</strong> of 100 accounts fell below half of where they began at some point in fifty trades. The coin never changed: only the share risked.
      </p>
      <Note>A model: fifty fair coin flips, the same sequence for every setting. It shows how the share risked changes the range of outcomes, not what any strategy will do.</Note>
    </div>
  );
}
