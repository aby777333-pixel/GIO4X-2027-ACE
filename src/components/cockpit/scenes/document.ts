/**
 * DOCUMENT — the instrument of record.
 *
 * GIO4X publishes five legal documents. They stand here as five sheets of glass,
 * one behind the other and fanned a few degrees about their left edge, each with
 * an index tab at a fixed height: TERMS, RISK DISCLOSURE, PRIVACY, AML POLICY,
 * COOKIES. The page's own document is the front sheet, and its tab is the one in
 * champagne. The front sheet carries engraved rules that draw in line by line:
 * a title, clauses with a numbered margin, a closing block and a signature rule,
 * then the seal is struck at the lower right. A slow sheen crosses the glass and
 * the engraving catches it. No words are written: a rule is a drawing of a line.
 */
import { TAU, clamp, easeInOut, easeOut, rgba, type Frame, type Scene, type V3 } from "../engine";
import { deck, panel, pool, trace, type Panel } from "../kit";

const DOCS: readonly (readonly [string, string])[] = [
  ["terms", "TERMS"],
  ["risk", "RISK DISCLOSURE"],
  ["privacy", "PRIVACY"],
  ["aml", "AML POLICY"],
  ["cookies", "COOKIES"],
];
const N = DOCS.length;
const FLOOR = -1.3;
/** one sheet, portrait, in the proportion of a page */
const W = 1.3;
const H = 1.84;
/** the hinge of the front sheet (its left edge) and its centre height */
const X0 = -0.72;
const Y0 = -0.14;
const Z0 = -0.3;
/** each sheet behind: a little further, a little higher, a few degrees more open */
const STEP: V3 = [0.035, 0.085, 0.13];
const FAN = 0.045;
/** the thickness of a sheet */
const THICK = 0.045;
/** the seal, in the front sheet's own 0..1 space, and its radius in world units */
const SEAL_U = 0.745;
const SEAL_V = 0.168;
const SEAL_R = 0.2;
/** how far across the sheet's diagonal a point (u, v) lies: the sheen travels along it */
const DU = (W * W) / (W * W + H * H);
/** the rosette: eight arcs, each about a centre this far out, of this radius, over this half-angle; they interlace as guilloche does */
const ROSE: V3 = [0.3, 0.26, 1.75];
/** where the seal lies along the sheen's path */
const SEAL_D = DU * SEAL_U + (1 - DU) * (1 - SEAL_V);
/** engraving is letterspaced */
const THIN = String.fromCharCode(0x2009);

type Rule = { v: number; words: [number, number][]; head: boolean; weight: number };
type State = { rules: Rule[]; first: number; focus: number };

/** paragraph shapes: three clauses of three to five lines, twelve lines in all */
const SHAPES = [
  [4, 5, 3],
  [5, 4, 3],
  [3, 5, 4],
  [4, 4, 4],
  [5, 3, 4],
  [3, 4, 5],
];

/** one sheet's pose in the fan; `open` is how far the fan has opened */
function pose(k: number, open: number): { c: V3; yaw: number } {
  const yaw = -k * FAN * open;
  const hx = X0 + k * STEP[0] * open;
  const hz = Z0 + k * (0.02 + (STEP[2] - 0.02) * open);
  return { c: [hx + (W / 2) * Math.cos(yaw), Y0 + k * STEP[1] * open, hz - (W / 2) * Math.sin(yaw)], yaw };
}

/** many fine segments in one stroke */
function strokes(f: Frame, segs: readonly (readonly [V3, V3])[], colour: string, alpha: number, width: number): void {
  if (alpha <= 0.003 || !segs.length) return;
  const { ctx } = f;
  ctx.beginPath();
  for (const s of segs) {
    const a = f.P(s[0][0], s[0][1], s[0][2]);
    const b = f.P(s[1][0], s[1][1], s[1][2]);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

/** the plinth: a machined slab seen from above and from the right, solid, with a lit leading edge */
function slab(f: Frame, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, level: number): void {
  const { pal } = f;
  const top: V3[] = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const face: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
  const side: V3[] = [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]];
  for (const q of [top, side, face]) f.fill(q, pal.bg, 0.9 * level);
  f.fill(top, pal.ink, 0.07 * level);
  f.fill(side, pal.ink, 0.025 * level);
  f.fill(face, pal.ink, 0.045 * level);
  f.path(top, pal.ink, 0.2 * level, 1, true);
  f.path([face[0], face[1], side[1], side[2]], pal.ink, 0.14 * level, 1);
  f.line(face[1], face[2], pal.ink, 0.14 * level, 1);
  f.line(face[3], face[2], pal.key, 0.5 * level, 1.25);
  f.line(side[3], side[2], pal.key, 0.26 * level, 1);
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    let n = 0;
    const rnd = () => f.rnd(40 + n++);
    const words = (u0: number, u1: number): [number, number][] => {
      if (f.mobile) return [[u0, u1]];
      const out: [number, number][] = [];
      let u = u0;
      while (u < u1 - 0.035) {
        const end = Math.min(u1, u + 0.05 + rnd() * 0.12);
        out.push([u, u1 - end < 0.035 ? u1 : end]);
        u = end + 0.024;
      }
      return out;
    };
    const rules: Rule[] = [
      { v: 0.826, words: [[0.09, 0.5 + rnd() * 0.12]], head: false, weight: 2 },
      { v: 0.79, words: [[0.09, 0.3 + rnd() * 0.08]], head: false, weight: 1 },
    ];
    const shape = SHAPES[Math.floor(f.rnd(9) * SHAPES.length) % SHAPES.length];
    let v = 0.725;
    for (const lines of shape) {
      for (let j = 0; j < lines; j++) {
        const last = j === lines - 1;
        rules.push({ v, words: words(0.24, 0.24 + 0.67 * (last ? 0.3 + rnd() * 0.35 : 0.88 + rnd() * 0.12)), head: j === 0, weight: 1 });
        v -= 0.034;
      }
      v -= 0.028;
    }
    // the closing block keeps clear of the seal
    for (let j = 0; j < 3; j++) {
      rules.push({ v, words: words(0.24, 0.24 + 0.29 * (j === 2 ? 0.55 : 0.86 + rnd() * 0.14)), head: j === 0, weight: 1 });
      v -= 0.034;
    }
    const focus = DOCS.findIndex((d) => d[0] === f.tag);
    return { rules, first: focus < 0 ? 0 : focus, focus };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const sway = f.still ? 0 : Math.sin(f.t * 0.09) * 0.035;
    f.aim(0.3 + sway + (f.rnd(3) - 0.5) * 0.05, 0.1, 6.4, f.mobile ? 0.76 : 0.95);
    // a tall subject: it sits a little high, and on a narrow desktop it gives the headline more room
    f.cy -= f.h * (f.mobile ? 0.11 : 0.022);
    if (!f.mobile) f.cx += clamp((1280 - f.w) / 560) * f.u * 0.3;
    const roomy = f.w >= 960;

    // power-on: the sheets rise as one, the fan opens, the text is written, the seal is struck
    const open = easeInOut((f.boot - 0.2) / 0.7);
    const write = f.still ? 1 : clamp((f.t - 0.55) / 1.5);
    const struck = f.still ? 1 : clamp((f.t - 1.95) / 0.85);

    deck(f, { y: FLOOR, alpha: 0.12 });
    pool(f, [0.05, FLOOR, 0], 2.4, pal.key, 0.24 * f.boot);
    // the plinth, with one lit slot under each sheet: the fan in plan
    const top = FLOOR + 0.09;
    slab(f, X0 - 0.09, X0 + W + 0.2, Z0 - 0.11, Z0 + 0.86, FLOOR, top, f.boot);
    for (let k = N - 1; k >= 0; k--) {
      const { c, yaw } = pose(k, open);
      const dx = (W / 2) * Math.cos(yaw);
      const dz = (W / 2) * Math.sin(yaw);
      trace(f, [[c[0] - dx, top, c[2] + dz], [c[0] + dx, top, c[2] - dz]], pal.key, (0.6 - k * 0.09) * f.on(0.05 * k, 0.3), 1);
    }

    // index tabs keep fixed places down the right edge as the viewer sees it, whichever sheet carries them
    const tabs: { d: number; p: V3 }[] = [];
    const tab = (p: Panel, k: number, d: number): void => {
      const lit = d === s.focus;
      const slot = f.P(X0 + W, Y0 + (0.37 - d * 0.068) * H, Z0);
      const foot = f.P(...p.at(1, 0));
      const head = f.P(...p.at(1, 1));
      if (!slot || !foot || !head) return;
      const tv = (slot.y - foot.y) / (head.y - foot.y);
      const du = 0.08 / W;
      const dv = 0.045 / H;
      const pts: V3[] = [p.at(1, tv + dv), p.at(1 + du * 0.7, tv + dv), p.at(1 + du, tv + dv * 0.45), p.at(1 + du, tv - dv * 0.45), p.at(1 + du * 0.7, tv - dv), p.at(1, tv - dv)];
      f.fill(pts, pal.bg, 0.6 * p.on);
      f.fill(pts, lit ? pal.gold : pal.ink, (lit ? 0.16 : 0.06) * p.on);
      f.path(pts, lit ? pal.gold : pal.ink, (lit ? 0.85 : 0.3 - k * 0.03) * p.on, lit ? 1.25 : 1);
      if (!lit) f.line(pts[0], pts[1], pal.key, (0.55 - k * 0.07) * p.on, 1.25);
      if (lit) f.glow(p.at(1 + du * 0.5, tv), 0.16, pal.gold, 0.22 * p.on);
      tabs.push({ d, p: p.at(1 + du, tv) });
    };

    // the sheets behind, furthest first
    let front: Panel | null = null;
    for (let k = N - 1; k >= 0; k--) {
      const { c, yaw } = pose(k, open);
      // the front sheet is the thickest glass: less of the stack shows through it
      const on = f.on(0.05 * k, 0.3);
      if (!k) {
        const y0 = c[1] - H / 2 - (1 - on) * 0.18;
        f.fill([[c[0] - W / 2, y0, c[2]], [c[0] + W / 2, y0, c[2]], [c[0] + W / 2, y0 + H, c[2]], [c[0] - W / 2, y0 + H, c[2]]], pal.bg, 0.42 * on);
      }
      const p = panel(f, c, W, H, { yaw, on, colour: pal.key, alpha: k ? 0.5 - k * 0.07 : 0.62, glass: k ? 0.028 : 0.045 });
      if (p.on <= 0) continue;
      // the right edge faces the viewer: the glass shows its thickness there, and the edge carries light
      f.fill([p.at(1, 0), p.at(1, 1), p.at(1, 1, -THICK), p.at(1, 0, -THICK)], pal.key, (0.3 - k * 0.045) * p.on);
      f.line(p.at(1, 0), p.at(1, 1), pal.ink, (0.4 - k * 0.06) * p.on, 1);
      tab(p, k, (s.first + k) % N);
      if (!k) front = p;
    }
    if (!front) return;
    const p = front;

    // ── the front sheet: title rule, clauses, margin
    const n = s.rules.length;
    const sheenAt = f.still ? 0.56 : f.t < 3.4 ? -1 : (((f.t - 3.4) % 19) / 10) * 1.5 - 0.25;
    const body: [V3, V3][] = [];
    const strong: [V3, V3][] = [];
    const heads: [V3, V3][] = [];
    const marks: [V3, V3][] = [];
    const soft: [V3, V3][] = [];
    const lit: [V3, V3][] = [];
    const key = easeOut(write * 6);
    f.line(p.at(0.09, 0.878), p.at(0.09 + 0.82 * key, 0.878), pal.key, 0.6 * p.on, 1.25);
    s.rules.forEach((r, i) => {
      const on = easeOut((write * (n + 2) - i) / 2);
      if (on <= 0) return;
      const u0 = r.words[0][0];
      const reach = u0 + (r.words[r.words.length - 1][1] - u0) * on;
      // where the sheen crosses this line
      const uc = (sheenAt - (1 - DU) * (1 - r.v)) / DU;
      for (const w of r.words) {
        if (w[0] >= reach) break;
        const b = Math.min(w[1], reach);
        (r.weight > 1 ? strong : body).push([p.at(w[0], r.v), p.at(b, r.v)]);
        if (sheenAt <= -1) continue;
        // the engraving catches the light: a wide soft lift, a narrower bright one
        for (let h = 0; h < 2; h++) {
          const a1 = Math.max(w[0], uc - (h ? 0.1 : 0.26));
          const b1 = Math.min(b, uc + (h ? 0.1 : 0.26));
          if (a1 < b1) (h ? lit : soft).push([p.at(a1, r.v), p.at(b1, r.v)]);
        }
      }
      if (i > 1) {
        if (r.head) heads.push([p.at(0.1, r.v), p.at(0.155, r.v)]);
        else marks.push([p.at(0.166, r.v), p.at(0.18, r.v)]);
      }
    });
    const w1 = f.mobile ? 1 : 1.25;
    f.line(p.at(0.2, 0.75), p.at(0.2, 0.75 - 0.68 * write), pal.ink, 0.13 * p.on, 1);
    strokes(f, marks, pal.ink, 0.22 * p.on, 1);
    strokes(f, body, pal.ink, 0.4 * p.on, w1);
    strokes(f, strong, pal.ink, 0.82 * p.on, 2);
    strokes(f, heads, pal.key, 0.8 * p.on, 1.5);
    strokes(f, soft, pal.ink, 0.2 * p.on, w1);
    strokes(f, lit, pal.ink, 0.3 * p.on, w1);
    // the signature rule, left of the seal
    const sign = easeOut((write - 0.92) / 0.08);
    f.line(p.at(0.24, 0.09), p.at(0.24 + 0.29 * sign, 0.09), pal.ink, 0.55 * p.on, 1);

    // ── light in the glass: the edges glow where the plinth and the key light reach them,
    //    and one band of sheen crosses the sheet, corner to corner
    const corners = [p.at(0, 0), p.at(1, 0), p.at(1, 1), p.at(0, 1)].map((q) => f.P(q[0], q[1], q[2]));
    const foot = f.P(...p.at(0.5, 0));
    const head = f.P(...p.at(0.5, 1));
    if (foot && head && corners.every((q) => q)) {
      ctx.save();
      ctx.beginPath();
      corners.forEach((q, i) => (q ? (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)) : 0));
      ctx.closePath();
      ctx.clip();
      const edge = ctx.createLinearGradient(foot.x, foot.y, head.x, head.y);
      edge.addColorStop(0, rgba(pal.key, 0.15 * p.on));
      edge.addColorStop(0.2, rgba(pal.key, 0.025 * p.on));
      edge.addColorStop(0.62, rgba(pal.key, 0));
      edge.addColorStop(1, rgba(pal.key, 0.09 * p.on));
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, f.w, f.h);
      if (sheenAt > -0.2 && sheenAt < 1.2 && corners[3] && corners[1]) {
        const g = ctx.createLinearGradient(corners[3].x, corners[3].y, corners[1].x, corners[1].y);
        g.addColorStop(clamp(sheenAt - 0.17), rgba(pal.ink, 0));
        g.addColorStop(clamp(sheenAt), rgba(pal.ink, 0.085));
        g.addColorStop(clamp(sheenAt + 0.09), rgba(pal.ink, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, f.w, f.h);
      }
      ctx.restore();
    }

    // ── the seal: two rings, fine radial ticks between them, a rosette of eight arcs
    if (struck > 0) {
      const rot = f.rnd(5) * TAU;
      const at = (a: number, r: number): V3 => p.at(SEAL_U + (Math.cos(a + rot) * r * SEAL_R) / W, SEAL_V + (Math.sin(a + rot) * r * SEAL_R) / H, 0.014);
      const breathe = f.still ? 1 : 0.9 + 0.1 * Math.sin(f.t * 0.6);
      // the gold answers the sheen as it passes over
      const caught = Math.exp(-Math.pow((sheenAt - SEAL_D) / 0.13, 2));
      const level = struck * breathe * p.on * (1 + 0.45 * caught);
      const sweep = easeInOut(struck / 0.6);
      const seg = Math.round((f.mobile ? 36 : 56) * f.q);
      const outer: V3[] = [];
      const inner: V3[] = [];
      for (let i = 0; i <= Math.round(seg * sweep); i++) {
        outer.push(at((i / seg) * TAU, 1));
        inner.push(at(-(i / seg) * TAU, 0.74));
      }
      f.glow(at(0, 0), SEAL_R * 1.7, pal.gold, 0.1 * level);
      if (sweep >= 1) f.fill(outer, pal.gold, 0.05 * level);
      f.path(outer, pal.gold, 0.62 * level, 1.25);
      f.path(inner, pal.gold, 0.42 * level, 1);
      // the rim catches the key light on its upper left
      if (sweep >= 1) {
        const rim: V3[] = [];
        for (let i = 0; i <= 8; i++) rim.push(at(1.75 + i * 0.13 - rot, 1));
        f.path(rim, pal.ink, 0.5 * level, 1.25);
      }
      const count = Math.round((f.mobile ? 32 : 64) * f.q);
      const ticks: [V3, V3][] = [];
      for (let i = 0; i < Math.round(count * sweep); i++) {
        const a = (i / count) * TAU;
        ticks.push([at(a, i % 8 ? 0.8 : 0.77), at(a, 0.94)]);
      }
      strokes(f, ticks, pal.gold, 0.4 * level, 1);
      // the rosette opens petal by petal once the rings have closed
      const petals = Math.ceil(clamp((struck - 0.5) / 0.5) * 8);
      const rose: [V3, V3][] = [];
      const steps = f.mobile ? 6 : 10;
      for (let k = 0; k < petals; k++) {
        const a = (k / 8) * TAU;
        let prev: V3 | null = null;
        for (let j = 0; j <= steps; j++) {
          const b = a - ROSE[2] + (2 * ROSE[2] * j) / steps;
          const x = Math.cos(a) * ROSE[0] + Math.cos(b) * ROSE[1];
          const y = Math.sin(a) * ROSE[0] + Math.sin(b) * ROSE[1];
          const q = at(Math.atan2(y, x), Math.hypot(x, y));
          if (prev) rose.push([prev, q]);
          prev = q;
        }
      }
      strokes(f, rose, pal.gold, 0.6 * level, 1);
      f.dot(at(0, 0), 0.011, pal.gold, 0.9 * level);
    }

    // ── lettering: the document's name on the sheet, the register beside the tabs
    const name = s.focus < 0 ? "LEGAL" : DOCS[s.focus][1];
    const n0 = f.P(...p.at(0.09, 0.925));
    const n1 = f.P(...p.at(0.6, 0.925));
    if (n0 && n1) {
      // the name is engraved in the sheet, so it runs with the sheet's own lines
      ctx.save();
      ctx.translate(n0.x, n0.y);
      ctx.rotate(Math.atan2(n1.y - n0.y, n1.x - n0.x));
      ctx.translate(-n0.x, -n0.y);
      f.label(name.split("").join(THIN), p.at(0.09, 0.925), { size: f.mobile ? 9 : 11, colour: s.focus < 0 ? pal.ink : pal.gold, alpha: 0.92 * f.on(0.5, 0.4), weight: 600 });
      ctx.restore();
    }
    if (roomy) {
      const shown = f.on(0.85, 0.3);
      let col = 0;
      const pts = tabs.map((t) => ({ d: t.d, q: f.P(t.p[0], t.p[1], t.p[2]) }));
      for (const t of pts) if (t.q) col = Math.max(col, t.q.x);
      col += 18;
      ctx.beginPath();
      for (const t of pts) {
        if (!t.q) continue;
        ctx.moveTo(t.q.x + 4, t.q.y);
        ctx.lineTo(col - 6, t.q.y);
      }
      ctx.strokeStyle = rgba(pal.ink, 0.16 * shown);
      ctx.lineWidth = 1;
      ctx.stroke();
      tabs.forEach((t, i) => {
        const q = pts[i].q;
        if (!q) return;
        const lit = t.d === s.focus;
        f.label(DOCS[t.d][1], t.p, { dx: col - q.x, size: 9, colour: lit ? pal.gold : pal.ink2, alpha: (lit ? 0.95 : 0.66) * shown });
      });
    }
  },
};

export default scene;
