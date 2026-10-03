/**
 * JEST — Fun@Finance, on stage.
 *
 * Five candles with faces stand in a row on a small stage and cannot keep
 * still: each hops in its own time, green ones grinning, red ones aghast,
 * and when one lands the boards under it flash. Bubbles of laughter rise
 * from them and burst, paper falls from the flies, and two spotlights cross
 * and recross the row.
 *
 * The pointer is a heckler: the candle it is nearest jumps highest.
 *
 * They are cartoon candles. Their heights are not prices.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, stage } from "./_stage";

const CAST = 5;
const PAPER = 34;

type State = { paper: number[][]; body: number[][] };

const scene: Scene<State> = {
  pose: 1.9,
  setup(f) {
    return {
      paper: Array.from({ length: PAPER }, (_, i) => [f.rnd(i * 4 + 1), f.rnd(i * 4 + 2), f.rnd(i * 4 + 3), f.rnd(i * 4 + 4)]),
      body: Array.from({ length: CAST }, (_, i) => [0.5 + 0.4 * f.rnd(i + 60), f.rnd(i + 80)]),
    };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const t = f.t;
    const floor = R.y + R.h * 0.8;
    const tones = [pal.teal, pal.blue, pal.emerald, pal.gold];

    // the spotlights
    for (let i = 0; i < 2; i++) {
      const sweep = f.still ? (i ? 0.62 : 0.36) : 0.5 + Math.sin(t * 0.6 + i * 2.4) * 0.3;
      const tx = R.x + R.w * sweep;
      const sx = R.x + R.w * (i ? 0.92 : 0.08);
      const g = ctx.createLinearGradient(sx, R.y, tx, floor);
      g.addColorStop(0, rgba(i ? pal.gold : pal.teal, 0.3 * f.boot));
      g.addColorStop(1, rgba(i ? pal.gold : pal.teal, 0.02 * f.boot));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 4, R.y);
      ctx.lineTo(sx + 4, R.y);
      ctx.lineTo(tx + R.w * 0.12, floor);
      ctx.lineTo(tx - R.w * 0.12, floor);
      ctx.closePath();
      ctx.fill();
    }

    // the boards
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(R.x + R.w * 0.05, floor);
    ctx.lineTo(R.x + R.w * 0.95, floor);
    ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const x = lerp(R.x + R.w * 0.05, R.x + R.w * 0.95, i / 12);
      ctx.strokeStyle = rgba(pal.ink3, 0.4 * f.boot);
      ctx.beginPath();
      ctx.moveTo(x, floor);
      ctx.lineTo(lerp(x, R.x + R.w / 2, -0.12), floor + R.h * 0.14);
      ctx.stroke();
    }

    // the cast
    const bw = Math.min(R.w * 0.085, R.h * 0.16);
    for (let i = 0; i < CAST; i++) {
      const x = R.x + R.w * (0.16 + (i / (CAST - 1)) * 0.68);
      const up = i % 2 === 0;
      const tone = up ? pal.emerald : pal.crimson;
      const near = f.hover > 0.1 ? clamp(1 - Math.abs(f.mx - x) / (R.w * 0.14)) * f.hover : 0;
      const period = 0.9 + s.body[i][1] * 0.5;
      const ph = f.still ? 0.3 + i * 0.13 : (t / period + s.body[i][1]) % 1;
      const hop = Math.sin(ph * Math.PI) * R.h * (0.1 + near * 0.16);
      // it squashes as it lands and stretches as it leaves
      const squash = 1 - Math.max(0, 1 - ph * 8) * 0.14 - Math.max(0, (ph - 0.88) * 8) * 0.14;
      const bh = R.h * (0.22 + 0.14 * s.body[i][0]) * squash;
      const on = f.on(0.15 + i * 0.12, 0.4);
      const y = floor - hop;
      // the flash of the boards on landing
      if (!f.still && ph < 0.12) {
        ctx.fillStyle = rgba(tone, (1 - ph / 0.12) * 0.5);
        ctx.beginPath();
        ctx.ellipse(x, floor + 3, bw * 1.3, 4, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = on;
      // its shadow
      ctx.fillStyle = `rgba(0,0,0,${0.35 - hop / (R.h * 0.9)})`;
      ctx.beginPath();
      ctx.ellipse(x, floor + 3, bw * (0.8 - hop / (R.h * 0.7)), 3, 0, 0, TAU);
      ctx.fill();
      // wick, body
      ctx.strokeStyle = rgba(tone, 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - bh - R.h * 0.07);
      ctx.lineTo(x, y);
      ctx.stroke();
      rounded(ctx, x - (bw / 2) / squash, y - bh, bw / squash, bh - 4, 4);
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.fill();
      ctx.fillStyle = rgba(tone, 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(tone, 1);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // its face
      const fy = y - bh * 0.62;
      const e = bw * 0.2;
      ctx.fillStyle = rgba(pal.ink, 0.95);
      ctx.beginPath();
      ctx.arc(x - e, fy, up ? 1.8 : 2.6, 0, TAU);
      ctx.arc(x + e, fy, up ? 1.8 : 2.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink, 0.95);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (up) ctx.arc(x, fy + bw * 0.16, bw * 0.2, 0.15, Math.PI - 0.15);
      else ctx.ellipse(x, fy + bw * 0.34, bw * 0.1, bw * 0.14, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // a bubble of laughter, from the green ones
      if (up) {
        const q = f.still ? 0.4 : (t * 0.5 + i * 0.37) % 1;
        const by = y - bh - R.h * 0.1 - q * R.h * 0.3;
        const br = 5 + q * 9;
        if (q < 0.9) {
          ctx.strokeStyle = rgba(tones[i % 4], (1 - q) * 0.9 * on);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(x + Math.sin(q * 6 + i) * 8, by, br, 0, TAU);
          ctx.stroke();
        } else {
          // it bursts
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU;
            const d = br + (q - 0.9) * 120;
            ctx.strokeStyle = rgba(tones[i % 4], (1 - q) * 6 * on);
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * d, by + Math.sin(a) * d);
            ctx.lineTo(x + Math.cos(a) * (d + 4), by + Math.sin(a) * (d + 4));
            ctx.stroke();
          }
        }
      }
    }

    // paper from the flies
    for (const p of s.paper) {
      const fall = f.still ? p[1] : (p[1] + t * (0.05 + p[2] * 0.06)) % 1;
      const x = R.x + R.w * p[0] + Math.sin(fall * 9 + p[3] * 6) * 10;
      const y = R.y + fall * R.h * 0.86;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(fall * 8 + p[3] * 6);
      ctx.fillStyle = rgba(tones[Math.floor(p[3] * 4) % 4], 0.8 * f.boot * (1 - fall * 0.5));
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  },
};

export default scene;
