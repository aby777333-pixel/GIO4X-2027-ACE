"use client";

import { useEffect, useRef } from "react";

/**
 * The finder's waiting instrument: what the result panel shows until both
 * questions are answered.
 *
 * Two panes of glass stand side by side on a faint deck, one per platform, and
 * a selector dial lies in front of them on the centre line: the outer ring is
 * question one, the inner ring question two, each with one detent per option.
 * While a question is open its ring turns slowly and a scanning light crosses
 * both panes, there and back. When a question is answered its ring turns the
 * chosen detent to the index mark and locks, a pulse runs down the deck to
 * BOTH panes at once, and the same placeholder rows light in each.
 *
 * The finder never recommends a platform, so nothing here may either: the two
 * panes are mirror images, lit by the same values on every frame, and the dial
 * sits on the axis between them. No figures, no prices, no marks of approval.
 *
 * Decorative only (aria-hidden, no pointer events, nothing focusable). One
 * small Canvas 2D surface, colours read from the design tokens, paused
 * off-screen and in hidden tabs, and a single composed still frame under
 * reduced motion or "low visual effects".
 */

type Props = {
  /** the two platform names, in the order the result lists them */
  panes: readonly string[];
  /** index of the chosen option of question one, or null while it is open */
  first: number | null;
  firstCount: number;
  /** the same for question two */
  second: number | null;
  secondCount: number;
  className?: string;
};

type Answers = Pick<Props, "panes" | "first" | "firstCount" | "second" | "secondCount">;
type V3 = readonly [number, number, number];
type Pt = { x: number; y: number };
/** red, green, blue (0 to 255) and the token's own alpha */
type Colour = readonly [number, number, number, number];
type Palette = { ink: Colour; ink2: Colour; ink3: Colour; line: Colour; gold: Colour; accent: Colour; font: string };
type Ring = {
  r: number;
  /** waiting speed, radians a second (the two rings turn against each other) */
  spin: number;
  angle: number;
  /** the option it is locked on, as last seen */
  idx: number | null;
  /** 0 open, 1 locked: eased */
  lock: number;
  /** seconds since it last locked */
  since: number;
  /** 0 to 1: how far its rows are lit in the panes */
  feed: number;
};

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

// The scene, in world units. x to the right, y up, z away from the viewer.
const DIST = 7;
const PITCH = 0.36;
/** a pane runs from its inner edge (near the centre line) to its outer edge, toed in like two monitors */
const PANE_IN = 0.2;
const PANE_OUT = 2.2;
const PANE_Z_IN = 1;
const PANE_Z_OUT = 0.7;
const PANE_Y0 = 0.1;
const PANE_Y1 = 1.3;
/** the dial's centre on the deck, and its two rings */
const DIAL_Z = -0.3;
const R_OUTER = 0.9;
const R_INNER = 0.6;
/** where the deck trace turns towards a pane */
const TRACE_X = 1.2;
const TRACE_Z = lerp(PANE_Z_IN, PANE_Z_OUT, (TRACE_X - PANE_IN) / (PANE_OUT - PANE_IN));
/** the placeholder rows of a pane (height, 0 to 1) and the question each belongs to */
const ROWS: readonly { v: number; ring: 0 | 1 }[] = [
  { v: 0.6, ring: 0 },
  { v: 0.42, ring: 1 },
  { v: 0.24, ring: 1 },
];
const SIDES = [-1, 1] as const;

const css = (c: Colour, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.round(clamp(c[3] * a) * 1000) / 1000})`;

/** A point on a pane: `pu` is 0 at its left edge on screen and 1 at its right, `pv` 0 at its foot and 1 at its head. */
function paneAt(side: -1 | 1, pu: number, pv: number): V3 {
  const t = side < 0 ? 1 - pu : pu;
  return [side * lerp(PANE_IN, PANE_OUT, t), lerp(PANE_Y0, PANE_Y1, pv), lerp(PANE_Z_IN, PANE_Z_OUT, t)];
}

/** A point on the dial, on the deck. */
const dialAt = (r: number, a: number): V3 => [r * Math.cos(a), 0, DIAL_Z + r * Math.sin(a)];

export function FinderWait({ panes, first, firstCount, second, secondCount, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const answers = useRef<Answers>({ panes, first, firstCount, second, secondCount });
  const kick = useRef<(() => void) | null>(null);

  // the form's state reaches the frame loop through a ref; a still frame is redrawn on every change
  useEffect(() => {
    answers.current = { panes, first, firstCount, second, secondCount };
    kick.current?.();
  }, [panes, first, firstCount, second, secondCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
    // the pointer counts while it is anywhere over the waiting panel, text included
    const zone: HTMLElement = canvas.parentElement?.parentElement ?? canvas;

    let w = 1;
    let h = 1;
    let dpr = 1;
    let raf = 0;
    let inView = true;
    let disposed = false;
    let started = 0;
    let last = 0;
    let clock = 0;
    // camera fit (set on resize) and the terms of this frame's projection
    let fitU = 60;
    let fitX = 0;
    let fitY = 0;
    let u = 60;
    let cx = 0;
    let cy = 0;
    let cyaw = 1;
    let syaw = 0;
    let cpit = Math.cos(PITCH);
    let spit = Math.sin(PITCH);
    // pointer: raw target, eased position (-1 to 1 and canvas pixels), eased presence
    let over = false;
    let tpx = 0;
    let tpy = 0;
    let px = 0;
    let py = 0;
    let rmx = 0;
    let rmy = 0;
    let mx = 0;
    let my = 0;
    let hover = 0;
    /** how much the pointer is on each pane, eased; index 0 is the left pane */
    const lit = [0, 0];
    const rings: [Ring, Ring] = [
      { r: R_OUTER, spin: 0.2, angle: 0.35, idx: null, lock: 0, since: 9, feed: 0 },
      { r: R_INNER, spin: -0.27, angle: -0.5, idx: null, lock: 0, since: 9, feed: 0 },
    ];

    /** Any CSS colour, through the canvas's own parser, as numbers. Null when the token is empty or not a colour. */
    const parse = (value: string): Colour | null => {
      if (!value) return null;
      ctx.fillStyle = "rgba(1,2,3,0.004)";
      const before = ctx.fillStyle;
      ctx.fillStyle = value;
      const s = String(ctx.fillStyle);
      if (s === before && value.replace(/\s/g, "") !== "rgba(1,2,3,0.004)") return null;
      if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
      const m = s.match(/-?[\d.]+(?:e-?\d+)?/g);
      if (!m || m.length < 3) return null;
      const k = s.startsWith("color(") ? 255 : 1;
      return [Math.round(Number(m[0]) * k), Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k), m.length > 3 ? Number(m[3]) : 1];
    };
    const readPalette = (): Palette => {
      const cs = getComputedStyle(canvas);
      const text = parse(cs.color) ?? [128, 128, 128, 1];
      const v = (name: string, fallback: Colour) => parse(cs.getPropertyValue(name).trim()) ?? fallback;
      const ink = v("--ink", text);
      return {
        ink,
        ink2: v("--ink-2", ink),
        ink3: v("--ink-3", ink),
        line: v("--line", [ink[0], ink[1], ink[2], 0.11]),
        gold: v("--tone-4", ink),
        accent: v("--accent", v("--tone-1", ink)),
        font: cs.fontFamily || "system-ui, sans-serif",
      };
    };
    let pal = readPalette();

    const aim = (yaw: number, pitch: number) => {
      cyaw = Math.cos(yaw);
      syaw = Math.sin(yaw);
      cpit = Math.cos(pitch);
      spit = Math.sin(pitch);
    };
    const P = (p: V3): Pt => {
      const x1 = p[0] * cyaw - p[2] * syaw;
      const z1 = p[0] * syaw + p[2] * cyaw;
      const y1 = p[1] * cpit + z1 * spit;
      const s = DIST / (-p[1] * spit + z1 * cpit + DIST);
      return { x: cx + x1 * s * u, y: cy - y1 * s * u };
    };

    const stroke = (pts: readonly V3[], colour: string, width = 1, close = false) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = P(pts[i]);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      if (close) ctx.closePath();
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    const trace = (pts: readonly V3[]) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = P(pts[i]);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.closePath();
    };
    /** a line that fades to nothing at both ends, so the deck has no edge */
    const fading = (a: V3, b: V3, colour: Colour, alpha: number) => {
      const p = P(a);
      const q = P(b);
      const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
      g.addColorStop(0, css(colour, 0));
      g.addColorStop(0.5, css(colour, alpha));
      g.addColorStop(1, css(colour, 0));
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    /** a lamp: a soft pool of light and a bright core */
    const lamp = (at: V3, colour: Colour, alpha: number, size = 1) => {
      if (alpha <= 0.004) return;
      const p = P(at);
      const R = Math.max(4, u * 0.11 * size);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      g.addColorStop(0, css(colour, 0.5 * alpha));
      g.addColorStop(0.4, css(colour, 0.16 * alpha));
      g.addColorStop(1, css(colour, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(colour, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.4, u * 0.02 * size), 0, TAU);
      ctx.fill();
    };

    /** Fit the whole instrument into the canvas, centred, at the resting camera. */
    const fit = () => {
      aim(0, PITCH);
      u = 1;
      cx = 0;
      cy = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      const edge = DIAL_Z - R_OUTER - 0.3;
      const pts: V3[] = [[0, 0, edge], [-PANE_OUT, 0, PANE_Z_OUT], [PANE_OUT, 0, PANE_Z_OUT]];
      for (const side of SIDES) for (const pu of [0, 1]) for (const pv of [0, 1]) pts.push(paneAt(side, pu, pv));
      for (const pt of pts) {
        const p = P(pt);
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      const pad = 10;
      fitU = Math.max(20, Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0), 190));
      fitX = w / 2 - ((x0 + x1) / 2) * fitU;
      fitY = h / 2 - ((y0 + y1) / 2) * fitU;
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      fit();
    };

    const draw = (still: boolean, boot: number) => {
      const a = answers.current;
      const level = (rings[0].lock + rings[1].lock) / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = boot;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      u = fitU;
      cx = fitX;
      cy = fitY;
      aim(px * 0.07, PITCH - py * 0.03);

      // the deck: a faint grid that fades out on every side
      for (let i = -4; i <= 4; i++) fading([i * 0.62, 0, -1.7], [i * 0.62, 0, 1.5], pal.line, i === 0 ? 0 : 1);
      for (let i = 0; i <= 5; i++) fading([-3, 0, -1.6 + i * 0.62], [3, 0, -1.6 + i * 0.62], pal.line, 1);

      // the traces: from the dial out to both panes, the same on each side
      for (const side of SIDES) {
        const path: V3[] = [[side * R_OUTER, 0, DIAL_Z], [side * TRACE_X, 0, DIAL_Z], [side * TRACE_X, 0, TRACE_Z]];
        stroke(path, css(pal.ink, 0.2), 1);
        if (level > 0.004) stroke(path, css(pal.gold, 0.75 * level), 1.25);
        lamp(path[2], pal.gold, 0.9 * level, 0.8);
        if (still) continue;
        // a pulse runs out along the trace each time a ring locks
        for (const ring of rings) {
          if (ring.idx === null || ring.since > 0.8) continue;
          const q = easeOut(ring.since / 0.7);
          const turn = 0.26;
          const at: V3 = q < turn ? [side * lerp(R_OUTER, TRACE_X, q / turn), 0, DIAL_Z] : [side * TRACE_X, 0, lerp(DIAL_Z, TRACE_Z, (q - turn) / (1 - turn))];
          lamp(at, pal.gold, Math.sin(Math.PI * clamp(ring.since / 0.8)), 1.5);
        }
      }

      // the dial: a fixed index mark at the front, the hub, and the two rings
      const front = DIAL_Z - R_OUTER;
      stroke([[0, 0, DIAL_Z - 0.12], [0, 0, front]], css(pal.ink, 0.16), 1);
      stroke([[-0.075, 0, front - 0.24], [0, 0, front - 0.11], [0.075, 0, front - 0.24]], css(pal.gold, 0.9), 1.5);
      const hub: V3[] = [];
      for (let i = 0; i <= 24; i++) hub.push(dialAt(0.12, (i / 24) * TAU));
      stroke(hub, css(pal.ink2, 0.5), 1);
      lamp([0, 0, DIAL_Z], pal.gold, level, 0.9);

      rings.forEach((ring, k) => {
        const n = Math.max(1, k === 0 ? a.firstCount : a.secondCount);
        const step = TAU / n;
        const circle: V3[] = [];
        for (let i = 0; i <= 72; i++) circle.push(dialAt(ring.r, (i / 72) * TAU));
        stroke(circle, css(pal.ink, 0.2), 1);
        const colour = css(pal.ink2, 0.75 * (1 - ring.lock));
        const locked = css(pal.gold, 0.95 * ring.lock);
        for (let i = 0; i < n; i++) {
          // a heavier arc between each pair of detents, so the turning can be read
          const a0 = ring.angle + i * step + 0.2;
          const a1 = ring.angle + (i + 1) * step - 0.2;
          const arc: V3[] = [];
          const segs = Math.max(6, Math.round(48 / n));
          for (let j = 0; j <= segs; j++) arc.push(dialAt(ring.r, lerp(a0, a1, j / segs)));
          if (ring.lock < 0.996) stroke(arc, colour, 1.5);
          if (ring.lock > 0.004) stroke(arc, locked, 1.5);
          // the detent itself: a short radial notch
          const d = ring.angle + i * step;
          const chosen = ring.idx === i ? ring.lock : 0;
          stroke([dialAt(ring.r - 0.065, d), dialAt(ring.r + 0.065, d)], css(pal.ink2, 0.8 * (1 - chosen)), 1.25);
          if (chosen > 0.004) {
            stroke([dialAt(ring.r - 0.065, d), dialAt(ring.r + 0.065, d)], css(pal.gold, chosen), 1.75);
            lamp(dialAt(ring.r, d), pal.gold, chosen, 1.1);
          }
        }
      });

      // the two panes: one routine, mirrored, fed the same values
      const size = clamp(u * 0.082, 9, 11.5);
      // there and back at an even pace, turning just past the outer edges: each pane is lit for the same time
      const scan = 2.55 * (2 / Math.PI) * Math.asin(0.985 * Math.sin(clock * 0.5));
      SIDES.forEach((side, k) => {
        const corners: V3[] = [paneAt(side, 0, 0), paneAt(side, 1, 0), paneAt(side, 1, 1), paneAt(side, 0, 1)];
        const glow = lit[k];

        // its reflection on the deck, then the glass
        const foot = P(paneAt(side, 0.5, 0));
        const g = ctx.createLinearGradient(0, foot.y, 0, foot.y + u * 0.34);
        g.addColorStop(0, css(pal.ink, 0.05 + 0.03 * glow));
        g.addColorStop(1, css(pal.ink, 0));
        trace([paneAt(side, 0, 0), paneAt(side, 1, 0), paneAt(side, 1, -0.32), paneAt(side, 0, -0.32)]);
        ctx.fillStyle = g;
        ctx.fill();
        trace(corners);
        ctx.fillStyle = css(pal.ink, 0.035 + 0.05 * glow);
        ctx.fill();

        // the scanning light: it crosses on its own, or follows the pointer
        const xl = P(paneAt(side, 0, 0.5)).x;
        const xr = P(paneAt(side, 1, 0.5)).x;
        const auto = still ? (side < 0 ? 0.64 : 0.36) : side < 0 ? (scan + PANE_OUT) / (PANE_OUT - PANE_IN) : (scan - PANE_IN) / (PANE_OUT - PANE_IN);
        const pu = lerp(auto, (mx - xl) / (xr - xl), hover);
        const seen = smooth((pu + 0.1) / 0.1) * smooth((1.1 - pu) / 0.1);
        if (seen > 0.004) {
          const half = 0.2;
          const b0 = Math.max(0, pu - half);
          const b1 = Math.min(1, pu + half);
          if (b1 > b0) {
            const p0 = P(paneAt(side, pu - half, 0.5));
            const p1 = P(paneAt(side, pu + half, 0.5));
            const band = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
            band.addColorStop(0, css(pal.accent, 0));
            band.addColorStop(0.5, css(pal.accent, 0.2 * seen));
            band.addColorStop(1, css(pal.accent, 0));
            trace([paneAt(side, b0, 0), paneAt(side, b1, 0), paneAt(side, b1, 1), paneAt(side, b0, 1)]);
            ctx.fillStyle = band;
            ctx.fill();
          }
          const at = clamp(pu);
          stroke([paneAt(side, at, 0), paneAt(side, at, 1)], css(pal.accent, 0.85 * seen), 1.25);
        }

        // what the read-out will hold: a name, a rule, and rows that light as the questions are answered
        stroke([paneAt(side, 0.07, 0.76), paneAt(side, 0.93, 0.76)], css(pal.ink, 0.22), 1);
        for (const row of ROWS) {
          const feed = rings[row.ring].feed;
          stroke([paneAt(side, 0.07, row.v), paneAt(side, 0.24, row.v)], css(pal.ink3, 0.55), 1.5);
          stroke([paneAt(side, 0.31, row.v), paneAt(side, 0.93, row.v)], css(pal.ink, 0.16), 1.5);
          if (feed > 0.004) {
            const end = lerp(0.31, 0.93, feed);
            stroke([paneAt(side, 0.07, row.v), paneAt(side, 0.24, row.v)], css(pal.gold, 0.9 * feed), 1.5);
            stroke([paneAt(side, 0.31, row.v), paneAt(side, end, row.v)], css(pal.gold, 0.9), 1.5);
            if (feed < 0.98) lamp(paneAt(side, end, row.v), pal.gold, 1 - feed, 0.7);
          }
        }
        const name = P(paneAt(side, 0.07, 0.885));
        ctx.font = `600 ${size}px ${pal.font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = css(pal.ink2, 0.92);
        ctx.fillText((a.panes[k] ?? "").toUpperCase(), name.x, name.y);

        // the frame: a hairline, heavier at the corners in champagne, and the foot it stands on
        stroke(corners, css(pal.ink, 0.3 + 0.2 * glow), 1, true);
        const c = 0.09;
        const cv = (c * (PANE_OUT - PANE_IN)) / (PANE_Y1 - PANE_Y0);
        ctx.beginPath();
        for (const [eu, ev] of [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ] as const) {
          const p0 = P(paneAt(side, eu ? 1 - c : c, ev));
          const p1 = P(paneAt(side, eu, ev));
          const p2 = P(paneAt(side, eu, ev ? 1 - cv : cv));
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.strokeStyle = css(pal.gold, 0.8 + 0.2 * glow);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const base: V3[] = [
          [side * PANE_IN, 0, PANE_Z_IN],
          [side * PANE_OUT, 0, PANE_Z_OUT],
        ];
        stroke(base, css(pal.ink, 0.3), 1);
        if (level > 0.004) stroke(base, css(pal.gold, 0.7 * level), 1.25);
      });

      // the pointer carries a little light of its own
      if (hover > 0.004) {
        const R = u * 0.9;
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
        g.addColorStop(0, css(pal.accent, 0.1 * hover));
        g.addColorStop(1, css(pal.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(mx - R, my - R, R * 2, R * 2);
      }
      ctx.globalAlpha = 1;
    };

    const frame = (time: number) => {
      raf = 0;
      if (disposed) return;
      const still = isStill();
      if (!started) started = time;
      const dt = last ? Math.min(0.1, (time - last) / 1000) : 0.016;
      last = time;
      const a = answers.current;
      // frame-rate independent easing: the share of the remaining distance covered in dt
      const ease = (rate: number) => (still ? 1 : 1 - Math.exp(-dt * rate));

      px += (tpx - px) * ease(4);
      py += (tpy - py) * ease(4);
      mx += (rmx - mx) * ease(11);
      my += (rmy - my) * ease(11);
      hover += ((over && !still ? 1 : 0) - hover) * ease(5.5);
      if (hover < 0.002) hover = 0;
      if (still) {
        px = 0;
        py = 0;
        hover = 0;
      }
      clock += dt * (1 + hover * 0.5);

      rings.forEach((ring, k) => {
        const idx = k === 0 ? a.first : a.second;
        const n = Math.max(1, k === 0 ? a.firstCount : a.secondCount);
        if (idx !== ring.idx) {
          ring.idx = idx;
          ring.since = 0;
        }
        ring.since += dt;
        if (idx === null) {
          ring.angle = still ? (k === 0 ? 0.35 : -0.5) : ring.angle + ring.spin * dt * (1 + hover * 0.8);
          ring.lock += (0 - ring.lock) * ease(6);
          ring.feed += (0 - ring.feed) * ease(6);
        } else {
          // turn the chosen detent to the index mark at the front, the short way round
          let d = (-Math.PI / 2 - (idx * TAU) / n - ring.angle) % TAU;
          if (d > Math.PI) d -= TAU;
          if (d < -Math.PI) d += TAU;
          ring.angle += d * ease(7);
          ring.lock += (1 - ring.lock) * ease(7);
          // the rows light once the pulse has reached the panes
          if (still || ring.since > 0.5) ring.feed += (1 - ring.feed) * ease(4.5);
        }
      });

      // which pane the pointer is on: the same test for both
      aim(px * 0.07, PITCH - py * 0.03);
      u = fitU;
      cx = fitX;
      cy = fitY;
      SIDES.forEach((side, k) => {
        const xl = P(paneAt(side, 0, 0.5)).x;
        const xr = P(paneAt(side, 1, 0.5)).x;
        const on = over && !still && rmx >= xl && rmx <= xr ? 1 : 0;
        lit[k] += (on - lit[k]) * ease(6);
        if (still) lit[k] = 0;
      });

      draw(still, still ? 1 : easeOut((time - started) / 1100));

      if (!still && inView && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (disposed || raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    kick.current = start;

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      if (inView) start();
    });
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden) start();
    };
    const onPrefs = () => {
      // theme, accent or motion changed: re-read the tokens on the next frame
      requestAnimationFrame(() => {
        if (disposed) return;
        pal = readPalette();
        start();
      });
    };
    const onPointer = (e: PointerEvent) => {
      // a mouse or a pen can hover; a finger cannot, and its last position must not leave a light on
      if (e.pointerType === "touch") {
        over = false;
        return;
      }
      const z = zone.getBoundingClientRect();
      const was = over;
      over = e.clientX >= z.left && e.clientX <= z.right && e.clientY >= z.top && e.clientY <= z.bottom;
      if (!over) {
        tpx = 0;
        tpy = 0;
        return;
      }
      const r = canvas.getBoundingClientRect();
      tpx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      tpy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      rmx = e.clientX - r.left;
      rmy = e.clientY - r.top;
      if (!was && hover === 0) {
        // arrive where the pointer is, not from wherever it last was
        mx = rmx;
        my = rmy;
      }
    };
    const onLeave = () => {
      over = false;
      tpx = 0;
      tpy = 0;
    };

    resize();
    start();
    void document.fonts?.ready.then(start);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("gx:prefs", onPrefs);
    window.addEventListener("pointermove", onPointer, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    reduced.addEventListener("change", onPrefs);

    return () => {
      disposed = true;
      kick.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("gx:prefs", onPrefs);
      window.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerleave", onLeave);
      reduced.removeEventListener("change", onPrefs);
    };
  }, []);

  return (
    <div aria-hidden className={`pointer-events-none relative select-none ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
