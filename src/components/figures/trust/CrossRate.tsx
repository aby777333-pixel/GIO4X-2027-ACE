"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * How a cross rate is derived, for the "Calculations" chapter of the data
 * methodology page.
 *
 * A triangle: the euro at the top, the two currencies of a pair below. The
 * two sides down from the euro are published, and are drawn solid. The base
 * is the pair itself: it is not published, so it is drawn only after a pulse
 * has come down both sides, growing from each end to the division sign in
 * the middle. No value is shown anywhere.
 *
 * Pointer: the derived side stays drawn, and the corner nearest the pointer
 * is ringed.
 */

const CYCLE = 7;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const ex = w / 2;
  const ey = 34;
  const by = h - 62;
  const bx = Math.max(46, w * 0.17);
  const qx = w - bx;

  const u = (f.t % CYCLE) / CYCLE;
  // a pulse down each side, then the base grows, holds, and lets go
  const down = f.still ? 1 : smooth(u / 0.3);
  const grown = Math.max(f.hover, f.still ? 1 : smooth((u - 0.3) / 0.22) * (1 - smooth((u - 0.86) / 0.14)));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";

  // the two published sides
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(ex, ey);
  ctx.lineTo(qx, by);
  ctx.strokeStyle = rgba(pal.ink, 0.5);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // the base, before it is derived: a faint dotted line
  ctx.beginPath();
  ctx.setLineDash([2, 5]);
  ctx.moveTo(bx, by);
  ctx.lineTo(qx, by);
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // the pulses
  if (!f.still && u < 0.34) {
    const a = Math.sin(Math.PI * clamp(u / 0.34));
    for (const tx of [bx, qx]) {
      ctx.beginPath();
      ctx.arc(lerp(ex, tx, down), lerp(ey, by, down), 3.5, 0, TAU);
      ctx.fillStyle = rgba(pal.accent, a);
      ctx.fill();
    }
  }

  // the base, derived: it grows from both ends to the middle
  const mid = (bx + qx) / 2;
  if (grown > 0.004) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(lerp(bx, mid - 13, grown), by);
    ctx.moveTo(qx, by);
    ctx.lineTo(lerp(qx, mid + 13, grown), by);
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // the division, on the base
  ctx.beginPath();
  ctx.arc(mid, by, 11, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (grown > 0.004) {
    ctx.strokeStyle = rgba(pal.accent, grown);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.font = `500 15px ${pal.font}`;
  ctx.fillStyle = rgba(pal.ink2, 1);
  ctx.fillText("÷", mid, by + 0.5);

  // the corners
  ctx.font = `600 10px ${pal.font}`;
  const corner = (x: number, y: number, label: string, lx: number, ly: number, align: CanvasTextAlign, lead: boolean) => {
    const near = f.hover * smooth(1 - Math.hypot(f.mx - x, f.my - y) / (w * 0.3));
    if (near > 0.004) {
      ctx.beginPath();
      ctx.arc(x, y, 6 + 6 * near, 0, TAU);
      ctx.strokeStyle = rgba(pal.accent, near);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.strokeStyle = rgba(lead ? pal.gold : pal.ink, lead ? 1 : 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = align;
    ctx.fillStyle = rgba(pal.ink, 0.92);
    ctx.fillText(label, lx, ly);
  };
  corner(ex, ey, "EUR", ex, ey - 17, "center", true);
  corner(bx, by, "BASE", bx, by + 19, "center", false);
  corner(qx, by, "QUOTE", qx, by + 19, "center", false);

  // what each side is, in the section's own words
  ctx.fillStyle = rgba(pal.ink3, 1);
  const slope = Math.atan2(by - ey, ex - bx);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(lerp(ex, side < 0 ? bx : qx, 0.5), lerp(ey, by, 0.5));
    ctx.rotate(side < 0 ? -slope : slope);
    ctx.textAlign = "center";
    ctx.fillText("PUBLISHED", 0, -10);
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = rgba(pal.ink3, 1 - grown);
  ctx.fillText("DERIVED", mid, by + 26);
  if (grown > 0.004) {
    ctx.fillStyle = rgba(pal.accent, grown);
    ctx.fillText("DERIVED", mid, by + 26);
  }
};

export function CrossRate() {
  return <Figure draw={draw} />;
}
