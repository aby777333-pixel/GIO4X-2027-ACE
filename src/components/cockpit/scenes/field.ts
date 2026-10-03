/**
 * FIELD — Forces, as a field of force.
 *
 * Forces is about what pushes a price, so its instrument is a field. Two
 * poles stand on the stage, one that draws and one that drives away. Between
 * and around them a grid of small needles shows which way the push runs at
 * each place and how strong it is, as filings do round a magnet, and motes
 * are carried along the lines from the one pole to the other. The poles
 * drift, slowly, and the whole field turns with them.
 *
 * The pointer is a third pole. Wherever it goes the needles swing to it and
 * the motes are drawn off their course.
 *
 * A picture of a push and a pull. It is not a model of any market.
 */
import { TAU, clamp, rgba, type Frame, type Scene } from "../engine";
import { stage } from "./_stage";

const MOTES = 70;

type Mote = { x: number; y: number; age: number };
type State = { motes: Mote[] };

const scene: Scene<State> = {
  pose: 4,
  setup(f) {
    return { motes: Array.from({ length: MOTES }, (_, i) => ({ x: f.rnd(i * 2 + 7), y: f.rnd(i * 2 + 8), age: f.rnd(i + 500) })) };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const t = f.t;
    // the two poles, in the stage's own unit square
    const src = { x: 0.26 + Math.sin(t * 0.21) * 0.05, y: 0.5 + Math.cos(t * 0.27) * 0.16 };
    const snk = { x: 0.74 + Math.cos(t * 0.19) * 0.05, y: 0.5 + Math.sin(t * 0.24) * 0.16 };
    const hand = { x: (f.mx - R.x) / R.w, y: (f.my - R.y) / R.h };
    const aspect = R.w / R.h;
    /** the push at a place: away from the source, toward the sink, and toward the hand */
    const push = (x: number, y: number) => {
      let vx = 0;
      let vy = 0;
      const pole = (p: { x: number; y: number }, q: number) => {
        const dx = (x - p.x) * aspect;
        const dy = y - p.y;
        const d2 = dx * dx + dy * dy + 0.004;
        vx += (q * dx) / d2;
        vy += (q * dy) / d2;
      };
      pole(src, 1);
      pole(snk, -1);
      if (f.hover > 0.05) pole(hand, -1.2 * f.hover);
      return { vx, vy };
    };

    // the needles
    const cols = f.mobile ? 15 : 23;
    const rows = Math.max(7, Math.round(cols / aspect));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i + 0.5) / cols;
        const y = (j + 0.5) / rows;
        const v = push(x, y);
        const m = Math.hypot(v.vx, v.vy);
        const a = Math.atan2(v.vy, v.vx);
        const strong = clamp(m / 9);
        const len = (R.w / cols) * (0.28 + 0.34 * strong);
        const px = R.x + x * R.w;
        const py = R.y + y * R.h;
        const on = f.on(0.1 + (i / cols) * 0.6, 0.3);
        ctx.strokeStyle = rgba(strong > 0.5 ? pal.key : pal.ink2, (0.22 + 0.6 * strong) * on);
        ctx.lineWidth = 1 + strong * 0.8;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * len, py - Math.sin(a) * len);
        ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        ctx.stroke();
        // the head of the needle
        ctx.fillStyle = rgba(pal.teal, (0.3 + 0.6 * strong) * on);
        ctx.beginPath();
        ctx.arc(px + Math.cos(a) * len, py + Math.sin(a) * len, 1.3, 0, TAU);
        ctx.fill();
      }
    }

    // the motes, carried along the field
    for (const mote of s.motes) {
      if (!f.still) {
        const v = push(mote.x, mote.y);
        const m = Math.hypot(v.vx, v.vy) || 1;
        const stepSize = f.dt * 0.16;
        mote.x += ((v.vx / m) * stepSize) / aspect;
        mote.y += (v.vy / m) * stepSize;
        mote.age += f.dt * 0.22;
        const taken = Math.hypot((mote.x - snk.x) * aspect, mote.y - snk.y) < 0.03 || (f.hover > 0.3 && Math.hypot((mote.x - hand.x) * aspect, mote.y - hand.y) < 0.03);
        if (taken || mote.age > 1 || mote.x < 0 || mote.x > 1 || mote.y < 0 || mote.y > 1) {
          // a new mote leaves the source, in any direction
          const a = Math.random() * TAU;
          mote.x = src.x + (Math.cos(a) * 0.03) / aspect;
          mote.y = src.y + Math.sin(a) * 0.03;
          mote.age = 0;
        }
      }
      const px = R.x + mote.x * R.w;
      const py = R.y + mote.y * R.h;
      const alpha = Math.sin(clamp(mote.age) * Math.PI) * f.boot;
      ctx.fillStyle = rgba(pal.gold, 0.9 * alpha);
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, TAU);
      ctx.fill();
    }

    // the poles themselves
    const pole = (p: { x: number; y: number }, tone: string, out: boolean) => {
      const px = R.x + p.x * R.w;
      const py = R.y + p.y * R.h;
      const r = Math.min(R.w, R.h) * 0.05;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, rgba(tone, 0.55 * f.boot));
      g.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 4, 0, TAU);
      ctx.fill();
      // rings that leave the source and close on the sink
      for (let i = 0; i < 3; i++) {
        const q = f.still ? (i + 0.5) / 3 : (t * 0.5 + i / 3) % 1;
        const rr = r * (out ? 1 + q * 2.6 : 3.6 - q * 2.6);
        ctx.strokeStyle = rgba(tone, (out ? 1 - q : q) * 0.7 * f.boot);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(pal.bg, 0.95);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(tone, 0.95 * f.boot);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // a plus on the one, a minus on the other
      ctx.beginPath();
      ctx.moveTo(px - r * 0.45, py);
      ctx.lineTo(px + r * 0.45, py);
      if (out) {
        ctx.moveTo(px, py - r * 0.45);
        ctx.lineTo(px, py + r * 0.45);
      }
      ctx.stroke();
    };
    pole(src, pal.emerald, true);
    pole(snk, pal.crimson, false);
    if (f.hover > 0.05 && !f.mobile) {
      ctx.strokeStyle = rgba(pal.gold, 0.9 * f.hover);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(f.mx, f.my, 10 + Math.sin(t * 4) * 2, 0, TAU);
      ctx.stroke();
    }
  },
};

export default scene;
