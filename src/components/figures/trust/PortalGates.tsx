"use client";

import { Figure, TAU, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * How an address comes to be listed, for the "Portals" chapter of the
 * destination checker page.
 *
 * An address, drawn as a short bar, travels a track. It waits in each of two
 * gates while a check runs round the gate, and only then goes on: first
 * supplied, then security-reviewed. Past both, it settles into the slot at
 * the end of the track, which is the list.
 *
 * Pointer: the gate nearest the pointer opens out and its name lights.
 */

const CYCLE = 10;
/** the track, 0 to 1: where the two gates and the slot are */
const G1 = 0.24;
const G2 = 0.54;
const SLOT = 0.87;

const go = (u: number, a: number, b: number) => smooth((u - a) / (b - a));

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const x0 = 18;
  const x1 = w - 18;
  const R = Math.min(30, h * 0.24);
  const y = Math.round((h - 26) / 2);
  const label = y + R + 21;
  const X = (p: number) => lerp(x0, x1, p);
  const u = f.still ? 0.5 : (f.t % CYCLE) / CYCLE;
  // where the address is on the track, and how far each check has run
  const pos = G1 * go(u, 0.02, 0.14) + (G2 - G1) * go(u, 0.3, 0.42) + (SLOT - G2) * go(u, 0.58, 0.72);
  const c1 = go(u, 0.14, 0.3);
  const c2 = go(u, 0.42, 0.58);
  const home = go(u, 0.68, 0.76);
  const fade = f.still ? 1 : smooth(u / 0.04) * (1 - smooth((u - 0.93) / 0.07));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  // the track, from where an address starts
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(X(SLOT) - 27, y);
  ctx.strokeStyle = rgba(pal.ink, 0.26);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x0, y, 2.5, 0, TAU);
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fill();

  // a gate is a ring seen from the side; `part` draws the far half (0) or the near half (1)
  const gate = (p: number, done: number, part: 0 | 1, name: string) => {
    const gx = X(p);
    const near = f.hover * smooth(1 - Math.abs(f.mx - gx) / (w * 0.16));
    const ry = R + 4 * near;
    const rx = ry * 0.4;
    const from = part ? Math.PI / 2 : -Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(gx, y, rx, ry, 0, from, from + Math.PI);
    ctx.strokeStyle = rgba(pal.ink, part ? 0.55 : 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the check runs round from the top: the far half first, then the near one
    const share = part ? (done - 0.5) * 2 : done * 2;
    if (share > 0.004) {
      ctx.beginPath();
      ctx.ellipse(gx, y, rx, ry, 0, from, from + Math.PI * Math.min(1, share));
      ctx.strokeStyle = rgba(pal.accent, fade);
      ctx.lineWidth = 2.25;
      ctx.stroke();
    }
    if (part) {
      const on = Math.max(near, done * fade);
      ctx.fillStyle = rgba(pal.ink3, 1 - on);
      ctx.fillText(name, gx, label);
      if (on > 0.004) {
        ctx.fillStyle = rgba(pal.ink, on);
        ctx.fillText(name, gx, label);
      }
    }
  };
  gate(G1, c1, 0, "");
  gate(G2, c2, 0, "");

  // the slot at the end: the list
  const sx = X(SLOT);
  const near = f.hover * smooth(1 - Math.abs(f.mx - sx) / (w * 0.16));
  const listed = Math.max(near, home * fade);
  ctx.beginPath();
  ctx.rect(Math.round(sx - 27) + 0.5, y - 11.5, 54, 23);
  ctx.fillStyle = rgba(pal.gold, 0.12 * listed);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.42);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (listed > 0.004) {
    ctx.strokeStyle = rgba(pal.gold, listed);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = rgba(pal.ink3, 1 - listed);
  ctx.fillText("LISTED", sx, label);
  if (listed > 0.004) {
    ctx.fillStyle = rgba(pal.ink, listed);
    ctx.fillText("LISTED", sx, label);
  }

  // the address
  const ax = X(pos);
  ctx.beginPath();
  ctx.moveTo(ax - 17, y);
  ctx.lineTo(ax + 17, y);
  ctx.strokeStyle = rgba(pal.accent, fade);
  ctx.lineWidth = 5;
  ctx.stroke();

  // the near half of each gate passes in front of it
  gate(G1, c1, 1, "SUPPLIED");
  gate(G2, c2, 1, "SECURITY-REVIEWED");
};

export function PortalGates() {
  return <Figure draw={draw} ratio={2.6} />;
}
