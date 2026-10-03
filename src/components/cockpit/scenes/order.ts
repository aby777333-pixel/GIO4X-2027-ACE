/**
 * ORDER — the anatomy of one order.
 *
 * Two panes of glass. The tall one is a price ladder: graduated rungs, and
 * three levels set on it: the entry, a stop below it and a target above it,
 * with the ground between them shaded as what is risked and what is sought.
 * The smaller pane is the ticket, which names the three and is wired to them.
 * A marker, the price, travels the ladder between the levels: it leaves the
 * entry, reaches the target and comes back; the next time it goes down to the
 * stop. The level it stands on lights, on the ladder and on the ticket.
 *
 * The rungs carry no figures and the marker follows a fixed, drawn path: this
 * is a diagram of how an order is built, not a market and not an outcome.
 *
 * The pointer: the marker follows the cursor up and down the ladder, so each
 * level can be touched by hand.
 */
import { TAU, clamp, easeInOut, lerp, type Palette, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, trace } from "../kit";

const FLOOR = -1.3;
/** the ladder: centre, width, height, turn */
const [LX, LW, LH, LYAW] = [-0.72, 1.5, 2.25, -0.1];
/** the ticket */
const [TX, TY, TW, TH, TYAW] = [1.02, 0.0, 1.14, 1.3, 0.3];
/** seconds for one journey out to a level and back */
const TRIP = 13;
const L = 0.02;

type Tone = keyof Pick<Palette, "emerald" | "gold" | "crimson">;
/** a level: its name, its height on the ladder, its row on the ticket */
const LEVELS: readonly { name: string; v: number; row: number; tone: Tone }[] = [
  { name: "TAKE PROFIT", v: 0.82, row: 0.66, tone: "emerald" },
  { name: "ENTRY", v: 0.52, row: 0.43, tone: "gold" },
  { name: "STOP LOSS", v: 0.3, row: 0.2, tone: "crimson" },
];
const [TARGET, ENTRY, STOP] = [LEVELS[0].v, LEVELS[1].v, LEVELS[2].v];

type State = { v: number; lead: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { v: ENTRY, lead: Math.floor(f.rnd(2) * 2) };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(0.04 + (f.still ? 0 : Math.sin(t * 0.08 + s.lead) * 0.04), 0.08, 6.2, 1.04);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, -0.1], 2.6, pal.key, 0.22 * f.boot);

    const ladder = panel(f, [LX, -0.06, 0.1], LW, LH, { yaw: LYAW, tilt: 0.05, on: f.on(0, 0.4), colour: pal.key, alpha: 0.55, glass: 0.04 });
    const ticket = panel(f, [TX, TY, -0.05], TW, TH, { yaw: TYAW, tilt: 0.05, on: f.on(0.25, 0.4), colour: pal.key, alpha: 0.5, glass: 0.05, header: true });
    if (ladder.on <= 0.003) return;
    const P = (u: number, v: number): V3 => ladder.at(u, v, L);

    // ── the marker: out from the entry to the target and back, then out to the stop and back
    const trip = t / TRIP + s.lead;
    const c = trip - Math.floor(trip);
    const goal = Math.floor(trip) % 2 === 0 ? TARGET : STOP;
    const out = easeInOut(c / 0.62);
    // it hesitates on the way, a little back toward the entry and beyond it, before it commits
    const way = clamp(out + 0.13 * Math.sin(c * TAU * 2.6) * Math.sin(Math.PI * out), -0.3, 1);
    const auto = f.still ? lerp(ENTRY, TARGET, 0.55) : c < 0.82 ? lerp(ENTRY, goal, way) : lerp(goal, ENTRY, easeInOut((c - 0.82) / 0.18));
    const o = f.P(...ladder.at(0.5, 0));
    const y = f.P(...ladder.at(0.5, 1));
    const held = clamp(o && y && Math.abs(y.y - o.y) > 1 ? (f.my - o.y) / (y.y - o.y) : ENTRY, STOP, TARGET);
    const want = lerp(auto, held, f.hover);
    s.v = f.still ? want : s.v + (want - s.v) * (1 - Math.exp(-f.dt * 8));
    const v = s.v;
    /** how much the marker stands on a level */
    const touch = (lv: number) => easeInOut(1 - Math.abs(v - lv) / 0.075);

    // ── the rungs: graduations down both rails, a faint rule across at every fifth
    const ruled = f.on(0.2, 0.4) * ladder.on;
    const step = m ? 0.044 : 0.022;
    for (let i = 0; 0.06 + i * step <= 0.941; i++) {
      const rv = 0.06 + i * step;
      const major = i % 5 === 0;
      const len = major ? 0.075 : 0.04;
      f.line(P(0.03, rv), P(0.03 + len, rv), pal.ink, (major ? 0.5 : 0.26) * ruled, 1);
      f.line(P(0.97, rv), P(0.97 - len, rv), pal.ink, (major ? 0.5 : 0.26) * ruled, 1);
      if (major) f.line(P(0.13, rv), P(0.87, rv), pal.ink, 0.05 * ruled, 1);
    }

    // ── the ground between the levels: what is sought above the entry, what is risked below it
    const set = f.on(0.4, 0.4) * ladder.on;
    f.fill([P(0.14, ENTRY), P(0.86, ENTRY), P(0.86, TARGET), P(0.14, TARGET)], pal.emerald, (0.06 + 0.05 * touch(TARGET)) * set);
    f.fill([P(0.14, STOP), P(0.86, STOP), P(0.86, ENTRY), P(0.14, ENTRY)], pal.crimson, (0.06 + 0.05 * touch(STOP)) * set);

    // ── the three levels, each wired to its row on the ticket
    const size = m ? 8 : 10;
    ctx.save();
    ctx.letterSpacing = "1.2px";
    LEVELS.forEach((lv, i) => {
      const on = f.on(0.4 + i * 0.12, 0.3) * ladder.on;
      if (on <= 0.003) return;
      const colour = pal[lv.tone];
      const k = touch(lv.v);
      if (k > 0.02) f.glow(P(0.5, lv.v), 0.5, colour, 0.22 * k * on);
      trace(f, [P(0.1, lv.v), P(0.9, lv.v)], colour, (0.55 + 0.45 * k) * on, 1.3 + 0.5 * k);
      const wired = on * ticket.on;
      if (wired > 0.003) {
        const row = ticket.at(0.08, lv.row, L);
        trace(f, [P(0.9, lv.v), ladder.at(1, lv.v, L), ticket.at(0, lv.row, L), row], colour, (0.26 + 0.5 * k) * wired, 1);
        lamp(f, row, colour, (0.45 + 0.55 * k) * wired, 0.014);
        f.label(lv.name, ticket.at(0.17, lv.row, L), { size, colour: k > 0.5 ? colour : pal.ink, alpha: (0.7 + 0.3 * k) * wired });
        f.line(ticket.at(0.06, lv.row - 0.1, L), ticket.at(0.94, lv.row - 0.1, L), pal.ink, 0.1 * wired, 1);
      }
    });
    if (ticket.on > 0.003) f.label("ORDER", ticket.at(0.07, 0.94, L), { size, colour: pal.ink2, alpha: 0.75 * ticket.on });
    ctx.restore();

    // ── the marker itself: a hairline across the ladder, a pointer on its rail, and the way it has come from the entry
    const live = f.on(0.8, 0.2) * ladder.on;
    const side = v >= ENTRY ? pal.emerald : pal.crimson;
    trace(f, [P(0.5, ENTRY), P(0.5, v)], side, 0.8 * live, 1.5);
    f.line(P(0.1, v), P(0.9, v), pal.ink, 0.5 * live, 1);
    f.fill([P(0.985, v + 0.016), P(0.985, v - 0.016), P(0.925, v)], pal.ink, 0.9 * live);
    lamp(f, P(0.5, v), pal.ink, live, 0.015);
  },
};

export default scene;
