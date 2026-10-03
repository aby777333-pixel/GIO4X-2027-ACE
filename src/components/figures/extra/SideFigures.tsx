"use client";

import { useMemo } from "react";
import { localTime } from "@/lib/sessions";
import { Figure, TAU, clamp, lerp, rgba, smooth, type Colour, type FigureDraw } from "../Figure";

/**
 * Five figures for columns that ended well short of the one beside them. Each
 * says, as a drawing, something the page already states in words, and each
 * answers the pointer. None shows a price or a statistic; the only live values
 * are two clocks, read from the device.
 */

const NIGHT: Colour = [12, 17, 22, 1];
const PALE: Colour = [238, 240, 241, 1];
const mix = (a: Colour, b: Colour, t: number): Colour => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];

/* ---------------------------------------------------------------------------
 * About, "The details on record": the time now at the two published offices.
 * Two dials, read from the device's clock in each city's zone, joined by an
 * arc. The pointer brings the nearer dial forward.
 * ------------------------------------------------------------------------- */

const OFFICES = [
  { city: "London", role: "HEAD OFFICE", tz: "Europe/London" },
  { city: "Chennai", role: "SUPPORT OFFICE", tz: "Asia/Kolkata" },
] as const;
let clockAt = 0;
let clockNow: { minutes: number; label: string }[] = [];
function officeTimes() {
  const ms = Date.now();
  if (ms - clockAt > 5000 || !clockNow.length) {
    const now = new Date(ms);
    clockNow = OFFICES.map((o) => localTime(now, o.tz));
    clockAt = ms;
  }
  return clockNow;
}

const drawOffices: FigureDraw = ({ ctx, w, h, t, hover, mx, pal, still }) => {
  if (w < 160 || h < 120) return;
  const times = officeTimes();
  const cy = h * 0.46;
  const R = Math.min(w * 0.17, h * 0.3);
  const xs = [w * 0.26, w * 0.74];
  const picked = hover > 0.3 ? (mx < w / 2 ? 0 : 1) : -1;

  ctx.lineCap = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // the line between them, with one point travelling it
  const lift = R * 1.15;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(xs[0] + R, cy - R * 0.5);
  ctx.quadraticCurveTo(w / 2, cy - R * 0.5 - lift, xs[1] - R, cy - R * 0.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!still) {
    const u = (Math.sin(t * 0.7) + 1) / 2;
    const ax = xs[0] + R;
    const bx = xs[1] - R;
    const px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * (w / 2) + u * u * bx;
    const py = (1 - u) * (1 - u) * (cy - R * 0.5) + 2 * (1 - u) * u * (cy - R * 0.5 - lift) + u * u * (cy - R * 0.5);
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, TAU);
    ctx.fillStyle = rgba(pal.gold, 1);
    ctx.fill();
  }

  OFFICES.forEach((o, i) => {
    const lit = picked === i ? 1 : 0;
    const r = R * (1 + lit * 0.08);
    const x = xs[i];
    const m = times[i].minutes;
    const dark = m < 360 || m >= 1080; // before six, after eighteen
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.fillStyle = dark ? rgba(NIGHT, 0.9) : rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.2 + lit * 0.6;
    ctx.strokeStyle = rgba(lit ? pal.accent : pal.ink3, 0.9);
    ctx.stroke();
    const mark = dark ? PALE : pal.ink;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
      ctx.lineTo(x + Math.cos(a) * r * (k % 3 ? 0.92 : 0.96), cy + Math.sin(a) * r * (k % 3 ? 0.92 : 0.96));
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(mark, k % 3 ? 0.4 : 0.8);
      ctx.stroke();
    }
    const ha = ((m % 720) / 720) * TAU - Math.PI / 2;
    const ma = ((m % 60) / 60) * TAU - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = rgba(mark, 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + Math.cos(ma) * r * 0.74, cy + Math.sin(ma) * r * 0.74);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.accent, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, cy, 2.4, 0, TAU);
    ctx.fillStyle = rgba(pal.gold, 1);
    ctx.fill();

    ctx.font = `600 9px ${pal.font}`;
    ctx.fillStyle = rgba(pal.ink3, 0.95);
    ctx.fillText(o.role, x, cy + r + 14);
    ctx.font = `600 13px ${pal.font}`;
    ctx.fillStyle = rgba(pal.ink, 1);
    ctx.fillText(`${o.city}  ${times[i].label}`, x, cy + r + 30);
  });
};

export function TwoOffices() {
  return <Figure draw={drawOffices} ratio={1.45} />;
}

/* ---------------------------------------------------------------------------
 * Support, "Open a request": the way a request travels.
 * Three stations round a loop: you write, you are shown a reference, the reply
 * appears on this page. One point goes round; the leg it is on is described.
 * The pointer holds it at the station it is nearest.
 * ------------------------------------------------------------------------- */

const LEGS = [
  { name: "You write", note: "You are shown a reference at once" },
  { name: "Reference", note: "Our reply appears on this page, not by email" },
  { name: "Reply here", note: "Come back with the reference and your email" },
] as const;

const drawLoop: FigureDraw = ({ ctx, w, h, t, hover, mx, my, pal, still }) => {
  if (w < 140 || h < 140) return;
  const cx = w / 2;
  const cy = (h - 26) / 2 + 4;
  const R = Math.min(w * 0.3, (h - 26) * 0.34);
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i / 3) * TAU;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
  };
  let pos = still ? 1 : (t * 0.28) % 3; // 0 to 3 round the loop
  if (hover > 0.3) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const p = at(i);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < best) {
        best = d;
        pos = i;
      }
    }
  }
  const leg = Math.floor(pos) % 3;

  ctx.lineCap = "round";
  ctx.textBaseline = "middle";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.45);
  ctx.stroke();
  // the leg being travelled, lit
  ctx.beginPath();
  ctx.arc(cx, cy, R, at(leg).a, at(leg).a + (pos - leg) * (TAU / 3));
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(pal.accent, 0.95);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const p = at(i);
    const here = smooth(1 - Math.min(Math.abs(pos - i), Math.abs(pos - i - 3), Math.abs(pos - i + 3)) / 0.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 + here * 4, 0, TAU);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.2 + here * 0.6;
    ctx.strokeStyle = rgba(here > 0.3 ? pal.accent : pal.ink3, 0.95);
    ctx.stroke();
    ctx.font = `600 9px ${pal.font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(here > 0.3 ? pal.gold : pal.ink3, 1);
    ctx.fillText(`0${i + 1}`, p.x, p.y + 0.5);
    ctx.font = `${here > 0.3 ? 600 : 500} 12px ${pal.font}`;
    ctx.fillStyle = rgba(here > 0.3 ? pal.ink : pal.ink2, 1);
    const below = Math.sin(p.a) > 0;
    ctx.textAlign = i === 0 ? "center" : Math.cos(p.a) > 0 ? "left" : "right";
    ctx.fillText(LEGS[i].name, i === 0 ? p.x : p.x + (Math.cos(p.a) > 0 ? 18 : -18), i === 0 ? p.y - 22 : p.y + (below ? 6 : 0));
  }

  // the request itself
  const a = -Math.PI / 2 + (pos / 3) * TAU;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3.4, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText(LEGS[leg].note, 12, h - 12);
};

export function ReplyLoop() {
  return <Figure draw={drawLoop} ratio={1.1} />;
}

/* ---------------------------------------------------------------------------
 * Preferences, "Display": the same building, by day and after hours.
 * One facade under a sky that passes from day to night and back. The pointer
 * sets the hour: left is day, right is night. Nothing about the building
 * changes but the light, which is what the two themes are.
 * ------------------------------------------------------------------------- */

const drawBuilding: FigureDraw = ({ ctx, w, h, t, hover, mx, pal, still }) => {
  if (w < 140 || h < 120) return;
  const own = still ? 0 : smooth((Math.sin(t * 0.5) + 1) / 2);
  const night = lerp(own, clamp((mx - 20) / (w - 40)), smooth(hover));
  const ground = h - 34;
  const bw = Math.min(w * 0.56, 230);
  const bh = Math.min(ground - 30, bw * 0.62);
  const bx = (w - bw) / 2;
  const by = ground - bh;
  const stroke = mix([pal.ink2[0], pal.ink2[1], pal.ink2[2], 1], PALE, night);

  // the sky
  ctx.fillStyle = rgba(NIGHT, night * 0.92);
  ctx.fillRect(0, 0, w, ground);
  // the sun goes down on the left as the moon comes up on the right
  ctx.beginPath();
  ctx.arc(w * 0.16, lerp(26, ground + 14, night), 9, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1 - night);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.84, lerp(ground + 14, 26, night), 7, 0, TAU);
  ctx.fillStyle = rgba(PALE, night);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const sx = ((Math.sin(i * 91.7) + 1) / 2) * w;
    const sy = ((Math.sin(i * 53.3) + 1) / 2) * (by - 6);
    ctx.fillStyle = rgba(PALE, night * (0.4 + 0.5 * ((Math.sin(t * 1.3 + i) + 1) / 2)));
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }

  // the building: a pediment, six columns, two rows of windows
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(stroke, 0.95);
  ctx.fillStyle = rgba(mix([pal.surface[0], pal.surface[1], pal.surface[2], 1], [24, 31, 38, 1], night), 1);
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - 8, by);
  ctx.lineTo(w / 2, by - bh * 0.3);
  ctx.lineTo(bx + bw + 8, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const cols = 6;
  for (let c = 0; c < cols; c++) {
    const x = bx + ((c + 0.5) / cols) * bw;
    ctx.beginPath();
    ctx.moveTo(x - bw / cols / 2 + 3, by + 6);
    ctx.lineTo(x - bw / cols / 2 + 3, ground);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(stroke, c ? 0.35 : 0);
    ctx.stroke();
    for (let r = 0; r < 2; r++) {
      const wy = by + 14 + r * (bh * 0.42);
      const ww = bw / cols - 14;
      const wh = bh * 0.26;
      // a window comes on a little after its neighbour
      const on = smooth((night - 0.35 - ((c * 3 + r * 5) % 7) * 0.05) / 0.25);
      ctx.fillStyle = rgba(pal.gold, on * 0.9);
      ctx.fillRect(x - ww / 2, wy, ww, wh);
      ctx.strokeStyle = rgba(stroke, 0.8);
      ctx.strokeRect(x - ww / 2, wy, ww, wh);
    }
  }
  ctx.beginPath();
  ctx.moveTo(12, ground);
  ctx.lineTo(w - 12, ground);
  ctx.strokeStyle = rgba(pal.ink3, 0.8);
  ctx.stroke();

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText(night > 0.5 ? "Dark: the same building after hours" : "Light: the same building by day", 12, h - 12);
};

export function SameBuilding() {
  return <Figure draw={drawBuilding} ratio={1.35} />;
}

/* ---------------------------------------------------------------------------
 * Preferences, "Privacy controls": kept here, sent nowhere.
 * A frame for this browser with the kinds of thing the site may keep moving
 * about inside it; a line towards "elsewhere" that stops short and never
 * connects. Under the pointer everything inside clears, as the one button on
 * the page does, and returns when the pointer leaves.
 * ------------------------------------------------------------------------- */

const KEPT = ["Theme", "Accent", "Time zone", "Sound", "Desk"] as const;

const drawKept: FigureDraw = ({ ctx, w, h, t, hover, pal, still }) => {
  if (w < 160 || h < 130) return;
  const bx = 14;
  const by = 30;
  const bw = w * 0.6;
  const bh = h - 26 - by - 12;
  const cleared = smooth(hover);
  const time = still ? 2.6 : t;

  ctx.textBaseline = "middle";
  ctx.lineCap = "round";
  ctx.font = `600 9px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink3, 0.95);
  ctx.fillText("THIS BROWSER", bx, by - 12);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 7);
  else ctx.rect(bx, by, bw, bh);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = rgba(pal.accent, 0.95);
  ctx.stroke();

  // what is kept: each a small tag, drifting, never leaving the frame
  ctx.font = `500 10px ${pal.font}`;
  KEPT.forEach((name, i) => {
    const tw = ctx.measureText(name).width + 14;
    const x = bx + 8 + ((Math.sin(time * (0.21 + i * 0.05) + i * 2.1) + 1) / 2) * (bw - tw - 16);
    const y = by + 16 + ((Math.sin(time * (0.17 + i * 0.04) + i * 1.3) + 1) / 2) * (bh - 32);
    const a = 1 - cleared;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y - 9, tw, 18, 9);
    else ctx.rect(x, y - 9, tw, 18);
    ctx.fillStyle = rgba(pal.surface, a);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.8 * a);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ink, a);
    ctx.fillText(name, x + 7, y + 0.5);
  });

  // elsewhere: a line that sets out and stops
  const ex = w - 14 - Math.min(64, w * 0.2);
  const ey = by + bh / 2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(bx + bw + 6, ey);
  ctx.lineTo(lerp(bx + bw + 6, ex - 10, 0.55), ey);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.8);
  ctx.stroke();
  ctx.setLineDash([]);
  const stop = lerp(bx + bw + 6, ex - 10, 0.55) + 4;
  ctx.beginPath();
  ctx.moveTo(stop, ey - 7);
  ctx.lineTo(stop, ey + 7);
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.stroke();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ex, ey - 20, w - 14 - ex, 40, 5);
  else ctx.rect(ex, ey - 20, w - 14 - ex, 40);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(pal.ink3, 0.5);
  ctx.stroke();
  ctx.font = `600 8px ${pal.font}`;
  ctx.textAlign = "center";
  ctx.fillStyle = rgba(pal.ink3, 0.9);
  ctx.fillText("ELSEWHERE", (ex + w - 14) / 2, ey);

  ctx.font = `500 11px ${pal.font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink2, 0.95);
  ctx.fillText(cleared > 0.5 ? "One button clears all of it" : "Kept in this browser, sent nowhere", 12, h - 12);
};

export function KeptHere() {
  return <Figure draw={drawKept} ratio={1.5} />;
}

/* ---------------------------------------------------------------------------
 * Open an account, "Before you type anything": which part of an address is
 * the site. An address bar holding this site's own address; a reading mark
 * passes along it and the part between "https://" and the next slash is
 * bracketed, because that part alone says whose site it is. The pointer
 * moves the reading mark.
 * ------------------------------------------------------------------------- */

function addressDraw(domain: string): FigureDraw {
  const parts = ["https://", domain, "/open-account"] as const;
  return ({ ctx, w, h, t, hover, mx, pal, still }) => {
    if (w < 180 || h < 90) return;
    const barY = h * 0.34;
    const barH = 34;
    const x0 = 14;
    ctx.textBaseline = "middle";
    ctx.lineCap = "round";

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, barY - barH / 2, w - x0 * 2, barH, barH / 2);
    else ctx.rect(x0, barY - barH / 2, w - x0 * 2, barH);
    ctx.fillStyle = rgba(pal.surface, 1);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(pal.ink3, 0.8);
    ctx.stroke();

    // the padlock
    const lx = x0 + 18;
    ctx.beginPath();
    ctx.arc(lx, barY - 3, 4, Math.PI, 0);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.ink2, 1);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.ink2, 1);
    ctx.fillRect(lx - 5.5, barY - 3, 11, 8);

    // the address, sized to fit the bar
    let size = 14;
    ctx.font = `500 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const room = w - x0 * 2 - 52;
    const full = ctx.measureText(parts.join("")).width;
    if (full > room) size = Math.max(9, (size * room) / full);
    ctx.font = `500 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const widths = parts.map((p) => ctx.measureText(p).width);
    const tx = lx + 16;
    const total = widths[0] + widths[1] + widths[2];

    // the reading mark: its own pass, or the pointer
    const own = still ? 1 : clamp(((t * 0.32) % 1.5) / 1);
    const read = lerp(own, clamp((mx - tx) / total), smooth(hover));
    const markX = tx + read * total;
    const found = smooth((markX - (tx + widths[0])) / widths[1]);

    ctx.textAlign = "left";
    let x = tx;
    parts.forEach((p, i) => {
      ctx.fillStyle = i === 1 ? rgba(found > 0.5 ? pal.ink : pal.ink2, 1) : rgba(pal.ink3, 0.75);
      ctx.fillText(p, x, barY + 0.5);
      x += widths[i];
    });
    ctx.beginPath();
    ctx.moveTo(markX, barY - barH / 2 + 5);
    ctx.lineTo(markX, barY + barH / 2 - 5);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(pal.gold, still ? 0 : 0.95);
    ctx.stroke();

    // the bracket under the site's own name
    const d0 = tx + widths[0];
    const d1 = d0 + widths[1] * found;
    if (found > 0.02) {
      const yb = barY + barH / 2 + 9;
      ctx.beginPath();
      ctx.moveTo(d0, yb - 5);
      ctx.lineTo(d0, yb);
      ctx.lineTo(d1, yb);
      if (found > 0.98) ctx.lineTo(d1, yb - 5);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(pal.accent, 1);
      ctx.stroke();
      ctx.font = `600 9px ${pal.font}`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(pal.accent, found);
      ctx.fillText("THE SITE", d0 + widths[1] / 2, yb + 12);
    }

    ctx.font = `500 11px ${pal.font}`;
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(pal.ink2, 0.95);
    ctx.fillText("Between https:// and the next slash: that part is the site", 12, h - 12);
  };
}

export function AddressCheck({ domain }: { domain: string }) {
  const draw = useMemo(() => addressDraw(domain), [domain]);
  return <Figure draw={draw} ratio={2.5} />;
}
