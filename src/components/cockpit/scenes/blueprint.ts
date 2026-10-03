/**
 * BLUEPRINT — the cheat sheets, as they are drawn up.
 *
 * Three sheets lie on a drawing board. On the top one a pencil sets out the
 * working of a trade as a draughtsman would: a right angle whose upright is
 * the risk and whose base is the reward, with their dimension lines; a
 * compass arc that divides a circle into the share put at risk; a scale of
 * bars; and a row of ruled lines for the method. When the sheet is full it is
 * lifted away and the next is begun.
 *
 * The pointer is a glass: under it the board's grid is finer and the lines
 * are brighter.
 *
 * It is geometry. No length here is a figure.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { rounded, smooth, stage } from "./_stage";

const LOOP = 13;

const scene: Scene = {
  pose: 10.4,
  draw(f: Frame) {
    const { ctx, pal } = f;
    const R = stage(f);
    const turn = f.t / LOOP;
    const sheetNo = Math.floor(turn);
    const u = turn - sheetNo;
    const W = Math.min(R.w * 0.74, R.h * 1.26);
    const H = W * 0.64;
    const cx = R.x + R.w / 2 + f.px * R.w * 0.015;
    const cy = R.y + R.h * 0.52;
    const lift = f.still ? 0 : smooth((u - 0.9) / 0.1);
    const tones = [pal.teal, pal.blue, pal.emerald];
    const tone = tones[sheetNo % 3];

    const sheet = (dx: number, dy: number, rot: number, alpha: number, top: boolean) => {
      ctx.save();
      ctx.translate(cx + dx, cy + dy);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;
      rounded(ctx, -W / 2, -H / 2, W, H, 4);
      ctx.fillStyle = rgba(pal.bg, 0.96);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = rgba(pal.blue, top ? 0.1 : 0.05);
      ctx.fill();
      ctx.strokeStyle = rgba(top ? tone : pal.ink3, 0.8);
      ctx.lineWidth = 1;
      ctx.stroke();
      // the board's grid
      const cell = W / 24;
      ctx.beginPath();
      for (let i = 1; i < 24; i++) {
        ctx.moveTo(-W / 2 + i * cell, -H / 2);
        ctx.lineTo(-W / 2 + i * cell, H / 2);
      }
      for (let y = -H / 2 + cell; y < H / 2; y += cell) {
        ctx.moveTo(-W / 2, y);
        ctx.lineTo(W / 2, y);
      }
      ctx.strokeStyle = rgba(pal.ink3, top ? 0.16 : 0.09);
      ctx.stroke();
    };

    // the two sheets that wait, then the one being drawn
    sheet(W * 0.07, -H * 0.1, 0.07, f.on(0.1, 0.4) * 0.8, false);
    ctx.restore();
    sheet(W * 0.035, -H * 0.05, 0.035, f.on(0.2, 0.4) * 0.9, false);
    ctx.restore();
    sheet(-lift * W * 0.9, -lift * H * 0.2, -0.02 - lift * 0.2, f.on(0.3, 0.4) * (1 - lift), true);

    // everything below is drawn in the top sheet's own space
    const d = f.still ? 1 : clamp(u / 0.8); // how much has been drawn
    let pen: { x: number; y: number } | null = null;
    /** one stroke of the drawing: it is made between `from` and `to` of the whole */
    const part = (from: number, to: number) => clamp((d - from) / (to - from));
    const stroke = (colour: string, width: number, alpha = 0.95) => {
      ctx.strokeStyle = rgba(colour, alpha);
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.stroke();
    };
    const seg = (x0: number, y0: number, x1: number, y1: number, q: number, colour: string, width = 1.6) => {
      if (q <= 0) return;
      const x = lerp(x0, x1, q);
      const y = lerp(y0, y1, q);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x, y);
      stroke(colour, width);
      if (q < 1) pen = { x, y };
    };

    // 1. the right angle: risk upright, reward along the base
    const ax = -W * 0.4;
    const ay = H * 0.3;
    const rise = H * 0.34;
    const run = W * 0.34;
    seg(ax, ay, ax, ay - rise, part(0, 0.1), pal.crimson, 2);
    seg(ax, ay, ax + run, ay, part(0.1, 0.22), pal.emerald, 2);
    seg(ax, ay - rise, ax + run, ay, part(0.22, 0.32), pal.ink, 1.4);
    // their dimension lines, with a tick at each end
    const dim = part(0.32, 0.4);
    if (dim > 0) {
      ctx.globalAlpha *= dim;
      ctx.beginPath();
      ctx.moveTo(ax - 12, ay);
      ctx.lineTo(ax - 12, ay - rise);
      ctx.moveTo(ax - 16, ay);
      ctx.lineTo(ax - 8, ay);
      ctx.moveTo(ax - 16, ay - rise);
      ctx.lineTo(ax - 8, ay - rise);
      ctx.moveTo(ax, ay + 12);
      ctx.lineTo(ax + run, ay + 12);
      ctx.moveTo(ax, ay + 8);
      ctx.lineTo(ax, ay + 16);
      ctx.moveTo(ax + run, ay + 8);
      ctx.lineTo(ax + run, ay + 16);
      stroke(pal.ink2, 1, 0.8);
      // the square in the corner
      ctx.strokeRect(ax, ay - 9, 9, 9);
      ctx.globalAlpha /= dim;
    }

    // 2. the compass: a circle, and the small share of it put at risk
    const ox = W * 0.24;
    const oy = -H * 0.14;
    const rad = H * 0.24;
    const sweep = part(0.4, 0.58);
    if (sweep > 0) {
      ctx.beginPath();
      ctx.arc(ox, oy, rad, -Math.PI / 2, -Math.PI / 2 + TAU * sweep);
      stroke(tone, 1.6);
      if (sweep < 1) pen = { x: ox + Math.cos(-Math.PI / 2 + TAU * sweep) * rad, y: oy + Math.sin(-Math.PI / 2 + TAU * sweep) * rad };
      // the compass leg
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(-Math.PI / 2 + TAU * sweep) * rad, oy + Math.sin(-Math.PI / 2 + TAU * sweep) * rad);
      stroke(pal.ink3, 1, 0.7 * (1 - smooth((sweep - 0.9) / 0.1)));
    }
    const wedge = part(0.58, 0.66);
    if (wedge > 0) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, rad, -Math.PI / 2, -Math.PI / 2 + 0.42 * wedge);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.crimson, 0.55);
      ctx.fill();
      stroke(pal.crimson, 1.2);
    }

    // 3. a scale of bars beneath the circle
    for (let i = 0; i < 9; i++) {
      const q = part(0.66 + i * 0.012, 0.7 + i * 0.012);
      if (q <= 0) continue;
      const bh = H * (0.04 + 0.012 * i);
      ctx.fillStyle = rgba(tone, 0.4 + 0.06 * i);
      ctx.fillRect(ox - rad + (i * rad * 2) / 9, H * 0.36 - bh * q, (rad * 2) / 9 - 3, bh * q);
    }

    // 4. the ruled lines of the method, top left
    for (let i = 0; i < 4; i++) {
      const y = -H * 0.36 + i * H * 0.07;
      seg(-W * 0.42, y, -W * 0.42 + W * [0.3, 0.38, 0.26, 0.34][i], y, part(0.8 + i * 0.04, 0.84 + i * 0.04), i === 0 ? tone : pal.ink2, i === 0 ? 3 : 2);
    }

    // the pencil: a point of light where the line is being made
    const tip = pen as { x: number; y: number } | null;
    if (tip && !f.still) {
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
      g.addColorStop(0, rgba(pal.key, 0.95));
      g.addColorStop(1, rgba(pal.key, 0));
      ctx.fillStyle = g;
      ctx.fillRect(tip.x - 14, tip.y - 14, 28, 28);
    }
    ctx.restore();

    // the glass
    if (f.hover > 0.05 && !f.mobile) {
      const gr = f.u * 0.42;
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.mx, f.my, gr, 0, TAU);
      ctx.clip();
      const shine = ctx.createRadialGradient(f.mx, f.my, 0, f.mx, f.my, gr);
      shine.addColorStop(0, rgba(pal.key, 0.16 * f.hover));
      shine.addColorStop(1, rgba(pal.key, 0.02 * f.hover));
      ctx.fillStyle = shine;
      ctx.fillRect(f.mx - gr, f.my - gr, gr * 2, gr * 2);
      const cell = W / 72;
      ctx.beginPath();
      for (let x = f.mx - gr - ((f.mx - gr) % cell); x < f.mx + gr; x += cell) {
        ctx.moveTo(x, f.my - gr);
        ctx.lineTo(x, f.my + gr);
      }
      for (let y = f.my - gr - ((f.my - gr) % cell); y < f.my + gr; y += cell) {
        ctx.moveTo(f.mx - gr, y);
        ctx.lineTo(f.mx + gr, y);
      }
      ctx.strokeStyle = rgba(pal.key, 0.2 * f.hover);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(f.mx, f.my, gr, 0, TAU);
      ctx.strokeStyle = rgba(pal.gold, 0.85 * f.hover);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },
};

export default scene;
