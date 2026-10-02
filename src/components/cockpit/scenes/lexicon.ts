/**
 * LEXICON — the index wheel.
 *
 * A machined rotary selector lies tilted toward the reader with the alphabet
 * engraved round its rim. A fixed index (a champagne pointer, a glass reading
 * window and a lamp) marks the letter being looked up, and in the well of the
 * wheel stands a short file of glass index cards: an initial and a few ruled
 * lines, which is all a definition is before it is read.
 *
 * On a term's page the wheel turns until that term's first letter sits at the
 * index and stays there; on the glossary, FAQ and search pages it turns very
 * slowly through the alphabet. Nothing here is data: twenty-six letters, lit.
 */
import { TAU, clamp, lerp, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, ringPoint, trace } from "../kit";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STEP = 1 / 26;
/** the turn of the wheel that faces the reader, where the index is fixed */
const FRONT = 0.75;
/** rim, inner edge and lettering circle of the band; depth of its wall and of the well */
const R1 = 1.38;
const R0 = 1.0;
const RL = 1.185;
const WALL = 0.11;
const WELL = 0.07;
/** the wheel's centre height and how far it leans toward the reader */
const CY = 0.1;
const TILT = 0.7;
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
/** an index card */
const CW = 1.04;
const CH = 0.6;

/** wheel space to world: x across, z toward the back of the wheel, h off its face */
const flat = (x: number, z: number, h = 0): V3 => [x, CY + z * ST + h * CT, z * CT - h * ST];
const at = (r: number, turn: number, h = 0): V3 => {
  const p = ringPoint([0, 0, 0], r, turn);
  return flat(p[0], p[2], h);
};
const sweep = (r: number, from: number, to: number, h: number, n: number): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) out.push(at(r, lerp(from, to, i / n), h));
  return out;
};

/** many short marks in one stroke (graduations, knurling) */
function marks(f: Frame, colour: string, alpha: number, each: (mark: (a: V3, b: V3) => void) => void): void {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  each((a, b) => {
    const p = f.P(a[0], a[1], a[2]);
    const q = f.P(b[0], b[1], b[2]);
    if (!p || !q) return;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  });
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/**
 * Lettering that lies in a surface instead of facing the screen: `right` and
 * `down` are points a distance `e` from `c` along the reading direction and
 * toward the foot of the letter. `size` is the cap height in world units;
 * `light` sets it in the headline's thin display face.
 */
function engrave(f: Frame, text: string, c: V3, right: V3, down: V3, e: number, size: number, colour: string, alpha: number, light = false): void {
  const p = f.P(c[0], c[1], c[2]);
  const r = f.P(right[0], right[1], right[2]);
  const d = f.P(down[0], down[1], down[2]);
  if (!p || !r || !d || alpha <= 0.01) return;
  const k = 1 / (e * f.u);
  const ax = (r.x - p.x) * k;
  const ay = (r.y - p.y) * k;
  const bx = (d.x - p.x) * k;
  const by = (d.y - p.y) * k;
  const { ctx } = f;
  ctx.save();
  ctx.transform(ax, ay, bx, by, p.x - ax * p.x - bx * p.y, p.y - ay * p.x - by * p.y);
  f.label(text, c, { size: size * f.u * 1.38, colour, alpha, align: "center", weight: light ? 300 : 600, display: light });
  ctx.restore();
}

type Part = "outer" | "inner" | "bevel" | "band" | "hub" | "wall" | "well" | "foot" | "lit" | "cursor";
type State = Record<Part, V3[]> & { sheen: V3[][]; rules: number[][]; first: number };

const scene: Scene<State> = {
  pose: 14,
  setup(f) {
    const n = Math.round((f.mobile ? 60 : 96) * f.q);
    const half = n >> 1;
    const outer = sweep(R1, 0, 1, 0, n);
    const inner = sweep(R0, 0, 1, 0, n);
    const foot = sweep(R1, 1, 0.5, -WALL, half);
    // brushed metal: two fixed fans of reflected light that the wheel turns under
    const sheen: V3[][] = [];
    for (const c of [FRONT + 0.12, FRONT - 0.38])
      for (let i = 0; i < 8; i++) {
        const w = 0.14 * Math.pow(1 - i / 8, 1.3);
        sheen.push([...sweep(R1 - 0.03, c - w, c + w, 0, 8), ...sweep(R0 + 0.03, c + w, c - w, 0, 8)]);
      }
    const stride = f.mobile ? 2 : 1;
    const win = STEP * (f.mobile ? 0.8 : 0.56);
    return {
      outer,
      inner,
      bevel: sweep(R1 - 0.03, 0, 1, 0, n),
      band: [...outer, ...inner.slice().reverse()],
      hub: sweep(R0, 0, 1, -WELL, n),
      wall: [...sweep(R1, 0.5, 1, 0, half), ...foot],
      well: [...sweep(R0, 0, 0.5, 0, half), ...sweep(R0, 0.5, 0, -WELL, half)],
      foot,
      lit: sweep(R1, 0.54, 0.96, 0, Math.round(half * 0.84)),
      cursor: [...sweep(R1 - 0.02, FRONT - win, FRONT + win, 0.03, 4), ...sweep(R0 + 0.02, FRONT + win, FRONT - win, 0.03, 4)],
      sheen,
      rules: Array.from({ length: f.mobile ? 5 : 6 }, (_, k) => [0.22 + f.rnd(k + 10) * 0.16, 0.6 + f.rnd(k + 20) * 0.4, 0.36 + f.rnd(k + 30) * 0.4]),
      first: stride * Math.floor((f.rnd(3) * 26) / stride),
    };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(-0.05 + (f.still ? 0 : Math.sin(f.t * 0.09) * 0.035), 0.1, 6.4, f.mobile ? 0.8 : 0.96);
    // on a phone the wheel sits centred and high, clear of the statement below it
    if (f.mobile) f.cx = f.w * 0.52;
    if (f.mobile) f.cy = f.h * 0.275;

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.12 });
    pool(f, [0, floor, 0.1], 2.6, pal.key, 0.2 * f.boot);
    pool(f, [0, floor, -0.9], 0.6, pal.gold, 0.08 * f.on(0.75, 0.25));

    // which letter is at the index: the page's own, or wherever the slow turn has reached.
    // Phones carry every second letter, always including the page's own.
    const stride = f.mobile ? 2 : 1;
    // (a slug that does not begin with a letter is filed nowhere: the wheel shows the whole alphabet)
    const pick = f.tag ? LETTERS.indexOf(f.tag.charAt(0).toUpperCase()) : -1;
    const par = pick >= 0 ? pick % stride : 0;
    // the wheel turns into place as it powers on, then holds (a term) or creeps (the whole glossary)
    const rest = pick >= 0 ? pick : s.first + (f.still ? stride * Math.round(f.t / 14 / stride) : f.t / 14);
    const pos = rest + (1 - f.boot) * 2.6;
    const snap = Math.round((pos - par) / stride) * stride + par;
    const near = ((snap % 26) + 26) % 26;
    // 1 while a letter sits in the reading window, easing to 0 half-way to the next
    const lock = clamp((0.5 - Math.abs(pos - snap) / stride) * 5);
    const turnOf = (i: number) => FRONT + (i - pos) * STEP;
    const facing = (turn: number) => 0.5 - 0.5 * Math.sin(turn * TAU);
    const body = f.on(0, 0.4);
    const focus = near === pick ? pal.gold : pal.ink;

    // ── the wheel: a recessed well lit by its cards, the engraved band, the knurled wall
    f.fill(s.hub, pal.bg, 0.92 * body);
    f.fill(s.hub, pal.key, 0.04 * body);
    f.glow(flat(0, 0.1, -WELL), 0.95, pal.key, 0.11 * f.on(0.5));
    f.fill(s.well, pal.bg, 0.9 * body);
    f.fill(s.well, pal.ink, 0.075 * body);
    f.fill(s.wall, pal.bg, 0.92 * body);
    f.fill(s.wall, pal.ink, 0.05 * body);
    f.fill(s.band, pal.bg, 0.9 * body);
    f.fill(s.band, pal.ink, 0.045 * body);
    for (const q of s.sheen) f.fill(q, pal.ink, 0.011 * body);
    f.path(s.bevel, pal.ink, 0.1 * body, 1);
    f.path(s.outer, pal.ink, 0.26 * body, 1);
    f.path(s.inner, pal.ink, 0.3 * body, 1);
    f.path(s.foot, pal.ink, 0.2 * body, 1);
    const knurl = Math.round((f.mobile ? 34 : 68) * f.q);
    marks(f, pal.ink, 0.17 * body, (mark) => {
      for (let i = 0; i < knurl; i++) {
        const t = 0.5 + ((i + 0.5) / knurl) * 0.5;
        mark(at(R1, t, -0.02), at(R1, t, -WALL + 0.02));
      }
    });
    trace(f, s.lit, pal.key, 0.55 * f.on(0.2), 1.25);
    if (!f.still) {
      // one slow glint running round the lit edge, fading in and out at its ends
      const u = (f.t / 11) % 1;
      const glint = at(R1, lerp(0.54, 0.96, u), 0);
      f.glow(glint, 0.11, pal.key, 0.5 * Math.sin(Math.PI * u) * f.boot);
      f.dot(glint, 0.011, pal.ink, 0.9 * Math.sin(Math.PI * u) * f.boot);
    }

    // ── graduations between the letters, then the alphabet itself (the far side dimmer)
    for (const front of [false, true])
      marks(f, pal.ink, (front ? 0.42 : 0.16) * f.on(0.15), (mark) => {
        for (let j = 0; j < 104; j++) {
          if ((j - par * 4) % (4 * stride) === 0) continue;
          const t = turnOf(j / 4);
          if (facing(t) > 0.5 !== front) continue;
          mark(at(R1 - 0.035, t, 0.003), at(R1 - (j % 4 === 2 ? 0.115 : 0.075), t, 0.003));
        }
      });
    f.glow(at(RL, FRONT, 0.01), 0.3, focus, (near === pick ? 0.3 : 0.12) * lock);
    for (let i = par; i < 26; i += stride) {
      const t = turnOf(i);
      const sel = i === near ? lock : 0;
      const size = (f.mobile ? 0.14 : 0.1) * (1 + (near === pick ? (f.mobile ? 0.34 : 0.5) : 0.22) * sel);
      const alpha = lerp(0.14 + 0.5 * facing(t), 0.96, sel) * f.on(0.2 + 0.4 * (1 - facing(t)));
      engrave(f, LETTERS[i], at(RL, t, 0.004), at(RL, t + 0.05 / (RL * TAU), 0.004), at(RL + 0.05, t, 0.004), 0.05, size, sel > 0.5 ? focus : pal.ink, alpha);
    }

    // ── the fixed index: a glass reading window over the band, a pointer on the hub, a lamp on the wall
    const idx = f.on(0.75, 0.25);
    f.fill(s.cursor, focus, 0.05 * idx);
    f.path(s.cursor, pal.gold, 0.62 * idx, 1, true);
    const tip = 0.065 / R0 / TAU;
    f.fill([at(R0 - 0.08, FRONT, -WELL), at(R0 - 0.215, FRONT - tip, -WELL), at(R0 - 0.215, FRONT + tip, -WELL)], pal.gold, 0.9 * idx);

    // ── the cards: a file of glass standing in the well, the open one at the front
    const count = s.rules.length;
    const second = pal.key === pal.teal ? pal.blue : pal.teal;
    // the open card is reflected in the polished floor of the well
    for (let i = 1; i <= 3; i++)
      f.fill([flat(-CW / 2, -0.3, -WELL), flat(CW / 2, -0.3, -WELL), flat(CW / 2, -0.3 - i * 0.12, -WELL), flat(-CW / 2, -0.3 - i * 0.12, -WELL)], pick >= 0 ? pal.gold : pal.key, 0.02 * f.on(0.8));
    for (let k = 0; k < count; k++) {
      const e = k / (count - 1);
      const lean = -TILT + lerp(0.26, -0.04, e);
      const base = flat(0, lerp(0.44, -0.3, e), -WELL);
      const open = k === count - 1;
      const colour = open && pick >= 0 ? pal.gold : k % 2 ? second : pal.key;
      const edge = lerp(0.28, 0.62, e);
      const card = panel(f, [base[0], base[1] + (Math.cos(lean) * CH) / 2, base[2] + (Math.sin(lean) * CH) / 2], CW, CH, {
        tilt: lean,
        on: f.on(0.3 + e * 0.45, 0.35),
        colour,
        alpha: edge,
        glass: 0.03 + e * 0.02,
      });
      if (card.on <= 0.003) continue;
      // index tabs step across the file so that every card can be found
      const step = 0.76 / (count - 1);
      const u0 = 0.05 + k * step;
      const tab: V3[] = [card.at(u0, 1), card.at(u0 + 0.012, 1.11), card.at(u0 + 0.148, 1.11), card.at(u0 + 0.16, 1)];
      f.fill(tab, pal.bg, 0.55 * card.on);
      f.fill(tab, colour, 0.1 * card.on);
      f.path(tab, colour, edge * card.on, 1);
      // a headword and its definition, as engraved rules
      const [a, b, c] = s.rules[k];
      const rule = (v: number, x: number, len: number, tone: string, alpha: number, width = 1) =>
        f.line(card.at(x, v, 0.004), card.at(x + len, v, 0.004), tone, alpha * card.on, width);
      rule(open ? 0.8 : 0.9, open ? 0.42 : 0.07, a * (open ? 0.52 : 0.3), colour, 0.8, 1.5);
      if (!open) {
        // a filed card shows only its top line, kept clear of the tab of the card in front
        const next = u0 + step;
        if (!f.mobile) rule(0.9, next > 0.45 ? 0.26 : next + 0.2, (next > 0.45 ? next - 0.3 : 0.74 - next) * b, pal.ink, 0.3);
      } else {
        rule(0.6, 0.42, b * 0.52, pal.ink, 0.3);
        rule(0.44, 0.42, c * 0.52, pal.ink, 0.3);
        rule(0.28, 0.42, 0.16, pal.ink, 0.3);
        const initial = LETTERS[pick >= 0 ? pick : near];
        engrave(f, initial, card.at(0.2, 0.54, 0.004), card.at(0.2 + 0.05 / CW, 0.54, 0.004), card.at(0.2, 0.54 - 0.05 / CH, 0.004), 0.05, 0.24, pick >= 0 ? pal.gold : pal.ink, 0.92 * (pick >= 0 ? 1 : lock) * f.on(0.8, 0.2), true);
      }
    }

    const breathe = f.still ? 1 : 0.88 + 0.12 * Math.sin(f.t * 0.9);
    lamp(f, at(R1, FRONT, -WALL * 0.5), pal.gold, idx * breathe, 0.02);
  },
};

export default scene;
