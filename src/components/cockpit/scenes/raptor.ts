/**
 * 777 RAPTOR — the workspace powers on.
 *
 * Five panes of display glass assemble in front of the visitor in the order a
 * trader meets them: the chart, the watchlist, the order ticket, the positions
 * strip, and a row of lamps for the six asset classes. Panes rise into place,
 * their edges light, and the chart draws itself in.
 *
 * The chart is a drawing of a chart: a fixed, schematic series with no symbol,
 * no scale and no prices. It never pretends to be a market.
 */
import { clamp, easeOut, type Frame, type Scene, type V3 } from "../engine";
import { deck, lamp, panel, pool, trace, type Panel } from "../kit";

const CLASSES = ["FX", "METALS", "INDICES", "ENERGY", "EQUITIES", "CRYPTO"];

type State = { candles: { o: number; c: number; h: number; l: number }[]; rows: number[]; ladder: number[] };

function candleSeries(f: Frame, n: number): State["candles"] {
  const out: State["candles"] = [];
  let v = 0.42;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i * 0.31 + 0.6) * 0.035 + (f.rnd(i) - 0.47) * 0.09;
    const o = v;
    const c = clamp(v + drift, 0.12, 0.88);
    const h = Math.max(o, c) + f.rnd(i + 100) * 0.05;
    const l = Math.min(o, c) - f.rnd(i + 200) * 0.05;
    out.push({ o, c, h, l });
    v = c;
  }
  return out;
}

/** thin horizontal bars: a schematic list (a watchlist, a ladder), lit row by row */
function rows(f: Frame, p: Panel, widths: number[], colour: string, start: number): void {
  const n = widths.length;
  for (let i = 0; i < n; i++) {
    const on = easeOut((p.on * (f.boot - start)) / 0.28 - i * 0.16);
    if (on <= 0) continue;
    const v = 0.78 - (i / n) * 0.7;
    f.line(p.at(0.1, v), p.at(0.1 + 0.3 * on, v), f.pal.ink, 0.55 * on, 1.5);
    f.line(p.at(0.48, v), p.at(0.48 + widths[i] * 0.42 * on, v), colour, 0.75 * on, 1.5);
    f.dot(p.at(0.05, v), 0.014, colour, 0.9 * on);
  }
}

const scene: Scene<State> = {
  pose: 12,
  setup(f) {
    return {
      candles: candleSeries(f, f.mobile ? 22 : 34),
      rows: [0.9, 0.55, 0.75, 0.4, 0.82, 0.62, 0.5],
      ladder: [0.35, 0.5, 0.72, 0.9, 0.78, 0.56, 0.38, 0.26],
    };
  },
  draw(f, s) {
    const { pal } = f;
    f.aim(-0.2 + Math.sin(f.t * 0.11) * 0.05, 0.1, 6.4, f.mobile ? 0.7 : 0.74);

    const floor = -1.3;
    deck(f, { y: floor, alpha: 0.12 });
    pool(f, [0, floor, -0.2], 2.8, pal.key, 0.2 * f.boot);

    // ── the chart: the centre pane, first to light
    const chartOn = f.on(0, 0.4);
    const chart = panel(f, [0, 0.22, 0], 2.3, 1.42, { on: chartOn, colour: pal.key, header: true });
    if (chart.on > 0) {
      for (let i = 1; i < 5; i++) f.line(chart.at(0.04, i * 0.17), chart.at(0.96, i * 0.17), pal.ink, 0.07 * chart.on, 1);
      for (let i = 1; i < 6; i++) f.line(chart.at(i * 0.16, 0.04), chart.at(i * 0.16, 0.84), pal.ink, 0.05 * chart.on, 1);
      // candles draw in from the left once the pane is up
      const drawn = easeOut((f.boot - 0.3) / 0.5) * s.candles.length;
      const step = 0.9 / s.candles.length;
      const closes: V3[] = [];
      s.candles.forEach((k, i) => {
        if (i > drawn) return;
        const u = 0.05 + (i + 0.5) * step;
        const up = k.c >= k.o;
        const colour = up ? pal.emerald : pal.crimson;
        const a = 0.85 * clamp(drawn - i);
        f.line(chart.at(u, 0.06 + k.l * 0.74), chart.at(u, 0.06 + k.h * 0.74), colour, a * 0.7, 1);
        f.line(chart.at(u, 0.06 + k.o * 0.74), chart.at(u, 0.06 + k.c * 0.74), colour, a, f.mobile ? 2.5 : 3.5);
        closes.push(chart.at(u, 0.06 + k.c * 0.74, 0.02));
      });
      // an average line floats just off the glass, with one pulse travelling along it
      if (closes.length > 3) trace(f, closes, pal.key, 0.5 * chart.on, 1.25, f.t / 9);
    }

    // ── watchlist: left pane, turned in toward the chart
    const watch = panel(f, [-1.6, 0.22, -0.3], 0.82, 1.42, { yaw: 0.52, on: f.on(0.22, 0.4), colour: pal.teal, header: true });
    if (watch.on > 0) rows(f, watch, s.rows, pal.teal, 0.3);

    // ── order ticket: right pane, a depth ladder and two keys
    const ticket = panel(f, [1.6, 0.22, -0.3], 0.82, 1.42, { yaw: -0.52, on: f.on(0.38, 0.4), colour: pal.blue, header: true });
    if (ticket.on > 0) {
      const n = s.ladder.length;
      for (let i = 0; i < n; i++) {
        const on = easeOut((f.boot - 0.5) / 0.3 - i * 0.08);
        if (on <= 0) continue;
        const v = 0.8 - (i / n) * 0.48;
        const bid = i >= n / 2;
        const wdt = s.ladder[i] * 0.36 * on;
        f.line(ticket.at(0.5, v), ticket.at(bid ? 0.5 - wdt : 0.5 + wdt, v), bid ? pal.emerald : pal.crimson, 0.7 * on, 2.5);
      }
      f.line(ticket.at(0.5, 0.84), ticket.at(0.5, 0.3), pal.ink, 0.16 * ticket.on, 1);
      const keys = easeOut((f.boot - 0.72) / 0.25);
      f.fill([ticket.at(0.1, 0.08), ticket.at(0.46, 0.08), ticket.at(0.46, 0.2), ticket.at(0.1, 0.2)], pal.emerald, 0.3 * keys);
      f.fill([ticket.at(0.54, 0.08), ticket.at(0.9, 0.08), ticket.at(0.9, 0.2), ticket.at(0.54, 0.2)], pal.crimson, 0.3 * keys);
    }

    // ── positions strip: a low pane leaning back under the chart
    const strip = panel(f, [0, -0.82, -0.42], 2.3, 0.46, { tilt: -0.75, on: f.on(0.55, 0.35), colour: pal.gold, glass: 0.05 });
    if (strip.on > 0) {
      for (let i = 0; i < 3; i++) {
        const on = easeOut((f.boot - 0.7) / 0.25 - i * 0.12);
        if (on <= 0) continue;
        const v = 0.74 - i * 0.26;
        f.line(strip.at(0.05, v), strip.at(0.05 + 0.16 * on, v), pal.ink, 0.5 * on, 1.5);
        f.line(strip.at(0.3, v), strip.at(0.3 + (0.2 + f.rnd(i + 40) * 0.3) * on, v), pal.gold, 0.6 * on, 1.5);
        f.dot(strip.at(0.94, v), 0.014, i === 1 ? pal.crimson : pal.emerald, on);
      }
    }

    // ── feeds: six lamps, one per asset class, lighting in sequence. Then: ready.
    CLASSES.forEach((name, i) => {
      const on = easeOut((f.boot - 0.62 - i * 0.05) / 0.12);
      const x = -1.05 + i * 0.42;
      const p: V3 = [x, 1.18, 0];
      const breathe = f.still ? 1 : 0.85 + 0.15 * Math.sin(f.t * 1.1 + i);
      lamp(f, p, i % 2 ? pal.teal : pal.key, on * breathe, 0.02);
      if (!f.mobile) f.label(name, p, { dy: -16, align: "center", size: 9, alpha: 0.6 * on, colour: pal.ink2 });
    });
  },
};

export default scene;
