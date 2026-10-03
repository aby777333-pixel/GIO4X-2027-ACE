/**
 * MIND — the Mind Room, thinking.
 *
 * The room is about the person in front of the screen, so its instrument is
 * a mind at work: a head in profile, and inside it a web of points joined to
 * their neighbours. Thoughts travel the web as points of light. Most are
 * cool and take their time. Now and then an impulse starts at the back of
 * the head, red, and runs the web much faster than the rest, lighting every
 * point it passes; then it is spent and the web is calm again. Two small
 * pans hang before the face: the cool one and the quick one, weighed.
 *
 * The pointer is a distraction: the points near it flare, and impulses are
 * set off more often while it is there.
 *
 * A picture, not a claim about anyone's brain.
 */
import { TAU, clamp, lerp, rgba, type Frame, type Scene } from "../engine";
import { stage } from "./_stage";

const NODES = 46;

type Node = { x: number; y: number; links: number[] };
type State = { nodes: Node[] };

/** is a point, in the head's unit square, inside the skull? */
const inside = (x: number, y: number) => {
  const a = (x - 0.46) / 0.36;
  const b = (y - 0.42) / 0.34;
  return a * a + b * b < 1 && !(x > 0.6 && y > 0.62);
};

const scene: Scene<State> = {
  pose: 2.2,
  setup(f) {
    const nodes: Node[] = [];
    for (let i = 0; nodes.length < NODES && i < 900; i++) {
      const x = 0.08 + f.rnd(i * 2 + 1) * 0.76;
      const y = 0.06 + f.rnd(i * 2 + 2) * 0.72;
      if (!inside(x, y)) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 0.07)) continue;
      nodes.push({ x, y, links: [] });
    }
    // each point is joined to its three nearest
    nodes.forEach((n, i) => {
      n.links = nodes
        .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .map((o) => o.j);
    });
    return { nodes };
  },
  draw(f: Frame, s: State) {
    const { ctx, pal } = f;
    const R = stage(f);
    const side = Math.min(R.w * 0.62, R.h * 1.02);
    const ox = R.x + R.w * 0.42 - side / 2;
    const oy = R.y + (R.h - side) / 2 + side * 0.04;
    const X = (x: number) => ox + x * side;
    const Y = (y: number) => oy + y * side;
    const t = f.t;

    // an impulse: it starts at the back of the head and its front sweeps forward
    const every = f.hover > 0.3 ? 2.6 : 5;
    const k = Math.floor(t / every);
    const since = t - k * every;
    const front = f.still ? 0.45 : since * 0.7; // how far the front has travelled, in head widths
    const live = f.still ? 0.8 : clamp(1 - since / 1.6);

    // the head in profile, facing right
    ctx.beginPath();
    ctx.moveTo(X(0.34), Y(0.98));
    ctx.bezierCurveTo(X(0.34), Y(0.84), X(0.2), Y(0.8), X(0.14), Y(0.62));
    ctx.bezierCurveTo(X(0.02), Y(0.3), X(0.22), Y(0.04), X(0.5), Y(0.05));
    ctx.bezierCurveTo(X(0.74), Y(0.06), X(0.86), Y(0.24), X(0.84), Y(0.42));
    ctx.lineTo(X(0.92), Y(0.56)); // the nose
    ctx.lineTo(X(0.84), Y(0.6));
    ctx.lineTo(X(0.85), Y(0.68)); // the lips
    ctx.lineTo(X(0.82), Y(0.71));
    ctx.bezierCurveTo(X(0.84), Y(0.82), X(0.78), Y(0.86), X(0.64), Y(0.84)); // the chin and jaw
    ctx.lineTo(X(0.62), Y(0.98));
    const skin = ctx.createLinearGradient(X(0), Y(0), X(1), Y(1));
    skin.addColorStop(0, rgba(pal.blue, 0.14 * f.boot));
    skin.addColorStop(1, rgba(pal.teal, 0.05 * f.boot));
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink2, 0.8 * f.boot);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // the web
    const lit = (n: Node) => {
      const d = Math.abs(Math.hypot(n.x - 0.12, n.y - 0.5) - front);
      const wave = clamp(1 - d / 0.09) * live;
      const near = f.hover > 0.1 ? clamp(1 - Math.hypot(X(n.x) - f.mx, Y(n.y) - f.my) / (side * 0.2)) * f.hover : 0;
      return { wave, near };
    };
    ctx.lineWidth = 1;
    s.nodes.forEach((n, i) => {
      const a = lit(n);
      for (const j of n.links) {
        if (j < i && s.nodes[j].links.includes(i)) continue; // draw a tie once
        const m = s.nodes[j];
        const b = lit(m);
        const hot = Math.max(a.wave, b.wave);
        ctx.strokeStyle = rgba(hot > 0.1 ? pal.crimson : pal.ink2, (0.22 + hot * 0.7 + Math.max(a.near, b.near) * 0.4) * f.on(0.3, 0.5));
        ctx.beginPath();
        ctx.moveTo(X(n.x), Y(n.y));
        ctx.lineTo(X(m.x), Y(m.y));
        ctx.stroke();
      }
    });
    // cool thoughts: a point of light walking each third tie
    if (!f.still) {
      s.nodes.forEach((n, i) => {
        if (i % 3) return;
        const m = s.nodes[n.links[i % n.links.length]];
        const q = (t * (0.22 + (i % 5) * 0.03) + i * 0.37) % 1;
        ctx.fillStyle = rgba(pal.teal, Math.sin(q * Math.PI) * 0.95);
        ctx.beginPath();
        ctx.arc(lerp(X(n.x), X(m.x), q), lerp(Y(n.y), Y(m.y), q), 2, 0, TAU);
        ctx.fill();
      });
    }
    s.nodes.forEach((n, i) => {
      const a = lit(n);
      const on = f.on(0.2 + (i / NODES) * 0.5, 0.3);
      const r = 2 + a.wave * 3 + a.near * 2.5;
      const tone = a.wave > 0.1 ? pal.crimson : a.near > 0.1 ? pal.gold : pal.teal;
      if (a.wave > 0.1 || a.near > 0.1) {
        const g = ctx.createRadialGradient(X(n.x), Y(n.y), 0, X(n.x), Y(n.y), r * 5);
        g.addColorStop(0, rgba(tone, 0.6 * on));
        g.addColorStop(1, rgba(tone, 0));
        ctx.fillStyle = g;
        ctx.fillRect(X(n.x) - r * 5, Y(n.y) - r * 5, r * 10, r * 10);
      }
      ctx.fillStyle = rgba(tone, 0.95 * on);
      ctx.beginPath();
      ctx.arc(X(n.x), Y(n.y), r, 0, TAU);
      ctx.fill();
    });

    // the two pans before the face: the cool and the quick, weighed
    const bx = R.x + R.w * 0.83;
    const byy = R.y + R.h * 0.34;
    const arm = Math.min(R.w * 0.11, R.h * 0.22);
    const tip = f.still ? 0.16 : (live - 0.25) * 0.42 + Math.sin(t * 1.3) * 0.04; // the quick pan drops while an impulse runs
    ctx.strokeStyle = rgba(pal.ink2, 0.85 * f.boot);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bx, byy - arm * 0.3);
    ctx.lineTo(bx, byy + arm * 1.7);
    ctx.moveTo(bx - arm * 0.5, byy + arm * 1.7);
    ctx.lineTo(bx + arm * 0.5, byy + arm * 1.7);
    ctx.moveTo(bx - Math.cos(tip) * arm, byy + Math.sin(tip) * arm * -1);
    ctx.lineTo(bx + Math.cos(tip) * arm, byy + Math.sin(tip) * arm);
    ctx.stroke();
    [
      [-1, pal.teal],
      [1, pal.crimson],
    ].forEach(([side2, tone]) => {
      const sgn = side2 as number;
      const px = bx + sgn * Math.cos(tip) * arm;
      const py = byy + sgn * Math.sin(tip) * arm;
      const drop = arm * 0.6;
      ctx.strokeStyle = rgba(pal.ink3, 0.8 * f.boot);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - arm * 0.3, py + drop);
      ctx.moveTo(px, py);
      ctx.lineTo(px + arm * 0.3, py + drop);
      ctx.stroke();
      ctx.strokeStyle = rgba(tone as string, 0.95 * f.boot);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py + drop, arm * 0.3, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = rgba(tone as string, (sgn > 0 ? 0.25 + live * 0.7 : 0.7) * f.boot);
      ctx.beginPath();
      ctx.arc(px, py + drop + arm * 0.1, arm * (sgn > 0 ? 0.1 + live * 0.08 : 0.13), 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = rgba(pal.gold, f.boot);
    ctx.beginPath();
    ctx.arc(bx, byy, 3, 0, TAU);
    ctx.fill();
  },
};

export default scene;
