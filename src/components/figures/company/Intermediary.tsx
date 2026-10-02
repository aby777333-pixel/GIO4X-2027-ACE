"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * What a brokerage is, as a diagram: an instruction leaves "You", passes
 * through the broker's gate and reaches the market. It only ever travels one
 * way, because the broker carries instructions and does not originate them.
 * The gate lights as the instruction passes and keeps a small token: the
 * charge for access. The market answers with a ripple where it arrives.
 *
 * Pointer: the instruction follows it along the track, so you carry it
 * through the gate yourself; when the pointer leaves, it travels on its own.
 */

const COLS = 5;
const ROWS = 5;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, t, hover, mx, pal, still } = f;
  const u = Math.min(w / 420, h / 215) * 1.4;
  const y = h * 0.45;
  const cell = 15 * u;
  // the market's first column of points, where the instruction arrives
  const mx0 = w - 22 - (COLS - 1) * cell;
  const xMkt = mx0 - 16 * u;
  const xYou = 22 + 23 * u;
  const xGate = (xYou + xMkt) / 2;

  // where the instruction is, 0 (you) to 1 (market)
  const cycle = (t * 0.17) % 1.3;
  const auto = still ? 0.5 : smooth(clamp(cycle / 0.9));
  const byHand = clamp((mx - xYou) / (xMkt - xYou));
  const p = lerp(auto, byHand, hover);
  const px = lerp(xYou, xMkt, p);
  const gateP = (xGate - xYou) / (xMkt - xYou);
  const inGate = 1 - clamp(Math.abs(p - gateP) / 0.1);
  const arrived = smooth(clamp((p - 0.9) / 0.1));
  const paid = smooth(clamp((p - gateP) / 0.08));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the track: two hairlines, and the part already travelled
  ctx.strokeStyle = rgba(pal.ink, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xYou, y - 4);
  ctx.lineTo(xMkt, y - 4);
  ctx.moveTo(xYou, y + 4);
  ctx.lineTo(xMkt, y + 4);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.accent, 0.85);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xYou, y);
  ctx.lineTo(px, y);
  ctx.stroke();

  // you: the one who decides
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.beginPath();
  ctx.arc(xYou, y, 15 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.6);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.fillStyle = rgba(pal.ink, 0.75);
  ctx.beginPath();
  ctx.arc(xYou, y, 4 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(xYou, y, 23 * u, 0, TAU);
  ctx.stroke();

  // the market: a field of many points, rippling where the instruction lands
  const my0 = y - ((ROWS - 1) * cell) / 2;
  const wave = still ? 2.2 : ((t * 0.17) % 1.3) * 9 - 6;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dx = mx0 + c * cell;
      const dy = my0 + r * cell;
      const d = Math.hypot(c, r - (ROWS - 1) / 2);
      const lit = arrived * (hover > 0.5 ? clamp(1 - d / 5) : clamp(1 - Math.abs(d - wave) / 1.6));
      ctx.fillStyle = rgba(pal.ink, 0.42);
      ctx.beginPath();
      ctx.arc(dx, dy, 1.6 * u, 0, TAU);
      ctx.fill();
      if (lit > 0.01) {
        ctx.fillStyle = rgba(pal.accent, lit);
        ctx.beginPath();
        ctx.arc(dx, dy, (1.6 + 1.4 * lit) * u, 0, TAU);
        ctx.fill();
      }
    }
  }

  // the broker: a gate the instruction passes through
  const gw = 17 * u;
  const gh = 42 * u;
  ctx.fillStyle = rgba(pal.gold, 0.08 + 0.2 * inGate);
  ctx.fillRect(xGate - gw, y - gh, gw * 2, gh * 2);
  ctx.strokeStyle = rgba(pal.ink, 0.65);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xGate - gw, y + gh);
  ctx.lineTo(xGate - gw, y - gh);
  ctx.lineTo(xGate + gw, y - gh);
  ctx.lineTo(xGate + gw, y + gh);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.gold, 0.5 + 0.5 * inGate);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xGate - gw - 5 * u, y - gh);
  ctx.lineTo(xGate + gw + 5 * u, y - gh);
  ctx.stroke();
  // its tray, and the token kept as the instruction goes through
  ctx.strokeStyle = rgba(pal.ink, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xGate - gw - 5 * u, y + gh);
  ctx.lineTo(xGate + gw + 5 * u, y + gh);
  ctx.stroke();
  if (paid > 0.01) {
    ctx.fillStyle = rgba(pal.gold, paid);
    ctx.beginPath();
    ctx.arc(xGate, lerp(y + 8 * u, y + gh - 6 * u, paid), 3 * u, 0, TAU);
    ctx.fill();
  }

  // the instruction: a small slip with three lines on it (what, how much, when)
  const sw = 22 * u;
  const sh = 15 * u;
  const fade = hover > 0.5 ? 1 : 1 - smooth(clamp((cycle - 1.05) / 0.2)) * (still ? 0 : 1);
  ctx.globalAlpha = fade;
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fillRect(px - sw / 2, y - sh / 2, sw, sh);
  ctx.strokeStyle = rgba(pal.accent, 1);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(px - sw / 2, y - sh / 2, sw, sh);
  ctx.strokeStyle = rgba(pal.ink, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(px - sw / 2 + 4 * u, y + i * 3.6 * u);
    ctx.lineTo(px + sw / 2 - (i === 1 ? 9 : 4) * u, y + i * 3.6 * u);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // the three names, as the text beside the figure gives them
  ctx.font = `600 ${Math.round(clamp(10 * u, 9, 11))}px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const ly = y + gh + 26 * u;
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fillText("YOU", xYou, ly);
  ctx.fillText("MARKET", mx0 + ((COLS - 1) * cell) / 2, ly);
  ctx.fillStyle = rgba(pal.ink2, 1);
  ctx.fillText("BROKER", xGate, ly);
};

export function Intermediary() {
  return <Figure draw={draw} ratio={2} />;
}
