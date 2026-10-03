/**
 * ZOOM — the Long Scroll, as a fall that does not end.
 *
 * The page falls from a tick to a decade and finds the same shape at every
 * scale. Its instrument is that fall: frames within frames, each holding the
 * same jagged walk, each a window on a small part of the one outside it. They
 * grow toward you without end; as the outermost passes out of sight a new
 * one is born at the centre. Seven marks down the side stand for the seven
 * scales, and the one being passed is lit.
 *
 * The pointer moves the point the fall is aimed at.
 *
 * One invented walk, drawn again and again. Not market data.
 */
import { clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, stage } from "./_stage";

const DEPTH = 7;
const N = 48;
/** how much larger each frame is than the one inside it */
const RATIO = 1.75;

type State = { walk: number[] };

const scene: Scene<State> = {
  pose: 3.3,
  setup(f) {
    let v = 0;
    const raw = Array.from({ length: N }, (_, i) => {
      v += (f.rnd(i + 11) - 0.5) * 0.3;
      return v;
    });
    const lo = Math.min(...raw);
    const hi = Math.max(...raw);
    return { walk: raw.map((x) => (x - lo) / (hi - lo || 1)) };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const fall = f.still ? 0.4 : (f.t * 0.22) % 1; // 0 to 1: one frame's growth to the size of the next
    // the point the frames grow from
    const ax = R.x + R.w * (0.5 + f.px * 0.12 * f.hover);
    const ay = R.y + R.h * (0.5 + f.py * 0.12 * f.hover);
    const tones = [pal.teal, pal.blue, pal.emerald, pal.gold];
    const turn = f.still ? 0 : Math.floor(f.t * 0.22);

    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    // outermost first, so the nearer frames are drawn over the further
    for (let d = DEPTH; d >= 0; d--) {
      const scale = Math.pow(RATIO, d - 3 + fall);
      const w = R.w * 0.2 * scale;
      const h = R.h * 0.22 * scale;
      // a frame is faint when newly born at the centre and fades as it passes the edge
      const alpha = clamp((d + fall) / 1.4) * clamp((DEPTH - d + 1 - fall) / 1.6) * f.boot;
      if (alpha <= 0.01) continue;
      const tone = tones[(((d - turn) % 4) + 4) % 4];
      const x = ax - w / 2;
      const y = ay - h / 2;
      rounded(ctx, x, y, w, h, 3);
      ctx.fillStyle = rgba(pal.bg, 0.5 * alpha);
      ctx.fill();
      ctx.strokeStyle = rgba(tone, 0.85 * alpha);
      ctx.lineWidth = 1 + scale * 0.12;
      ctx.stroke();
      // the same walk in every frame
      ctx.beginPath();
      s.walk.forEach((v, i) => {
        const px = x + w * (0.06 + (i / (N - 1)) * 0.88);
        const py = y + h * (0.86 - v * 0.72);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.min(2.4, 0.7 + scale * 0.25);
      ctx.strokeStyle = rgba(pal.key, 0.9 * alpha);
      ctx.stroke();
      // the corners, as a viewfinder's
      const c = Math.min(w, h) * 0.08;
      ctx.strokeStyle = rgba(tone, alpha);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y + c);
      ctx.lineTo(x, y);
      ctx.lineTo(x + c, y);
      ctx.moveTo(x + w - c, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - c);
      ctx.stroke();
    }
    // lines of flight from the centre to the corners
    for (let i = 0; i < 4; i++) {
      const cx = i % 2 ? R.x + R.w : R.x;
      const cy = i < 2 ? R.y : R.y + R.h;
      const g = ctx.createLinearGradient(ax, ay, cx, cy);
      g.addColorStop(0, rgba(pal.ink3, 0));
      g.addColorStop(1, rgba(pal.ink3, 0.35 * f.boot));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    ctx.restore();

    // the seven scales, down the side
    const sx = R.x + R.w * 0.045;
    const at = f.still ? 2.4 : (f.t * 0.22) % 7;
    for (let i = 0; i < 7; i++) {
      const y = lerp(R.y + R.h * 0.14, R.y + R.h * 0.86, i / 6);
      const near = clamp(1 - Math.abs(at - i));
      ctx.fillStyle = rgba(near > 0.1 ? pal.gold : pal.ink3, (0.45 + 0.55 * near) * f.boot);
      ctx.fillRect(sx, y - 1, 6 + near * 12 + i * 1.5, 2);
    }
  },
};

export default scene;
