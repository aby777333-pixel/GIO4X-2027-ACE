/**
 * DOJO — the practice room, as a ring of cards.
 *
 * Practice is the same few things, again and again, until they are plain.
 * So the instrument is a carousel: seven cards standing in a ring on a lit
 * floor, turning slowly. Each carries one small figure to be practised: a
 * candle, a bracket of three levels, a path, a set of bars. The card that
 * comes to the front is marked with a tick, as a drill done, and then the
 * ring moves on to the next.
 *
 * The pointer turns the ring by hand, and the card under it lifts.
 *
 * The figures are shapes, not data.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const CARDS = 7;

type State = { bars: number[][] };

const scene: Scene<State> = {
  pose: 3.1,
  setup(f) {
    return { bars: Array.from({ length: CARDS }, (_, n) => Array.from({ length: 7 }, (_, i) => 0.25 + 0.7 * f.rnd(n * 19 + i + 3))) };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const cx = R.x + R.w / 2;
    const cy = R.y + R.h * 0.5;
    const RX = R.w * 0.36;
    const RY = R.h * 0.13;
    const W = Math.min(R.w * 0.2, R.h * 0.42);
    const H = W * 1.34;
    const tones = [pal.teal, pal.blue, pal.emerald, pal.gold];
    // the ring steps from card to card, resting at each, and the hand can push it
    const beat = f.t / 2.6;
    const step = Math.floor(beat) + smooth((beat - Math.floor(beat)) / 0.45);
    const rot = -(step / CARDS) * TAU + f.px * 0.9 * f.hover;

    // the floor: a lit ellipse with marks round it
    const floorY = cy + H * 0.62;
    const pool = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, RX * 1.3);
    pool.addColorStop(0, rgba(pal.blue, 0.2 * f.boot));
    pool.addColorStop(1, rgba(pal.blue, 0));
    ctx.save();
    ctx.translate(cx, floorY);
    ctx.scale(1, RY / RX);
    ctx.translate(-cx, -floorY);
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(cx, floorY, RX * 1.3, 0, TAU);
    ctx.fill();
    for (let ring = 0; ring < 2; ring++) {
      ctx.strokeStyle = rgba(pal.ink3, (ring ? 0.25 : 0.5) * f.boot);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, floorY, RX * (ring ? 1.18 : 1), 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * TAU + rot;
      const r0 = RX * 1.02;
      const r1 = RX * (i % 8 === 0 ? 1.1 : 1.05);
      ctx.strokeStyle = rgba(i % 8 === 0 ? pal.gold : pal.ink3, 0.55 * f.boot);
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * r0, floorY + Math.cos(a) * r0);
      ctx.lineTo(cx + Math.sin(a) * r1, floorY + Math.cos(a) * r1);
      ctx.stroke();
    }
    ctx.restore();

    // the cards, furthest first
    const cards = Array.from({ length: CARDS }, (_, i) => {
      const a = (i / CARDS) * TAU + rot;
      return { i, a, z: Math.cos(a), x: cx + Math.sin(a) * RX, y: cy - Math.cos(a) * RY * 0.2 + Math.cos(a) * RY };
    }).sort((p, q) => p.z - q.z);
    const front = cards[cards.length - 1];

    for (const c of cards) {
      const depth = (c.z + 1) / 2;
      const k = 0.58 + 0.42 * depth;
      const facing = Math.cos(c.a); // 1 faces us, -1 shows its back
      const wide = Math.max(0.1, Math.abs(facing));
      const over = f.hover > 0.2 && Math.abs(f.mx - c.x) < (W * k * wide) / 2 && Math.abs(f.my - c.y) < (H * k) / 2 ? f.hover : 0;
      const isFront = c === front;
      const tone = tones[c.i % tones.length];
      ctx.save();
      ctx.translate(c.x, c.y - over * 12 - (isFront ? 6 : 0));
      ctx.scale(k * wide, k);
      ctx.globalAlpha = (0.35 + 0.65 * depth) * f.on(0.1 + (c.i / CARDS) * 0.5, 0.4);
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      rounded(ctx, -W / 2, -H / 2, W, H, 6);
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = rgba(pal.ink, 0.04 + over * 0.05 + (isFront ? 0.03 : 0));
      ctx.fill();
      ctx.lineWidth = 1 / k;
      ctx.strokeStyle = rgba(isFront || over ? tone : pal.ink3, 0.8);
      ctx.stroke();
      if (facing > 0) {
        ctx.fillStyle = rgba(tone, 0.95);
        ctx.fillRect(-W / 2 + 6, -H / 2, W - 12, 2);
        ctx.fillStyle = rgba(pal.ink3, 0.6);
        ctx.fillRect(-W * 0.36, -H * 0.38, W * 0.3, 3);
        const fx = -W * 0.34;
        const fw = W * 0.68;
        const fy = -H * 0.2;
        const fh = H * 0.46;
        const kind = c.i % 4;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        if (kind === 0) {
          // a candle: a body and its two wicks
          ctx.strokeStyle = rgba(tone, 0.95);
          ctx.beginPath();
          ctx.moveTo(0, fy);
          ctx.lineTo(0, fy + fh);
          ctx.stroke();
          ctx.fillStyle = rgba(tone, 0.9);
          ctx.fillRect(-W * 0.09, fy + fh * 0.22, W * 0.18, fh * 0.48);
        } else if (kind === 1) {
          // a bracket: target, entry, stop
          [
            [0.08, pal.emerald],
            [0.52, pal.ink],
            [0.86, pal.crimson],
          ].forEach(([y, colour], j) => {
            ctx.setLineDash(j === 1 ? [] : [4, 3]);
            ctx.strokeStyle = rgba(colour as string, 0.95);
            ctx.beginPath();
            ctx.moveTo(fx, fy + fh * (y as number));
            ctx.lineTo(fx + fw, fy + fh * (y as number));
            ctx.stroke();
          });
          ctx.setLineDash([]);
        } else if (kind === 2) {
          // a path
          ctx.strokeStyle = rgba(tone, 0.95);
          ctx.beginPath();
          s.bars[c.i].forEach((v, j, all) => {
            const x = fx + (fw * j) / (all.length - 1);
            const y = fy + fh * (1 - v);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else {
          // bars
          s.bars[c.i].forEach((v, j, all) => {
            ctx.fillStyle = rgba(tone, 0.5 + 0.4 * v);
            ctx.fillRect(fx + (fw * j) / all.length, fy + fh * (1 - v), fw / all.length - 2, fh * v);
          });
        }
        // the card at the front is marked done
        if (isFront) {
          const rest = f.still ? 1 : clamp((beat - Math.floor(beat) - 0.5) / 0.25);
          if (rest > 0) {
            const tx = W * 0.26;
            const tyy = H * 0.36;
            ctx.strokeStyle = rgba(pal.emerald, 0.95);
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(tx, tyy, W * 0.11, -Math.PI / 2, -Math.PI / 2 + TAU * rest);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tx - W * 0.05, tyy);
            ctx.lineTo(tx - W * 0.05 + W * 0.035 * Math.min(1, rest * 2), tyy + W * 0.035 * Math.min(1, rest * 2));
            if (rest > 0.5) ctx.lineTo(tx - W * 0.015 + W * 0.07 * (rest * 2 - 1), tyy + W * 0.035 - W * 0.085 * (rest * 2 - 1));
            ctx.stroke();
          }
        }
      } else {
        // the back of a card: a plain mark
        ctx.strokeStyle = rgba(pal.ink3, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, W * 0.16, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // a light over the front card
    const beam = ctx.createLinearGradient(0, R.y, 0, front.y);
    beam.addColorStop(0, rgba(pal.gold, 0.16 * f.boot));
    beam.addColorStop(1, rgba(pal.gold, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.12, R.y);
    ctx.lineTo(cx + W * 0.12, R.y);
    ctx.lineTo(front.x + W * 0.6, front.y);
    ctx.lineTo(front.x - W * 0.6, front.y);
    ctx.closePath();
    ctx.fill();
  },
};

export default scene;
