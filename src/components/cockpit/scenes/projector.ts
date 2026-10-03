/**
 * PROJECTOR — the Screening Room, with the film running.
 *
 * A projector stands at the left, its two reels turning; a cone of light
 * crosses the dark, with dust drifting in it; and on the screen at the right
 * the set pieces are shown one after another, each for a few seconds: a
 * canyon between two walls, towers that light, weather over a sea, a single
 * flight across the frame. The film itself runs along the foot of the stage,
 * sprocket holes and all, and a countdown leader marks each change of reel.
 *
 * The pointer is the projectionist's hand on the lens: the beam follows it
 * a little and the picture brightens.
 *
 * The pictures are silhouettes. No price is shown on the screen.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const REEL = 5;

type State = { dust: number[][]; skyline: number[] };

const scene: Scene<State> = {
  pose: 7.4,
  setup(f) {
    return {
      dust: Array.from({ length: 40 }, (_, i) => [f.rnd(i * 3 + 1), f.rnd(i * 3 + 2), f.rnd(i * 3 + 3)]),
      skyline: Array.from({ length: 9 }, (_, i) => 0.25 + 0.6 * f.rnd(i + 70)),
    };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const t = f.t;
    const reel = Math.floor(t / REEL);
    const u = t / REEL - reel;
    const bright = 0.75 + 0.25 * f.hover + (f.still ? 0 : Math.sin(t * 31) * 0.03);

    // the screen
    const sw = R.w * 0.4;
    const sh = sw * 0.62;
    const sx = R.x + R.w * 0.55;
    const sy = R.y + R.h * 0.44 - sh / 2 + f.py * 4 * f.hover;
    // the lens
    const lx = R.x + R.w * 0.22;
    const ly = R.y + R.h * 0.44;

    // the beam
    const beam = ctx.createLinearGradient(lx, 0, sx, 0);
    beam.addColorStop(0, rgba(pal.key, 0.34 * bright * f.boot));
    beam.addColorStop(1, rgba(pal.key, 0.06 * bright * f.boot));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx, ly - 3);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx, sy + sh);
    ctx.lineTo(lx, ly + 3);
    ctx.closePath();
    ctx.fill();
    // dust in the beam
    for (const d of s.dust) {
      const along = f.still ? d[0] : (d[0] + t * 0.02 * (0.5 + d[2])) % 1;
      const spread = lerp(3, sh / 2, along);
      const x = lerp(lx, sx, along);
      const y = lerp(ly, sy + sh / 2, along) + (d[1] - 0.5) * 2 * spread * 0.9 + (f.still ? 0 : Math.sin(t * 0.7 + d[2] * 9) * 3);
      ctx.fillStyle = rgba(pal.key, (0.25 + 0.5 * d[2]) * bright * f.boot);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + d[2], 0, TAU);
      ctx.fill();
    }

    // the screen and what is on it
    ctx.save();
    rounded(ctx, sx, sy, sw, sh, 3);
    ctx.fillStyle = rgba(pal.bg, 0.92);
    ctx.fill();
    ctx.fillStyle = rgba(pal.key, 0.1 * bright);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.clip();
    const show = f.still ? 1 : smooth(u / 0.1) * (1 - smooth((u - 0.9) / 0.1));
    ctx.globalAlpha = show * f.boot;
    const piece = reel % 4;
    if (!f.still && u < 0.14) {
      // the leader: a ring that sweeps round, and a cross
      ctx.globalAlpha = f.boot;
      const cx = sx + sw / 2;
      const cy = sy + sh / 2;
      ctx.strokeStyle = rgba(pal.ink2, 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, sh * 0.3, 0, TAU);
      ctx.moveTo(sx, cy);
      ctx.lineTo(sx + sw, cy);
      ctx.moveTo(cx, sy);
      ctx.lineTo(cx, sy + sh);
      ctx.stroke();
      ctx.fillStyle = rgba(pal.key, 0.25);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, sh * 0.3, -Math.PI / 2, -Math.PI / 2 + (u / 0.14) * TAU);
      ctx.closePath();
      ctx.fill();
    } else if (piece === 0) {
      // the canyon: two walls and the gap between
      const gap = sw * (0.16 + 0.06 * Math.sin(t * 0.9));
      ctx.fillStyle = rgba(pal.teal, 0.75);
      ctx.beginPath();
      ctx.moveTo(sx, sy + sh);
      ctx.lineTo(sx, sy + sh * 0.3);
      ctx.lineTo(sx + sw / 2 - gap, sy + sh * 0.42);
      ctx.lineTo(sx + sw / 2 - gap * 0.5, sy + sh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(pal.gold, 0.75);
      ctx.beginPath();
      ctx.moveTo(sx + sw, sy + sh);
      ctx.lineTo(sx + sw, sy + sh * 0.24);
      ctx.lineTo(sx + sw / 2 + gap, sy + sh * 0.38);
      ctx.lineTo(sx + sw / 2 + gap * 0.5, sy + sh);
      ctx.closePath();
      ctx.fill();
    } else if (piece === 1) {
      // the towers, lighting one after another
      s.skyline.forEach((hgt, i) => {
        const bw = sw / s.skyline.length;
        const lit = clamp(u * 12 - i - 1.5);
        ctx.fillStyle = rgba(pal.blue, 0.35 + 0.5 * lit);
        ctx.fillRect(sx + i * bw + 2, sy + sh * (1 - hgt * 0.8), bw - 4, sh * hgt * 0.8);
        ctx.fillStyle = rgba(pal.gold, lit);
        for (let wy = 0; wy < 4; wy++) ctx.fillRect(sx + i * bw + bw * 0.3, sy + sh * (1 - hgt * 0.8) + 5 + wy * 9, bw * 0.4, 3);
      });
    } else if (piece === 2) {
      // weather: a sea, and a cloud that crosses it
      for (let wv = 0; wv < 3; wv++) {
        ctx.fillStyle = rgba(pal.blue, 0.3 + wv * 0.2);
        ctx.beginPath();
        ctx.moveTo(sx, sy + sh);
        for (let i = 0; i <= 24; i++) ctx.lineTo(sx + (sw * i) / 24, sy + sh * (0.62 + wv * 0.1) + Math.sin(i * 0.7 + t * (1.4 + wv * 0.5) + wv) * sh * 0.05);
        ctx.lineTo(sx + sw, sy + sh);
        ctx.closePath();
        ctx.fill();
      }
      const cxx = sx + sw * (0.1 + u * 0.8);
      ctx.fillStyle = rgba(pal.ink2, 0.75);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cxx + (i - 1.5) * sh * 0.12, sy + sh * 0.26 - (i % 2) * sh * 0.05, sh * 0.11, 0, TAU);
        ctx.fill();
      }
    } else {
      // a flight: one point crossing the frame, and the path behind it
      ctx.strokeStyle = rgba(pal.emerald, 0.9);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const head = clamp((u - 0.14) / 0.7);
      for (let i = 0; i <= 40 * head; i++) {
        const q = i / 40;
        const x = sx + sw * (0.06 + q * 0.88);
        const y = sy + sh * (0.75 - q * 0.45 - Math.sin(q * Math.PI * 2.5) * 0.12);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const hx = sx + sw * (0.06 + head * 0.88);
      const hy = sy + sh * (0.75 - head * 0.45 - Math.sin(head * Math.PI * 2.5) * 0.12);
      ctx.fillStyle = rgba(pal.key, 1);
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // the projector: a body, a lens and two reels
    const bw = R.w * 0.13;
    const bh = R.h * 0.2;
    const bx = lx - bw - 4;
    const by = ly - bh / 2;
    rounded(ctx, bx, by, bw, bh, 4);
    ctx.fillStyle = rgba(pal.bg, 0.96);
    ctx.fill();
    ctx.fillStyle = rgba(pal.blue, 0.14);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.85 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = rgba(pal.key, bright * f.boot);
    ctx.fillRect(lx - 6, ly - 6, 8, 12);
    const rr = Math.min(R.w * 0.06, R.h * 0.11);
    [
      [bx + bw * 0.22, by - rr * 0.9, 1],
      [bx + bw * 0.8, by - rr * 1.25, 1.35],
    ].forEach(([x, y, spd], i) => {
      ctx.strokeStyle = rgba(i ? pal.gold : pal.teal, 0.95 * f.boot);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.22, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const a = (f.still ? 0.4 : t * 1.6 * spd) + (k / 3) * TAU;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.2, 0, TAU);
        ctx.stroke();
      }
    });
    // its stand
    ctx.strokeStyle = rgba(pal.ink3, 0.8 * f.boot);
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2, by + bh);
    ctx.lineTo(bx + bw * 0.1, R.y + R.h * 0.8);
    ctx.moveTo(bx + bw / 2, by + bh);
    ctx.lineTo(bx + bw * 0.9, R.y + R.h * 0.8);
    ctx.stroke();

    // the film, running along the foot of the stage
    const fy = R.y + R.h * 0.84;
    const fh = R.h * 0.1;
    ctx.fillStyle = rgba(pal.ink, 0.1 * f.boot);
    ctx.fillRect(R.x + R.w * 0.03, fy, R.w * 0.94, fh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x + R.w * 0.03, fy, R.w * 0.94, fh);
    ctx.clip();
    const cell = fh * 1.5;
    const off = f.still ? 0 : (t * 40) % cell;
    for (let x = R.x - off; x < R.x + R.w; x += cell) {
      ctx.strokeStyle = rgba(pal.ink3, 0.7 * f.boot);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, fy + fh * 0.22, cell - 6, fh * 0.56);
      ctx.fillStyle = rgba(pal.ink2, 0.7 * f.boot);
      for (let hole = 0; hole < 3; hole++) {
        ctx.fillRect(x + 4 + (hole * cell) / 3, fy + 2, 4, 3);
        ctx.fillRect(x + 4 + (hole * cell) / 3, fy + fh - 5, 4, 3);
      }
    }
    ctx.restore();
  },
};

export default scene;
