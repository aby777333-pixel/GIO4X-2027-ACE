"use client";

import { useMemo } from "react";
import { Figure, TAU, clamp, rgba, smooth, type FigureDraw } from "../Figure";
import { corners, glow, lamp } from "./kit";

/**
 * A central bank's page, beside the local time in its city: a glass globe of
 * meridians and parallels only (as the site's own bank map has no coastlines:
 * the grid is the map), turned so that the bank's city faces the viewer. The
 * city stands at its real latitude and longitude as a champagne lamp on a
 * short pin, and the fifteen-degree band of longitude it stands in is tinted:
 * decisions are announced in that place's time. Nothing else is marked.
 *
 * Pointer: the globe turns under the pointer (across, and a little up and
 * down) and comes back to face the city when the pointer leaves.
 */

const DEG = Math.PI / 180;
const PARALLELS = [-60, -30, 0, 30, 60];
const G = { x: 0, y: 0, z: 0 };

function makeDraw(lat: number, lon: number): FigureDraw {
  return ({ ctx, w, h, t, hover, mx, my, pal }) => {
    if (w < 110 || h < 80) return;
    const on = smooth(hover);
    const R = Math.min(w * 0.34, h * 0.41);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const lon0 = lon * DEG + Math.sin(t * 0.17) * 0.42 - (mx / w - 0.5) * 1.7 * on;
    const tilt = clamp(lat * DEG * 0.6, -0.45, 0.45) + (0.5 - my / h) * -0.5 * on;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);

    /** a place on the globe, as seen: x right, y up, z toward the viewer (all in radii) */
    const geo = (la: number, lo: number, r = 1) => {
      const cl = Math.cos(la);
      const x = cl * Math.sin(lo - lon0);
      const y = Math.sin(la);
      const z = cl * Math.cos(lo - lon0);
      G.x = cx + x * R * r;
      G.y = cy - (y * ct - z * st) * R * r;
      G.z = y * st + z * ct;
      return G;
    };
    /** a line on the globe: the part facing the viewer at `near`, the part behind at `far` */
    const line = (at: (i: number) => void, n: number, colour: typeof pal.ink, near: number, far: number, width = 1) => {
      ctx.lineWidth = width;
      for (let pass = 0; pass < 2; pass++) {
        const alpha = pass === 0 ? far : near;
        if (alpha <= 0.004) continue;
        ctx.strokeStyle = rgba(colour, alpha);
        ctx.beginPath();
        let pen = false;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let i = 0; i <= n; i++) {
          at(i);
          if (i > 0) {
            if ((pz + G.z) / 2 > 0 === (pass === 1)) {
              if (!pen) ctx.moveTo(px, py);
              ctx.lineTo(G.x, G.y);
              pen = true;
            } else pen = false;
          }
          px = G.x;
          py = G.y;
          pz = G.z;
        }
        ctx.stroke();
      }
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    corners(ctx, w, h, pal.gold, 0.4);

    // the glass
    glow(ctx, cx, cy, Math.min(R * 1.2, h * 0.5 - 1), pal.accent, 0.2);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 0.9);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.05, cx, cy, R);
    g.addColorStop(0, rgba(pal.accent, 0.3));
    g.addColorStop(0.65, rgba(pal.accent, 0.08));
    g.addColorStop(1, rgba(pal.accent, 0.02));
    ctx.fillStyle = g;
    ctx.fill();

    // the band of longitude the city stands in
    const la0 = lat * DEG;
    const lo0 = lon * DEG;
    const half = 7.5 * DEG;
    for (let i = 0; i < 24; i++) {
      const a = (-84 + i * 7) * DEG;
      const b = a + 7 * DEG;
      geo(a, lo0 - half);
      const x1 = G.x;
      const y1 = G.y;
      const z1 = G.z;
      geo(a, lo0 + half);
      const x2 = G.x;
      const y2 = G.y;
      const z2 = G.z;
      geo(b, lo0 + half);
      const x3 = G.x;
      const y3 = G.y;
      const z3 = G.z;
      geo(b, lo0 - half);
      if (z1 < 0.02 || z2 < 0.02 || z3 < 0.02 || G.z < 0.02) continue;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(G.x, G.y);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.gold, 0.14 + on * 0.06);
      ctx.fill();
    }

    // the grid
    for (const p of PARALLELS) line((i) => void geo(p * DEG, (i / 48) * TAU), 48, p === 0 ? pal.ink2 : pal.ink3, p === 0 ? 0.6 : 0.42, 0.1);
    for (let m = 0; m < 12; m++) line((i) => void geo((-90 + (i / 30) * 180) * DEG, m * 30 * DEG), 30, pal.ink3, 0.42, 0.1);
    for (const side of [-1, 1]) line((i) => void geo((-90 + (i / 30) * 180) * DEG, lo0 + side * half), 30, pal.gold, 0.6, 0.08);

    // the limb, and a thin atmosphere
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = rgba(pal.accent, 0.85);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.accent, 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3.5, 0, TAU);
    ctx.stroke();

    // the city
    geo(la0, lo0);
    if (G.z > 0.03) {
      const px = G.x;
      const py = G.y;
      const beat = (t * 0.55) % 1;
      ctx.strokeStyle = rgba(pal.gold, (1 - beat) * 0.8);
      ctx.beginPath();
      ctx.arc(px, py, 3 + beat * (10 + on * 5), 0, TAU);
      ctx.stroke();
      geo(la0, lo0, 1.16);
      ctx.strokeStyle = rgba(pal.gold, 0.9);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(G.x, G.y);
      ctx.stroke();
      ctx.fillStyle = rgba(pal.gold, 0.9);
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, TAU);
      ctx.fill();
      lamp(ctx, G.x, G.y, 2.4, pal.gold, 1);
    }
  };
}

export function BankGlobe({ lat, lon, ratio = 1.4 }: { lat: number; lon: number; ratio?: number }) {
  const draw = useMemo(() => makeDraw(lat, lon), [lat, lon]);
  return <Figure draw={draw} ratio={ratio} />;
}
