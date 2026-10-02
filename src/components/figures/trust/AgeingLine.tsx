"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * An article ageing, for "Articles age. The page should say so." on the
 * editorial standards page.
 *
 * A line of time. The publication mark is pinned at the left and never moves.
 * A reader's mark travels away from it, the distance between them is drawn
 * in, and once the piece is old enough a notice appears above the text of the
 * small page on the right.
 *
 * Pointer: the reader's mark follows the pointer along the line. It cannot be
 * taken to the left of the publication mark: nothing is backdated.
 */

const CYCLE = 11;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const y = Math.round(h * 0.56);
  const pin = 30;
  const pageW = 58;
  const end = w - pageW - 40;
  const u = (f.t % CYCLE) / CYCLE;
  const fade = f.still ? 1 : Math.max(f.hover, smooth(u / 0.06) * (1 - smooth((u - 0.92) / 0.08)));
  const auto = f.still ? 0.8 : smooth(u / 0.8);
  const age = clamp(lerp(auto, (f.mx - pin) / (end - pin), f.hover));
  const x = lerp(pin, end, age);
  const notice = smooth((age - 0.5) / 0.2);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";

  // the line of time, and its divisions
  ctx.beginPath();
  ctx.moveTo(pin, y);
  ctx.lineTo(end, y);
  ctx.strokeStyle = rgba(pal.ink, 0.28);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 1; i <= 12; i++) {
    const tx = Math.round(lerp(pin, end, i / 12)) + 0.5;
    ctx.moveTo(tx, y - (i % 3 === 0 ? 5 : 3));
    ctx.lineTo(tx, y + (i % 3 === 0 ? 5 : 3));
  }
  ctx.stroke();

  // the distance from publication
  ctx.beginPath();
  ctx.moveTo(pin, y);
  ctx.lineTo(x, y);
  ctx.strokeStyle = rgba(pal.accent, 0.95 * fade);
  ctx.lineWidth = 2;
  ctx.stroke();

  // the publication mark: pinned
  ctx.beginPath();
  ctx.moveTo(pin, y - 17);
  ctx.lineTo(pin, y + 9);
  ctx.strokeStyle = rgba(pal.gold, 1);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pin, y - 20, 4, 0, TAU);
  ctx.fillStyle = rgba(pal.gold, 1);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(pal.ink3, 1);
  ctx.fillText("PUBLISHED", pin - 12, y + 24);

  // the reader's mark
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, TAU);
  ctx.fillStyle = rgba(pal.surface, fade);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.accent, fade);
  ctx.lineWidth = 2;
  ctx.stroke();

  // the page: the notice sits above the text once the piece has aged
  const px = w - pageW - 12;
  const pt = 12;
  const ph = h - 24;
  ctx.beginPath();
  ctx.rect(px + 0.5, pt + 0.5, pageW, ph);
  ctx.fillStyle = rgba(pal.surface, 1);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.ink, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  const rows = Math.max(3, Math.floor((ph - 40) / 11));
  for (let i = 0; i < rows; i++) {
    const ry = pt + 34 + i * 11;
    ctx.beginPath();
    ctx.moveTo(px + 9, ry);
    ctx.lineTo(px + 9 + (pageW - 18) * (i === rows - 1 ? 0.55 : 1), ry);
    ctx.strokeStyle = rgba(pal.ink, 0.26);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(px + 8.5, pt + 9.5, pageW - 17, 13);
  ctx.strokeStyle = rgba(pal.ink, 0.18);
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (notice > 0.004) {
    ctx.fillStyle = rgba(pal.accent, 0.16 * notice);
    ctx.fillRect(px + 8.5, pt + 9.5, pageW - 17, 13);
    ctx.strokeStyle = rgba(pal.accent, notice);
    ctx.strokeRect(px + 8.5, pt + 9.5, pageW - 17, 13);
    ctx.textAlign = "center";
    ctx.font = `600 8px ${pal.font}`;
    ctx.fillStyle = rgba(pal.ink, notice);
    ctx.fillText("NOTICE", px + pageW / 2 + 0.5, pt + 16.5);
  }
};

export function AgeingLine() {
  return <Figure draw={draw} ratio={3} />;
}
