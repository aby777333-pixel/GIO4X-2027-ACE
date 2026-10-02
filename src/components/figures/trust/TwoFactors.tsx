"use client";

import { Figure, TAU, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * Two factors, for "Seven habits that do most of the work." on the online
 * security page.
 *
 * An account at the centre of two rings, each with one opening. A line comes
 * in from the left. When the outer ring (the password) turns its opening to
 * the line, the line gets through it and is stopped at the inner ring (the
 * second factor). Only when that turns as well does the line reach the centre.
 *
 * Pointer: the outer ring stays open and the inner ring's opening follows the
 * pointer round. Bring it to the left, onto the line, and the centre lights;
 * take it away and the line is stopped again.
 */

const CYCLE = 12;
const GAP = 0.3;
/** how far the line has reached, kept between frames */
const reach = new WeakMap<CanvasRenderingContext2D, { tip: number }>();

/** the signed angle from the incoming line (which arrives from the left) to a ring's opening */
const off = (a: number) => {
  let d = (a - Math.PI) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const cx = Math.round(w * 0.4);
  const cy = h / 2;
  const r2 = Math.min(h / 2 - 16, cx - 34);
  const r1 = r2 * 0.6;
  const core = 9;
  const u = (f.t % CYCLE) / CYCLE;

  // the outer ring turns to the line and holds; the inner one follows later; both turn away at the end
  const away = f.still ? 0 : smooth((u - 0.86) / 0.14);
  const open2 = f.still ? 1 : Math.max(f.hover, smooth((u - 0.06) / 0.2) * (1 - away));
  const open1 = f.still ? 0 : smooth((u - 0.5) / 0.16) * (1 - away);
  const a2 = Math.PI + (1 - open2) * 1.9;
  const autoA1 = Math.PI - (1 - open1) * 2.3 + (f.still ? 0 : 0.12 * Math.sin(f.t * 0.7) * (1 - open1));
  // towards the pointer, the short way round
  const want = Math.atan2(f.my - cy, f.mx - cx);
  const a1 = autoA1 + off(want - autoA1 + Math.PI) * f.hover;

  const through2 = Math.abs(off(a2)) < GAP * 0.55;
  const through1 = Math.abs(off(a1)) < GAP * 0.55;
  const target = !through2 ? r2 + 4 : !through1 ? r1 + 4 : core;
  let s = reach.get(ctx);
  if (!s) {
    s = { tip: r2 + 4 };
    reach.set(ctx, s);
  }
  if (f.still) s.tip = target;
  else s.tip += (target - s.tip) * (1 - Math.exp(-f.dt * (target > s.tip ? 14 : 5)));
  const lit = smooth(1 - (s.tip - core) / (r1 * 0.3));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the two rings, each with its opening
  const ring = (r: number, a: number, passed: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a + GAP, a + TAU - GAP);
    ctx.strokeStyle = rgba(pal.ink, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (passed > 0.004) {
      ctx.strokeStyle = rgba(pal.accent, 0.85 * passed);
      ctx.stroke();
    }
    // the lips of the opening
    for (const e of [a - GAP, a + GAP]) {
      ctx.beginPath();
      ctx.moveTo(cx + (r - 5) * Math.cos(e), cy + (r - 5) * Math.sin(e));
      ctx.lineTo(cx + (r + 5) * Math.cos(e), cy + (r + 5) * Math.sin(e));
      ctx.strokeStyle = rgba(pal.ink, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  ring(r2, a2, smooth((r2 - s.tip) / 8));
  ring(r1, a1, smooth((r1 - s.tip) / 8));

  // a faint track between the rings, for depth
  ctx.beginPath();
  ctx.arc(cx, cy, (r1 + r2) / 2, 0, TAU);
  ctx.strokeStyle = rgba(pal.line, 1);
  ctx.lineWidth = 1;
  ctx.stroke();

  // the line coming in, and where it has been stopped
  const from = cx - r2 - 26;
  ctx.beginPath();
  ctx.moveTo(from, cy);
  ctx.lineTo(cx - s.tip, cy);
  ctx.strokeStyle = rgba(pal.accent, 0.95);
  ctx.lineWidth = 2;
  ctx.stroke();
  if (s.tip > core + 2) {
    ctx.beginPath();
    ctx.moveTo(cx - s.tip, cy - 6);
    ctx.lineTo(cx - s.tip, cy + 6);
    ctx.stroke();
  }

  // the account
  ctx.beginPath();
  ctx.arc(cx, cy, core + 7 * lit, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 0.2 * lit);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, core, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.fillStyle = rgba(pal.gold, lerp(0.14, 1, lit));
  ctx.fill();
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the names of the two rings, on leaders to the right
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const lx = cx + r2 + 16;
  const name = (r: number, y: number, label: string) => {
    const dy = y - cy;
    const x = cx + Math.sqrt(Math.max(0, r * r - dy * dy));
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(lx + 6, y);
    ctx.strokeStyle = rgba(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, TAU);
    ctx.fillStyle = rgba(pal.ink3, 1);
    ctx.fill();
    ctx.fillStyle = rgba(pal.ink2, 1);
    ctx.fillText(label, lx + 12, y + 0.5);
  };
  name(r2, cy - r2 * 0.46, "PASSWORD");
  name(r1, cy + r1 * 0.14, "SECOND FACTOR");
};

export function TwoFactors() {
  return <Figure draw={draw} />;
}
