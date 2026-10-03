"use client";

import { useId, useMemo, useState } from "react";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "@/components/figures/Figure";

/**
 * LEVERAGE ON A TIGHTROPE — what leverage changes, and what it does not.
 *
 * A walker crosses a wire that sways. The sway is the market, and it is the
 * same whatever the leverage: leverage does not make a market move more. What
 * leverage changes is how close the line is at which the margin for the
 * position is gone. At 1:1 that line is far below. Raise the leverage and it
 * rises to meet the wire, the wire thins and the wind gets up; soon the
 * ordinary sway crosses the line.
 *
 * The one figure shown is arithmetic, not a condition of any account: a move
 * of (100 ÷ leverage) per cent against a position equals the margin for it.
 */

const STEPS = [1, 2, 5, 10, 20, 30, 50, 100, 200, 300, 400, 500] as const;
const ALERT: Colour = [214, 96, 88, 1];
const pct = (lev: number) => {
  const v = 100 / lev;
  return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
};

export function Tightrope() {
  const id = useId();
  const [i, setI] = useState(7);
  const lev = STEPS[i];

  const draw = useMemo<FigureDraw>(() => {
    const n = Math.log(lev) / Math.log(500); // 0 at 1:1, 1 at 1:500
    return ({ ctx, w, h, t, pal, still }) => {
      if (w < 200 || h < 140) return;
      const time = still ? 1.2 : t;
      const x0 = 34;
      const x1 = w - 34;
      const wireY = h * 0.4;
      const SWAY = 15; // the market's ordinary movement: the same at every leverage
      const room = lerp(h * 0.46, 5, Math.pow(n, 0.8)); // how far below the wire the margin is gone
      const lineY = wireY + room;
      const wire = (x: number) => {
        const u = (x - x0) / (x1 - x0);
        return wireY + 4 * u * (1 - u) * (6 + Math.sin(u * TAU * 1.5 + time * 2.3) * SWAY * 0.55 + Math.sin(time * 1.1) * SWAY * 0.45);
      };

      ctx.lineCap = "round";
      ctx.textBaseline = "middle";

      // the wind gets up with the leverage
      const gusts = Math.round(n * 16);
      for (let g = 0; g < gusts; g++) {
        const gy = 18 + ((g * 53) % Math.max(20, h - 60));
        const gx = ((time * (120 + (g % 5) * 40) + g * 97) % (w + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 26 + (g % 3) * 14, gy);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(pal.ink3, 0.16 + n * 0.3);
        ctx.stroke();
      }

      // where the margin is gone
      ctx.fillStyle = rgba(ALERT, 0.07 + n * 0.08);
      ctx.fillRect(0, lineY, w, h - lineY);
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(w, lineY);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(ALERT, 0.95);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 10px ${pal.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(ALERT, 1);
      ctx.fillText(`MARGIN GONE: ${pct(lev)}% AGAINST`, 10, Math.min(h - 10, lineY + 12));

      // the posts and the wire, thinner as the leverage rises
      ctx.strokeStyle = rgba(pal.ink2, 1);
      ctx.lineWidth = 4;
      for (const px of [x0, x1]) {
        ctx.beginPath();
        ctx.moveTo(px, wireY - 34);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 6) {
        if (x === x0) ctx.moveTo(x, wire(x));
        else ctx.lineTo(x, wire(x));
      }
      ctx.lineWidth = lerp(4.5, 0.7, n);
      ctx.strokeStyle = rgba(pal.ink, 0.95);
      ctx.stroke();

      // the walker
      const wx = lerp(x0, x1, 0.5 + 0.3 * Math.sin(time * 0.22));
      const wy = wire(wx);
      const crossed = wy > lineY;
      const lean = Math.sin(time * 2.1) * (0.05 + n * 0.3) + Math.sin(time * 5.3) * n * 0.12;
      const tone = crossed ? ALERT : pal.accent;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(lean);
      ctx.strokeStyle = rgba(tone, 1);
      ctx.lineWidth = 2.4;
      const stride = Math.sin(time * 3) * 5;
      ctx.beginPath();
      ctx.moveTo(-stride, 0);
      ctx.lineTo(0, -18);
      ctx.lineTo(stride, 0);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -40);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -47, 6, 0, TAU);
      ctx.fillStyle = rgba(tone, 1);
      ctx.fill();
      // the balancing pole tips against the lean
      ctx.rotate(-lean * 1.8);
      ctx.beginPath();
      ctx.moveTo(-44, -30);
      ctx.lineTo(44, -30);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(pal.gold, 1);
      ctx.stroke();
      ctx.restore();
      if (crossed) {
        const pulse = (Math.sin(time * 9) + 1) / 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 12 + pulse * 10, 0, TAU);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = rgba(ALERT, 1 - pulse);
        ctx.stroke();
      }

      ctx.font = `600 10px ${pal.font}`;
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(pal.ink3, 0.95);
      ctx.fillText("THE SWAY IS THE MARKET: IT DOES NOT CHANGE", w - 10, 14);
      // how much of the room the ordinary sway uses up
      const used = clamp(SWAY / room);
      ctx.fillStyle = rgba(pal.line, 1);
      ctx.fillRect(w - 110, 26, 100, 4);
      ctx.fillStyle = rgba(used >= 1 ? ALERT : pal.accent, 1);
      ctx.fillRect(w - 110, 26, 100 * smooth(used), 4);
    };
  }, [lev]);

  return (
    <div>
      <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
        <Figure draw={draw} ratio={1.7} rev={i} />
      </div>
      <div className="mt-13 grid gap-8">
        <label htmlFor={id} className="label">
          Leverage: <span className="num text-ink">1:{lev}</span>
        </label>
        <input id={id} type="range" min={0} max={STEPS.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-valuetext={`1 to ${lev}`} />
        <p className="text-ink-2" aria-live="polite">
          At 1:{lev}, a move of <strong className="num text-ink">{pct(lev)}%</strong> against a position equals the whole margin for it.
          {lev >= 100 ? " A major pair can move that far in an ordinary day." : lev >= 20 ? " There is less room than it looks." : " The line is a long way off."}
        </p>
        <p className="text-xs text-ink-3">Arithmetic only: 100 ÷ leverage. It is not the stop-out level of any account, which is set by the account’s own conditions.</p>
      </div>
    </div>
  );
}
