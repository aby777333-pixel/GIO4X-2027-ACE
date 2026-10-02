"use client";

import { Figure, TAU, clamp, lerp, rgba, smooth, type FigureDraw } from "@/components/figures/Figure";

/**
 * Fact or analysis, for "The reader should always know which one they are
 * reading." on the editorial standards page.
 *
 * A column of lines of text, drawn as rules. Each carries its mark in the
 * margin: a solid square for a fact, tied back to a source on the far left,
 * and an open ring for analysis, whose line is drawn broken. A reading band
 * moves down the column and names the line it is on.
 *
 * Pointer: the reading band follows the pointer from line to line.
 */

/** true is a fact, false is analysis; and each line's length as a share of the column */
const LINES: readonly { fact: boolean; len: number }[] = [
  { fact: true, len: 0.92 },
  { fact: true, len: 0.74 },
  { fact: false, len: 0.86 },
  { fact: true, len: 0.6 },
  { fact: false, len: 0.8 },
  { fact: false, len: 0.66 },
  { fact: true, len: 0.88 },
];
const N = LINES.length;

const draw: FigureDraw = (f) => {
  const { ctx, w, h, pal } = f;
  const top = 16;
  const pitch = (h - top * 2) / (N - 1);
  const source = 14;
  const mark = 52;
  const x0 = 70;
  const x1 = w - 76;

  // where the reader is: it rests on a line, then moves to the next; or it is on the pointer's line
  const s = (f.t * 0.5) % N;
  const auto = f.still ? 2 : Math.floor(s) + smooth((s - Math.floor(s) - 0.72) / 0.28);
  const at = lerp(auto, Math.round(clamp((f.my - top) / pitch, 0, N - 1)), f.hover);

  ctx.lineCap = "round";
  ctx.font = `600 10px ${pal.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // the source every fact can be checked against
  ctx.beginPath();
  ctx.moveTo(source, top - 4);
  ctx.lineTo(source, h - top + 4);
  ctx.strokeStyle = rgba(pal.gold, 0.9);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i = 0; i < N; i++) {
    const line = LINES[i];
    const y = top + i * pitch;
    // the last line hands over to the first
    const gap = Math.min(Math.abs(at - i), Math.abs(at - N - i));
    const on = smooth(1 - gap / 0.7);
    const end = lerp(x0, x1, line.len);
    const tone = line.fact ? pal.accent : pal.teal;

    // the reading band
    if (on > 0.004) {
      ctx.fillStyle = rgba(tone, 0.1 * on);
      ctx.fillRect(mark - 12, y - pitch * 0.42, w - mark + 6, pitch * 0.84);
    }

    // the line of text: whole for a fact, broken for analysis
    ctx.beginPath();
    if (!line.fact) ctx.setLineDash([9, 6]);
    ctx.moveTo(x0, y);
    ctx.lineTo(end, y);
    ctx.strokeStyle = rgba(pal.ink, 0.3 + 0.5 * on);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    if (line.fact) {
      // tied back to the source
      ctx.beginPath();
      ctx.moveTo(source, y);
      ctx.lineTo(mark - 5, y);
      ctx.strokeStyle = rgba(pal.ink3, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (on > 0.004) {
        ctx.strokeStyle = rgba(pal.gold, on);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(source, y, 2.5, 0, TAU);
      ctx.fillStyle = rgba(pal.gold, 1);
      ctx.fill();
      ctx.fillStyle = rgba(pal.ink2, 0.75);
      ctx.fillRect(mark - 4, y - 4, 8, 8);
      if (on > 0.004) {
        ctx.fillStyle = rgba(tone, on);
        ctx.fillRect(mark - 4, y - 4, 8, 8);
      }
    } else {
      ctx.beginPath();
      ctx.arc(mark, y, 4, 0, TAU);
      ctx.strokeStyle = rgba(pal.ink2, 0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (on > 0.004) {
        ctx.strokeStyle = rgba(tone, on);
        ctx.stroke();
      }
    }

    // which one it is
    if (on > 0.004) {
      ctx.fillStyle = rgba(pal.ink, on * on);
      ctx.fillText(line.fact ? "FACT" : "ANALYSIS", x1 + 12, y + 0.5);
    }
  }
};

export function FactOrAnalysis() {
  return <Figure draw={draw} ratio={1.9} />;
}
