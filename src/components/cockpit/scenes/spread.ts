/**
 * SPREAD — two prices and the distance between them.
 *
 * One pane of glass carries two lit lines running side by side: the ask above,
 * the bid below. They are never one line. The band between them is the page's
 * subject, so it is the part in champagne: it breathes wider and narrower, and
 * a measuring bracket stands across it where the spread is being read.
 *
 * The lines are a drawing of two quotes, not a chart: they carry no symbol, no
 * scale figures and no reading, and the edge of the pane is graduated in tick
 * marks only.
 *
 * The pointer: the bracket leaves its place on the golden cut and follows the
 * cursor along the pane, measuring the gap wherever it is held.
 */
import { clamp, lerp, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, trace } from "../kit";

const FLOOR = -1.3;
/** the pane: width, height, lean */
const [PW, PH, TILT] = [3.2, 1.9, 0.07];
/** where the two lines begin and end across the pane */
const [U0, U1] = [0.07, 0.93];
/** the height the pair runs at, and half the gap at its narrowest and its widest (shares of the pane's height) */
const [MID, NARROW, WIDE] = [0.52, 0.045, 0.2];
const CUT = 0.618;
/** how far content stands off the glass */
const L = 0.02;

type State = { u: number; phase: number };

const scene: Scene<State> = {
  pose: 11,
  setup(f) {
    return { u: CUT, phase: f.rnd(2) * 6 };
  },
  draw(f, s) {
    const { pal, ctx } = f;
    const m = f.mobile;
    const t = f.t;
    f.aim(-0.16 + (f.still ? 0 : Math.sin(t * 0.08 + s.phase) * 0.04), 0.1, 6.2, 1.07);

    deck(f, { y: FLOOR, alpha: 0.11 });
    pool(f, [0, FLOOR, -0.1], 2.6, pal.key, 0.22 * f.boot);

    const pane = panel(f, [0, -0.1, 0], PW, PH, { tilt: TILT, on: f.on(0, 0.4), colour: pal.key, alpha: 0.55, glass: 0.04 });
    if (pane.on <= 0.003) return;
    const second = pal.key === pal.teal ? pal.blue : pal.teal;

    // ── the breath: one slow cycle from narrow to wide and back; the still frame holds it open
    const breath = f.still ? 0.72 : 0.5 + 0.5 * Math.sin(t * 0.42 + s.phase);
    const half = lerp(NARROW, WIDE, breath);
    const mid = (u: number) => MID + 0.03 * Math.sin(u * 3.1 + t * 0.12 + s.phase);
    const gap = (u: number) => half * (1 + 0.16 * Math.sin(u * 5.2 - t * 0.3 + s.phase));
    const ask = (u: number): V3 => pane.at(u, mid(u) + gap(u), L);
    const bid = (u: number): V3 => pane.at(u, mid(u) - gap(u), L);

    // ── the graduated edge: tick marks, never figures; the long ones carry a faint rule across the glass
    const ruled = f.on(0.2, 0.4) * pane.on;
    const step = m ? 0.05 : 0.025;
    for (let i = 0; 0.08 + i * step <= 0.921; i++) {
      const v = 0.08 + i * step;
      const major = i % (m ? 2 : 4) === 0;
      f.line(pane.at(0.018, v, L), pane.at(major ? 0.046 : 0.032, v, L), pal.ink, (major ? 0.5 : 0.26) * ruled, 1);
      if (major) f.line(pane.at(0.06, v, L), pane.at(0.982, v, L), pal.ink, 0.045 * ruled, 1);
    }

    // ── the two lines are drawn across the pane at power-on, and the band between them fills behind
    const drawn = f.on(0.3, 0.5) * pane.on;
    if (drawn <= 0.003) return;
    const n = Math.max(12, Math.round((m ? 28 : 52) * f.q));
    const end = lerp(U0, U1, drawn);
    const a: V3[] = [];
    const b: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const u = lerp(U0, end, i / n);
      a.push(ask(u));
      b.push(bid(u));
    }
    f.fill([...a, ...b.slice().reverse()], pal.gold, (0.085 + 0.05 * breath + 0.06 * f.hover) * drawn);
    trace(f, a, pal.key, 0.9 * drawn, 1.5, f.still ? -1 : t / 9);
    trace(f, b, second, 0.9 * drawn, 1.5, f.still ? -1 : t / 9 + 0.5);

    ctx.save();
    ctx.letterSpacing = "1.5px";
    const size = m ? 9 : 10;
    f.label("ASK", ask(U0 + 0.02), { size, colour: pal.key, alpha: 0.9 * drawn, dy: -11 });
    f.label("BID", bid(U0 + 0.02), { size, colour: second, alpha: 0.9 * drawn, dy: 12 });

    // ── the bracket: it measures the gap where it stands, and stands where the pointer holds it
    const lit = f.on(0.75, 0.25) * pane.on;
    const o = f.P(...pane.at(0, 0.5));
    const x = f.P(...pane.at(1, 0.5));
    const held = o && x && Math.abs(x.x - o.x) > 1 ? (f.mx - o.x) / (x.x - o.x) : CUT;
    const rest = CUT + (f.still ? 0 : 0.05 * Math.sin(t * 0.11 + s.phase));
    const want = clamp(lerp(rest, held, f.hover), U0 + 0.1, U1 - (m ? 0.24 : 0.17));
    s.u = f.still ? want : s.u + (want - s.u) * (1 - Math.exp(-f.dt * 7));
    const u = s.u;
    const top = ask(u);
    const foot = bid(u);
    const cap = 0.016;
    f.glow(pane.at(u, mid(u), L), 0.2 + 0.5 * gap(u), pal.gold, (0.16 + 0.2 * f.hover) * lit);
    trace(f, [foot, top], pal.gold, 0.95 * lit, 1.5);
    f.line(pane.at(u - cap, mid(u) + gap(u), L), pane.at(u + cap, mid(u) + gap(u), L), pal.gold, 0.95 * lit, 1.5);
    f.line(pane.at(u - cap, mid(u) - gap(u), L), pane.at(u + cap, mid(u) - gap(u), L), pal.gold, 0.95 * lit, 1.5);
    lamp(f, top, pal.gold, lit, 0.012);
    lamp(f, foot, pal.gold, lit, 0.012);
    // a leader from the bracket to its name
    const name = pane.at(u + 0.04, mid(u), L);
    f.line(pane.at(u + 0.008, mid(u), L), name, pal.gold, 0.5 * lit, 1);
    f.label("SPREAD", name, { size, colour: pal.gold, alpha: 0.95 * lit, dx: 5 });
    ctx.restore();
  },
};

export default scene;
