/**
 * LEVER — leverage, as the thing it is named after.
 *
 * A beam on a fulcrum. On the short arm stands the position, a stack of
 * blocks; at the far end of the long arm rests the deposit, one small coin.
 * The fulcrum moves in six steps toward the stack, and with each step the
 * stack grows by a block: the same coin now holds up more. The beam rocks a
 * little, as a price does. The arc traced at the short arm stays small. The
 * arc traced at the coin grows with every step, green above and red below,
 * because the swing is the same size in both directions.
 *
 * The pointer moves the fulcrum by hand.
 *
 * It is a picture of a proportion, and the proportion is not a figure GIO4X
 * offers: the page beside it gives the numbers.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const STEPS = 6;
const HOLD = 2.4;

const scene: Scene = {
  pose: 9.2,
  draw(f: Frame) {
    const { ctx, pal } = f;
    const R = stage(f);
    const left = R.x + R.w * 0.1;
    const L = R.w * 0.8;
    const ground = R.y + R.h * 0.84;
    const pivotY = R.y + R.h * 0.64;

    // which step, and how far through the move to it
    const beat = f.t / HOLD;
    const n = Math.floor(beat) % (STEPS * 2 - 2);
    const up = n < STEPS ? n : STEPS * 2 - 2 - n; // 0..5 and back
    const next = (n + 1) % (STEPS * 2 - 2);
    const upNext = next < STEPS ? next : STEPS * 2 - 2 - next;
    const move = smooth((beat - Math.floor(beat) - 0.6) / 0.4);
    const auto = lerp(up, upNext, move) / (STEPS - 1);
    const byHand = 1 - clamp((f.mx - left) / L - 0.14, 0, 0.36) / 0.36;
    const g = lerp(auto, byHand, f.hover); // 0 = balanced, 1 = most leverage
    const p = lerp(0.5, 0.14, g); // where the fulcrum is along the beam
    const blocks = 1 + Math.round(g * (STEPS - 1));
    const fx = left + p * L;
    const short = p * L;
    const long = (1 - p) * L;
    const swing = f.still ? 0.11 : Math.sin(f.t * 1.25) * 0.085 + Math.sin(f.t * 2.9) * 0.03;
    const reach = 0.12;

    // the ground, in perspective
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = ground + i * i * R.h * 0.007;
      ctx.strokeStyle = rgba(pal.ink3, (0.5 - i * 0.07) * f.boot);
      ctx.beginPath();
      ctx.moveTo(R.x + R.w * 0.04, y);
      ctx.lineTo(R.x + R.w * 0.96, y);
      ctx.stroke();
    }
    // six marks where the fulcrum can stand
    for (let i = 0; i < STEPS; i++) {
      const x = left + lerp(0.5, 0.14, i / (STEPS - 1)) * L;
      const lit = i <= Math.round(g * (STEPS - 1));
      ctx.fillStyle = rgba(lit ? pal.gold : pal.ink3, (lit ? 0.95 : 0.5) * f.boot);
      ctx.fillRect(x - 1, ground + 5, 2, lit ? 9 : 5);
    }

    // the arcs each end can travel
    const arc = (r: number, side: number, alpha: number) => {
      const base = side > 0 ? 0 : Math.PI;
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(pal.emerald, alpha);
      ctx.beginPath();
      ctx.arc(fx, pivotY, r, base - reach, base, false);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.crimson, alpha);
      ctx.beginPath();
      ctx.arc(fx, pivotY, r, base, base + reach, false);
      ctx.stroke();
      // the wedge the end sweeps
      ctx.fillStyle = rgba(side > 0 ? pal.gold : pal.blue, alpha * 0.07);
      ctx.beginPath();
      ctx.moveTo(fx, pivotY);
      ctx.arc(fx, pivotY, r, base - reach, base + reach);
      ctx.closePath();
      ctx.fill();
    };
    const drawn = f.on(0.4, 0.5);
    arc(short, -1, 0.7 * drawn);
    arc(long, 1, 0.95 * drawn);

    // the fulcrum
    const fh = ground - pivotY;
    ctx.beginPath();
    ctx.moveTo(fx, pivotY);
    ctx.lineTo(fx + fh * 0.5, ground);
    ctx.lineTo(fx - fh * 0.5, ground);
    ctx.closePath();
    ctx.fillStyle = rgba(pal.bg, 0.95);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.gold, 0.9 * f.boot);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // the beam, with what stands on it
    ctx.save();
    ctx.translate(fx, pivotY);
    ctx.rotate(swing);
    const bt = Math.max(4, R.h * 0.022);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    rounded(ctx, -short, -bt, L, bt, 2);
    const metal = ctx.createLinearGradient(-short, 0, long, 0);
    metal.addColorStop(0, rgba(pal.blue, 0.95));
    metal.addColorStop(1, rgba(pal.teal, 0.95));
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.shadowColor = "transparent";
    for (let i = 1; i < 20; i++) {
      ctx.fillStyle = rgba(pal.bg, 0.5);
      ctx.fillRect(-short + (L * i) / 20, -bt, 1, i % 5 === 0 ? bt : bt * 0.5);
    }
    // the stack on the short arm
    const bs = Math.min(R.w * 0.06, R.h * 0.062);
    for (let i = 0; i < blocks; i++) {
      const settle = i < blocks - 1 ? 1 : 0.6 + 0.4 * clamp(1 - Math.abs(g * (STEPS - 1) - Math.round(g * (STEPS - 1))) * 2);
      const y = -bt - (i + 1) * (bs + 2);
      rounded(ctx, -short + 2, y, bs * 1.5, bs, 2);
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.fill();
      ctx.fillStyle = rgba(pal.blue, (0.18 + i * 0.05) * settle);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.blue, 0.95 * settle);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = rgba(pal.ink, 0.5 * settle);
      ctx.fillRect(-short + 2 + bs * 0.3, y + bs * 0.44, bs * 0.9, 2);
    }
    // the coin at the far end
    const cr = bs * 0.42;
    const coinX = long - cr - 2;
    const halo = ctx.createRadialGradient(coinX, -bt - cr, 0, coinX, -bt - cr, cr * 3.4);
    halo.addColorStop(0, rgba(pal.gold, 0.5));
    halo.addColorStop(1, rgba(pal.gold, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(coinX - cr * 3.4, -bt - cr * 4.4, cr * 6.8, cr * 6.8);
    ctx.beginPath();
    ctx.arc(coinX, -bt - cr, cr, 0, TAU);
    ctx.fillStyle = rgba(pal.gold, 0.95);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.bg, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(coinX, -bt - cr, cr * 0.62, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // the far end leaves a trail, so the size of its swing can be seen
    if (!f.still) {
      for (let i = 1; i <= 10; i++) {
        const tt = f.t - i * 0.06;
        const a = Math.sin(tt * 1.25) * 0.085 + Math.sin(tt * 2.9) * 0.03;
        ctx.fillStyle = rgba(a < 0 ? pal.emerald : pal.crimson, 0.55 * (1 - i / 10));
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * long, pivotY + Math.sin(a) * long, 2, 0, TAU);
        ctx.fill();
      }
    }

    // how many times the coin: a row of lamps
    const lampY = R.y + R.h * 0.12;
    for (let i = 0; i < STEPS; i++) {
      const lit = i < blocks;
      ctx.beginPath();
      ctx.arc(R.x + R.w * 0.9 - (STEPS - 1 - i) * 14, lampY, 4, 0, TAU);
      ctx.fillStyle = rgba(lit ? pal.blue : pal.ink3, (lit ? 0.95 : 0.35) * f.boot);
      ctx.fill();
    }
  },
};

export default scene;
