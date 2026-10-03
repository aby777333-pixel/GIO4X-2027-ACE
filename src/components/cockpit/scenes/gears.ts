/**
 * GEARS — the Engine Room, running.
 *
 * The room is about what goes on working once a trade is open, so its
 * instrument is an engine. Four gears in mesh turn one another, each the
 * other way and each at the speed its size allows. The last drives a crank,
 * the crank a piston in its cylinder, and with every stroke a counter on the
 * wall moves on by one: the clock that keeps running on a position whether
 * anyone is watching it or not. A belt carries the turning back to a
 * flywheel.
 *
 * The pointer is the throttle: further right, faster.
 *
 * A mechanism, not a measurement: the counter counts strokes.
 */
import { TAU, rgba, type Frame, type Scene } from "../engine";
import { rounded, stage } from "./_stage";

type Gear = { x: number; y: number; r: number; teeth: number; dir: number; tone: string };

type State = { angle: number };

const scene: Scene<State> = {
  pose: 2.4,
  setup() {
    return { angle: 0 };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const speed = 0.9 + f.hover * (0.4 + (f.px + 1) * 1.3);
    s.angle = f.still ? 2.1 : s.angle + f.dt * speed;
    const A = s.angle;
    const k = Math.min(R.w / 520, R.h / 310);

    // the gears: each meshes with the one before it
    const base: Gear = { x: R.x + R.w * 0.2, y: R.y + R.h * 0.6, r: 62 * k, teeth: 20, dir: 1, tone: pal.teal };
    const gears: Gear[] = [base];
    const add = (r: number, ang: number, tone: string) => {
      const p = gears[gears.length - 1];
      const d = p.r + r + 5 * k;
      gears.push({ x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, r, teeth: Math.round((r / p.r) * p.teeth), dir: -p.dir, tone });
    };
    add(38 * k, -0.62, pal.blue);
    add(50 * k, 0.42, pal.emerald);
    add(30 * k, -0.5, pal.gold);

    // the belt, from the first gear back to a flywheel
    const fly = { x: R.x + R.w * 0.1, y: R.y + R.h * 0.18, r: 24 * k };
    ctx.strokeStyle = rgba(pal.ink3, 0.6 * f.boot);
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -A * 30;
    ctx.beginPath();
    ctx.moveTo(base.x - base.r * 0.55, base.y);
    ctx.lineTo(fly.x - fly.r, fly.y);
    ctx.moveTo(base.x + base.r * 0.55, base.y);
    ctx.lineTo(fly.x + fly.r, fly.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(fly.x, fly.y, fly.r, 0, TAU);
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = A * 2.2 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.moveTo(fly.x, fly.y);
      ctx.lineTo(fly.x + Math.cos(a) * fly.r, fly.y + Math.sin(a) * fly.r);
      ctx.stroke();
    }

    gears.forEach((g, i) => {
      // a smaller gear turns faster, in proportion
      const turn = (A * g.dir * base.r) / g.r + (i % 2 ? Math.PI / g.teeth : 0);
      const on = f.on(0.15 + i * 0.15, 0.4);
      const near = f.hover > 0.2 && Math.hypot(f.mx - g.x, f.my - g.y) < g.r ? f.hover : 0;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(turn);
      ctx.globalAlpha = on;
      const th = 7 * k;
      ctx.beginPath();
      for (let t = 0; t < g.teeth; t++) {
        const a0 = (t / g.teeth) * TAU;
        const w = TAU / g.teeth;
        ctx.lineTo(Math.cos(a0) * g.r, Math.sin(a0) * g.r);
        ctx.lineTo(Math.cos(a0 + w * 0.18) * (g.r + th), Math.sin(a0 + w * 0.18) * (g.r + th));
        ctx.lineTo(Math.cos(a0 + w * 0.42) * (g.r + th), Math.sin(a0 + w * 0.42) * (g.r + th));
        ctx.lineTo(Math.cos(a0 + w * 0.6) * g.r, Math.sin(a0 + w * 0.6) * g.r);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.fill();
      ctx.fillStyle = rgba(g.tone, 0.14 + near * 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(g.tone, 0.95);
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // the spokes and the hub
      for (let sp = 0; sp < 5; sp++) {
        const a = (sp / 5) * TAU;
        ctx.strokeStyle = rgba(g.tone, 0.6);
        ctx.lineWidth = 3 * k;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * g.r * 0.2, Math.sin(a) * g.r * 0.2);
        ctx.lineTo(Math.cos(a) * g.r * 0.78, Math.sin(a) * g.r * 0.78);
        ctx.stroke();
      }
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(g.tone, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.2, 0, TAU);
      ctx.fillStyle = rgba(g.tone, 0.9);
      ctx.fill();
      ctx.restore();
    });

    // the crank on the last gear, and the piston it drives
    const last = gears[gears.length - 1];
    const turn = (A * last.dir * base.r) / last.r;
    const pin = { x: last.x + Math.cos(turn) * last.r * 0.62, y: last.y + Math.sin(turn) * last.r * 0.62 };
    const rod = R.w * 0.2;
    const cylY = last.y;
    const reach = Math.sqrt(Math.max(0, rod * rod - (pin.y - cylY) * (pin.y - cylY)));
    const headX = pin.x + reach;
    const cylX0 = last.x + rod - last.r * 0.62 - 6 * k;
    const cylW = last.r * 1.24 + 44 * k;
    const cylH = 34 * k;
    rounded(ctx, cylX0, cylY - cylH / 2, cylW, cylH, 3);
    ctx.fillStyle = rgba(pal.bg, 0.9);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // the charge in the cylinder: brightest when it is squeezed smallest
    const squeeze = (headX - (last.x + rod - last.r * 0.62)) / (last.r * 1.24);
    ctx.fillStyle = rgba(pal.gold, (0.12 + 0.5 * squeeze) * f.boot);
    ctx.fillRect(headX + 8 * k, cylY - cylH / 2 + 3, cylX0 + cylW - headX - 11 * k, cylH - 6);
    ctx.fillStyle = rgba(pal.ink, 0.85 * f.boot);
    ctx.fillRect(headX - 2 * k, cylY - cylH / 2 + 3, 10 * k, cylH - 6);
    ctx.strokeStyle = rgba(pal.ink, 0.9 * f.boot);
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(pin.x, pin.y);
    ctx.lineTo(headX, cylY);
    ctx.stroke();
    ctx.fillStyle = rgba(pal.gold, f.boot);
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 4 * k, 0, TAU);
    ctx.fill();

    // the counter: one for every stroke
    const strokes = Math.floor(Math.abs(turn) / TAU);
    const bx = R.x + R.w * 0.66;
    const by = R.y + R.h * 0.14;
    for (let d = 0; d < 5; d++) {
      const digit = Math.floor(strokes / Math.pow(10, 4 - d)) % 10;
      const x = bx + d * 24 * k;
      rounded(ctx, x, by, 20 * k, 30 * k, 2);
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.ink3, 0.8 * f.boot);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `600 ${Math.round(17 * k)}px ${pal.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(d === 4 ? pal.gold : pal.ink, 0.95 * f.boot);
      ctx.fillText(String(digit), x + 10 * k, by + 16 * k);
    }

    // the bed everything is bolted to
    const bed = R.y + R.h * 0.92;
    ctx.strokeStyle = rgba(pal.ink3, 0.6 * f.boot);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R.x + R.w * 0.04, bed);
    ctx.lineTo(R.x + R.w * 0.96, bed);
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const x = R.x + R.w * (0.05 + (i / 23) * 0.9);
      ctx.beginPath();
      ctx.moveTo(x, bed);
      ctx.lineTo(x - 6, bed + 6);
      ctx.stroke();
    }
  },
};

export default scene;
