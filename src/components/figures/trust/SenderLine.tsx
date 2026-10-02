"use client";

import { Figure, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";
import { site } from "@/config/site";

/**
 * Reading a sender, for "How to recognise a genuine GIO4X message" on the
 * destination checker page.
 *
 * An envelope with its sender line: a display name, drawn as a blank bar
 * because it can say anything, and then the address. A reading mark starts at
 * the right-hand end of the address and travels left to the @ sign,
 * underlining what follows it: the part that counts.
 *
 * Pointer: the reading mark follows the pointer along the sender line. Over
 * the display name it underlines nothing.
 */

const CYCLE = 8;
const DOMAIN = `@${site.domain}`;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const m = 12;
  const ex = m;
  const ey = m;
  const ew = w - m * 2;
  const eh = h - m * 2;
  const y = Math.round(ey + eh * 0.55);
  const u = (f.t % CYCLE) / CYCLE;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // the envelope, and its flap
  ctx.beginPath();
  ctx.rect(ex + 0.5, ey + 0.5, ew, eh);
  ctx.fillStyle = rgba(pal.surface, 0.6);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + ew / 2, ey + eh * 0.24);
  ctx.lineTo(ex + ew, ey);
  ctx.strokeStyle = rgba(pal.ink, 0.22);
  ctx.stroke();

  // the sender line: display name, then the address (some of it, then the domain)
  ctx.font = `600 13px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const dw = ctx.measureText(DOMAIN).width;
  const right = ex + ew - 22;
  const at = right - dw;
  const localW = Math.min(46, ew * 0.12);
  const local = at - 10 - localW;
  const nameX = ex + 22;
  const nameW = Math.max(30, local - 18 - nameX);

  // the display name: an empty box, since it can say anything
  ctx.beginPath();
  ctx.rect(nameX + 0.5, y - 9.5, nameW, 19);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(pal.ink3, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  // the part of the address before the @
  ctx.beginPath();
  ctx.moveTo(local, y);
  ctx.lineTo(local + localW, y);
  ctx.strokeStyle = rgba(pal.ink, 0.3);
  ctx.lineWidth = 5;
  ctx.stroke();

  // the reading mark: from the right-hand end to the @ sign, or on the pointer
  const sweep = f.still ? 1 : smooth((u - 0.1) / 0.4);
  const seen = f.still ? 1 : 1 - smooth((u - 0.9) / 0.1);
  const auto = lerp(right + 6, at - 4, sweep);
  const x = clamp(lerp(auto, f.mx, f.hover), nameX, right + 6);
  // left of the address there is nothing to underline: a display name is not an address
  const onName = smooth((local - x) / 24);
  const under = clamp((right - Math.max(x, at - 4)) / dw) * Math.max(seen, f.hover) * (1 - onName);

  ctx.fillStyle = rgba(pal.ink, 0.92);
  ctx.fillText(DOMAIN, at, y + 0.5);
  if (under > 0.004) {
    ctx.beginPath();
    ctx.moveTo(right, y + 12);
    ctx.lineTo(Math.max(x, at - 4), y + 12);
    ctx.strokeStyle = rgba(pal.accent, Math.max(seen, f.hover) * (1 - onName));
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const show = Math.max(seen * (f.still ? 0 : 1), f.hover);
  if (show > 0.004) {
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x, y + 16);
    ctx.strokeStyle = rgba(pal.accent, 0.9 * show);
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  // what each part is, in the section's own words
  ctx.font = `600 10px ${pal.font}`;
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fillText("DISPLAY NAME", nameX, y - 22);
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(pal.ink3, 1 - under);
  ctx.fillText("ADDRESS", right, y - 22);
  if (under > 0.004) {
    ctx.fillStyle = rgba(pal.accent, under);
    ctx.fillText("ADDRESS", right, y - 22);
  }

  // the message underneath
  for (let i = 0; i < 3; i++) {
    const ly = y + 34 + i * 13;
    if (ly > ey + eh - 12) break;
    ctx.beginPath();
    ctx.moveTo(nameX, ly);
    ctx.lineTo(nameX + (ew - 44) * (i === 2 ? 0.5 : i ? 0.9 : 0.82), ly);
    ctx.strokeStyle = rgba(pal.ink, 0.16);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

export function SenderLine() {
  return <Figure draw={draw} ratio={2} />;
}
