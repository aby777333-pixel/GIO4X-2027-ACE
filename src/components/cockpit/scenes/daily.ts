/**
 * DAILY — the day's notes, as they are written.
 *
 * The daily blog is short notes from the desks, a new one on top of the last.
 * So its instrument is the stack itself: five notes fanned on a dark desk
 * under the arc of the day. The newest lies on top and is being written as
 * you watch: its heading is drawn, then its lines, then a small figure in its
 * corner. When it is finished it is laid aside and the next comes forward.
 *
 * The pointer is a reader's hand. The note under it lifts out of the fan and
 * brightens, and the whole stack leans a little the way the hand goes.
 *
 * Lines of text are strokes, and the figure in each corner is an invented
 * shape. Nothing here can be read, counted or dated.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";

const NOTES = 5;
/** seconds one note stays on top */
const TURN = 6.5;
const ease = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

type State = { shapes: number[][] };

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const scene: Scene<State> = {
  pose: 4.6,
  setup(f) {
    // one small invented figure for each note: eight heights
    return { shapes: Array.from({ length: 12 }, (_, n) => Array.from({ length: 8 }, (_, i) => 0.2 + 0.6 * f.rnd(n * 17 + i + 5))) };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal, box: b } = f;
    const m = f.mobile;
    const W = Math.min(b.w * 0.5, b.h * 0.9);
    const H = W * 0.64;
    // the top note sits left of centre and a little low, so that the fan behind it is centred in the frame
    const cx = b.x + b.w / 2 - W * 0.2 + f.px * b.w * 0.02;
    const cy = b.y + b.h * (m ? 0.58 : 0.6);
    const tones = [pal.teal, pal.blue, pal.emerald, pal.gold];
    const turn = f.t / TURN;
    const n0 = Math.floor(turn);
    const u = turn - n0; // 0 to 1 within the life of the top note

    // the arc of the day, and the point of light that travels it
    const ar = b.w * 0.46;
    const ay = b.y + b.h * 0.9;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(pal.ink3, 0.35 * f.boot);
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, ay, ar, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const a = lerp(Math.PI * 1.08, Math.PI * 1.92, i / 12);
      const r1 = ar + (i % 3 ? 4 : 8);
      ctx.strokeStyle = rgba(pal.ink3, (i % 3 ? 0.3 : 0.6) * f.boot);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2 + Math.cos(a) * ar, ay + Math.sin(a) * ar);
      ctx.lineTo(b.x + b.w / 2 + Math.cos(a) * r1, ay + Math.sin(a) * r1);
      ctx.stroke();
    }
    const day = lerp(Math.PI * 1.08, Math.PI * 1.92, (f.t * 0.02) % 1);
    const sx = b.x + b.w / 2 + Math.cos(day) * ar;
    const sy = ay + Math.sin(day) * ar;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.u * 0.5);
    halo.addColorStop(0, rgba(pal.gold, 0.55 * f.boot));
    halo.addColorStop(1, rgba(pal.gold, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(sx - f.u * 0.5, sy - f.u * 0.5, f.u, f.u);
    ctx.fillStyle = rgba(pal.gold, f.boot);
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, TAU);
    ctx.fill();

    // which note is the pointer over? the fan is tested back to front, so the nearest wins
    const place = (slot: number) => {
      // slot 0 is the top note; larger slots lie further back, up and to the right
      const back = slot / (NOTES - 1);
      return { x: cx + back * W * 0.42, y: cy - back * H * 0.36, rot: back * 0.16 + f.px * 0.03, k: 1 - back * 0.22 };
    };
    let hot = -1;
    if (f.hover > 0.2) {
      for (let slot = 0; slot < NOTES; slot++) {
        const p = place(slot);
        if (Math.abs(f.mx - p.x) < (W * p.k) / 2 && Math.abs(f.my - p.y) < (H * p.k) / 2) {
          hot = slot;
          break;
        }
      }
    }

    const note = (slot: number, index: number, written: number, alpha: number, dx = 0, dy = 0) => {
      const p = place(slot);
      const lift = hot === slot ? f.hover : 0;
      const tone = tones[((index % tones.length) + tones.length) % tones.length];
      const shape = s.shapes[((index % s.shapes.length) + s.shapes.length) % s.shapes.length];
      const w = W * p.k;
      const h = H * p.k;
      ctx.save();
      ctx.translate(p.x + dx, p.y + dy - lift * 10);
      ctx.rotate(p.rot - lift * 0.03);
      ctx.globalAlpha = alpha * f.on(0.15 + slot * 0.12, 0.5);
      // the sheet: dark glass with a hairline, lit along its top edge in its desk's colour
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      rounded(ctx, -w / 2, -h / 2, w, h, 5);
      ctx.fillStyle = rgba(pal.bg, 0.94);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = rgba(pal.ink, 0.045 + lift * 0.05);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(hot === slot ? tone : pal.ink3, 0.55 + lift * 0.45);
      ctx.stroke();
      ctx.fillStyle = rgba(tone, 0.95);
      ctx.fillRect(-w / 2 + 5, -h / 2, w - 10, 2);

      const left = -w / 2 + w * 0.08;
      const full = w * 0.84;
      const row = (y: number, share: number, order: number, weight: number, colour: string) => {
        // each stroke is written in its turn, left to right
        const done = clamp(written * 7 - order);
        if (done <= 0) return;
        ctx.fillStyle = colour;
        ctx.fillRect(left, -h / 2 + h * y, full * share * done, weight * p.k);
      };
      row(0.14, 0.2, 0, 3, rgba(tone, 0.95)); // the desk
      row(0.27, 0.78, 0.6, 7, rgba(pal.ink, 0.92)); // the heading
      row(0.4, 0.52, 1.4, 7, rgba(pal.ink, 0.92));
      [0.56, 0.65, 0.74, 0.83].forEach((y, i) => row(y, [0.56, 0.5, 0.58, 0.34][i], 2.4 + i * 0.8, 3, rgba(pal.ink2, 0.75)));
      // the small figure in the corner
      const fx = w / 2 - w * 0.08 - w * 0.26;
      const fy = -h / 2 + h * 0.56;
      const fw = w * 0.26;
      const fh = h * 0.3;
      const drawn = clamp(written * 7 - 5.4) * (shape.length - 1);
      if (drawn > 0) {
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(drawn); i++) {
          const x = fx + (fw * i) / (shape.length - 1);
          const y = fy + fh * (1 - shape[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 1.5 * p.k;
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(tone, 0.95);
        ctx.stroke();
      }
      ctx.restore();
      return p;
    };

    // back to front: the four that wait, then the one laid aside, then the one being written
    const leaving = f.still ? 0 : ease((u - 0.86) / 0.14); // the top note is laid aside at the end of its turn
    for (let slot = NOTES - 1; slot >= 1; slot--) {
      // as the top note leaves, each note behind it comes forward one place
      const from = place(slot);
      const to = place(slot - 1);
      note(slot, n0 + slot, 1, 1, (to.x - from.x) * leaving, (to.y - from.y) * leaving);
    }
    const written = f.still ? 1 : clamp(u / 0.62);
    const top = note(0, n0, written, 1 - leaving, -leaving * W * 0.7, leaving * H * 0.12);
    // the pen: a point of light at the place being written
    if (!f.still && written < 1 && leaving === 0) {
      const stroke = Math.min(6, Math.floor(written * 7));
      const ys = [0.14, 0.27, 0.4, 0.56, 0.65, 0.74, 0.83];
      const shares = [0.2, 0.78, 0.52, 0.56, 0.5, 0.58, 0.34];
      const part = clamp(written * 7 - stroke);
      const px = top.x - W / 2 + W * 0.08 + W * 0.84 * shares[stroke] * part;
      const py = top.y - H / 2 + H * ys[stroke];
      const g = ctx.createRadialGradient(px, py, 0, px, py, 16);
      g.addColorStop(0, rgba(pal.key, 0.9));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - 16, py - 16, 32, 32);
    }
  },
};

export default scene;
