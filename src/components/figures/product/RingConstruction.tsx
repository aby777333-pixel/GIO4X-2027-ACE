"use client";

import { Figure, TAU, rgba, smooth, type FigureDraw, type Palette } from "../Figure";
import { line } from "./shapes";

/**
 * Market Universe, "Software over curated relations. Not a model.": the
 * construction of the map, as a draughtsman would set it out. A chosen node at
 * the centre, the first ring at radius r with what it is directly related to,
 * grouped by kind, and a second ring at φ times that radius with a selection
 * of what those relate to. A compass arm goes slowly round, marking the two
 * radii. The placing is fixed: the same choice always draws the same picture.
 *
 * The pointer picks the nearest first-ring node and brings forward its own
 * relations; the rest step back.
 */

const PHI = 1.618;

type Kind = 0 | 1 | 2 | 3;
type Inner = { a: number; kind: Kind };
type Outer = { a: number; parent: number; kind: Kind };

/** first ring: four groups by kind, a gap between groups */
const INNER: Inner[] = (() => {
  const groups: [Kind, number][] = [
    [0, 3],
    [1, 2],
    [2, 2],
    [3, 3],
  ];
  const out: Inner[] = [];
  const stepA = 0.47;
  const gapA = (TAU - stepA * 6) / 4;
  let a = -Math.PI / 2 - stepA;
  for (const [kind, n] of groups) {
    for (let i = 0; i < n; i++) {
      out.push({ a, kind });
      a += i < n - 1 ? stepA : gapA;
    }
  }
  return out;
})();

/** second ring: one or two for each first-ring node, fanned about its direction */
const OUTER: Outer[] = INNER.flatMap((n, i) => {
  const two = i % 3 !== 1;
  const kind = ((n.kind + 1 + (i % 2)) % 4) as Kind;
  return two
    ? [
        { a: n.a - 0.13, parent: i, kind },
        { a: n.a + 0.13, parent: i, kind: ((kind + 2) % 4) as Kind },
      ]
    : [{ a: n.a, parent: i, kind }];
});

/** a node drawn by kind, as the map's own legend does: disc, square, diamond, ring */
function node(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: Kind, fill: string, pal: Palette) {
  ctx.beginPath();
  if (kind === 1) ctx.rect(x - s, y - s, s * 2, s * 2);
  else if (kind === 2) {
    ctx.moveTo(x, y - s * 1.3);
    ctx.lineTo(x + s * 1.3, y);
    ctx.lineTo(x, y + s * 1.3);
    ctx.lineTo(x - s * 1.3, y);
    ctx.closePath();
  } else ctx.arc(x, y, s * 1.1, 0, TAU);
  if (kind === 3) {
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = fill;
    ctx.stroke();
  } else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

const draw: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal }) => {
  // hidden below lg, the canvas has no size: nothing to draw
  if (w < 120 || h < 120) return;
  const cx = w / 2;
  const cy = h / 2;
  const r2 = Math.min(w, h) / 2 - 22;
  const r1 = r2 / PHI;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the pointer's pick among the first ring
  let pick = -1;
  if (hover > 0.02) {
    let bd = Infinity;
    for (let i = 0; i < INNER.length; i++) {
      const d = (cx + Math.cos(INNER[i].a) * r1 - mx) ** 2 + (cy + Math.sin(INNER[i].a) * r1 - my) ** 2;
      if (d < bd) {
        bd = d;
        pick = i;
      }
    }
  }
  const on = smooth(hover);
  const dim = (i: number) => (pick < 0 ? 1 : i === pick ? 1 : 1 - on * 0.45);

  // construction lines: the two rings and the axes
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, r1, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r2, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(pal.line, 1);
  line(ctx, cx - r2 - 8, cy + 0.5, cx + r2 + 8, cy + 0.5);
  line(ctx, cx + 0.5, cy - r2 - 8, cx + 0.5, cy + r2 + 8);

  // the compass arm, going round
  const arm = t * 0.22;
  const ax = Math.cos(arm);
  const ay = Math.sin(arm);
  ctx.strokeStyle = rgba(pal.gold, 0.85);
  line(ctx, cx, cy, cx + ax * (r2 + 6), cy + ay * (r2 + 6));
  for (const r of [r1, r2]) {
    const px = cx + ax * r;
    const py = cy + ay * r;
    line(ctx, px - ay * 4, py + ax * 4, px + ay * 4, py - ax * 4);
  }
  // the arc it has just drawn on each ring
  ctx.strokeStyle = rgba(pal.gold, 0.7);
  ctx.lineWidth = 1.4;
  for (const r of [r1, r2]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, arm - 0.5, arm);
    ctx.stroke();
  }
  // the two radii, named where the arm crosses them
  ctx.font = `italic 500 11px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lab = (text: string, r: number) => {
    const px = cx + ax * r - ay * 13;
    const py = cy + ay * r + ax * 13;
    const tw = ctx.measureText(text).width + 8;
    ctx.fillStyle = rgba(pal.surface, 0.85);
    ctx.fillRect(px - tw / 2, py - 7, tw, 14);
    ctx.fillStyle = rgba(pal.ink2, 1);
    ctx.fillText(text, px, py + 0.5);
  };
  lab("r", r1 * 0.55);
  lab("φ × r", (r1 + r2) / 2);

  // relations: centre to the first ring, first ring to the second
  ctx.lineWidth = 1;
  for (let i = 0; i < INNER.length; i++) {
    const n = INNER[i];
    const lit = i === pick ? on : 0;
    ctx.strokeStyle = lit > 0.02 ? rgba(pal.accent, 0.5 + lit * 0.5) : rgba(pal.ink3, 0.5 * dim(i));
    ctx.lineWidth = 1 + lit * 0.6;
    line(ctx, cx, cy, cx + Math.cos(n.a) * r1, cy + Math.sin(n.a) * r1);
  }
  for (const o of OUTER) {
    const p = INNER[o.parent];
    const lit = o.parent === pick ? on : 0;
    ctx.strokeStyle = lit > 0.02 ? rgba(pal.accent, 0.4 + lit * 0.5) : rgba(pal.ink3, 0.3 * dim(o.parent));
    ctx.lineWidth = 1;
    line(ctx, cx + Math.cos(p.a) * r1, cy + Math.sin(p.a) * r1, cx + Math.cos(o.a) * r2, cy + Math.sin(o.a) * r2);
  }

  // the nodes: lit a little as the arm passes
  const pass = (a: number) => {
    const d = Math.abs(((a - arm) % TAU) + TAU) % TAU;
    return smooth(1 - Math.min(d, TAU - d) / 0.35);
  };
  for (const o of OUTER) {
    const lit = o.parent === pick ? on : 0;
    const glow = pass(o.a);
    const tone = lit > 0.02 ? rgba(pal.accent, 0.6 + lit * 0.4) : rgba(pal.ink2, (0.55 + glow * 0.45) * dim(o.parent));
    node(ctx, cx + Math.cos(o.a) * r2, cy + Math.sin(o.a) * r2, 2.6 + glow * 0.8 + lit, o.kind, tone, pal);
  }
  for (let i = 0; i < INNER.length; i++) {
    const n = INNER[i];
    const lit = i === pick ? on : 0;
    const glow = pass(n.a);
    const x = cx + Math.cos(n.a) * r1;
    const y = cy + Math.sin(n.a) * r1;
    ctx.beginPath();
    ctx.arc(x, y, 7.5 + lit * 2, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    const tone = lit > 0.02 ? rgba(pal.accent, 0.7 + lit * 0.3) : rgba(pal.ink, (0.7 + glow * 0.3) * dim(i));
    node(ctx, x, y, 3.6 + glow * 0.8 + lit * 1.4, n.kind, tone, pal);
  }

  // the chosen node, at the centre
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = rgba(pal.accent, 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, TAU);
  ctx.fillStyle = rgba(pal.accent, 1);
  ctx.fill();
};

export function RingConstruction() {
  return <Figure draw={draw} ratio={1.25} />;
}
