"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { TerminalStudy } from "@/components/brand/TerminalStudy";
import { instruments } from "@/data/instruments";
import { centres } from "@/lib/sessions";

/**
 * THE GIO4X SEQUENCE — one continuous visual narrative, driven by scroll.
 *
 *   1  a globe of market coordinates (a golden-angle lattice: φ on a sphere)
 *   2  the globe separates into free coordinates
 *   3  coordinates become instruments, flowing in six asset-class streams
 *   4  the streams converge and draw the 777 Raptor workspace
 *   5  the drawing settles into the workspace illustration
 *
 * Nothing here is market data: the nine labelled points are the financial
 * centres at their real coordinates and the labels in the streams are the
 * instruments GIO4X lists. No prices, no direction, no fake activity.
 *
 * Engineering
 *  - Canvas 2D, ~1,400 points on desktop and ~600 on phones; no dependency.
 *  - Scroll position is the only clock for the narrative, so it can never
 *    delay navigation; a visitor can scroll straight through it.
 *  - Runs only while on screen. Under reduced motion, "low visual effects" or
 *    without JavaScript the section is a short static composition: the four
 *    statements and the finished workspace, no pinned scrolling at all.
 */

const PHI = 1.6180339887;
const GOLDEN_ANGLE = Math.PI * 2 * (1 - 1 / PHI);
const DEG = Math.PI / 180;

// The workspace wireframe, in the 610 × 377 box of <TerminalStudy/>.
const CHART = [0, 6, 3, 9, 7, 13, 10, 8, 14, 18, 15, 21, 19, 17, 24, 28, 26, 31, 29, 34, 30, 38, 36, 41].map((v, i) => [40 + i * 15.2, 208 - v * 3.4] as const);
type Seg = { a: readonly [number, number]; b: readonly [number, number]; w: number; accent?: boolean };
const rect = (x: number, y: number, w: number, h: number, weight = 1): Seg[] => [
  { a: [x, y], b: [x + w, y], w: weight },
  { a: [x + w, y], b: [x + w, y + h], w: weight },
  { a: [x + w, y + h], b: [x, y + h], w: weight },
  { a: [x, y + h], b: [x, y], w: weight },
];
const WIRE: Seg[] = [
  ...rect(0, 0, 610, 377, 1.2),
  { a: [0, 21.5], b: [610, 21.5], w: 1 },
  { a: [403.5, 22], b: [403.5, 377], w: 1 },
  { a: [21, 232.5], b: [403, 232.5], w: 1 },
  ...CHART.slice(1).map((p, i) => ({ a: CHART[i], b: p, w: 3.4, accent: true })),
  ...[70, 111, 152, 193].map((y) => ({ a: [40, y] as const, b: [390, y] as const, w: 0.35 })),
  ...Array.from({ length: 7 }, (_, i) => ({ a: [417, 55.5 + i * 24] as const, b: [597, 55.5 + i * 24] as const, w: 0.7 })),
  ...Array.from({ length: 4 }, (_, r) => ({ a: [21, 281.5 + r * 26] as const, b: [387, 281.5 + r * 26] as const, w: 0.7 })),
  ...rect(417, 222, 180, 142, 1),
  ...rect(430, 252, 154, 21, 0.6),
  ...rect(430, 281, 72, 21, 0.6),
  ...rect(512, 281, 72, 21, 0.6),
  ...rect(430, 319, 72, 30, 0.8),
  ...rect(512, 319, 72, 30, 0.8),
];

const LANES = ["forex", "metals", "indices", "energy", "equities", "crypto"] as const;
const LANE_LABEL: Record<(typeof LANES)[number], string> = { forex: "Forex", metals: "Metals", indices: "Indices", energy: "Energy", equities: "Equities", crypto: "Crypto" };

const BEATS = [
  { k: "01", t: "Markets are places.", d: "Nine financial centres, from Sydney to New York, at their real coordinates." },
  { k: "02", t: "Places become coordinates.", d: "Every venue, session and price reference is a point that can be mapped." },
  { k: "03", t: "Coordinates become instruments.", d: `${instruments.length} instruments in six asset classes, each in its own stream.` },
  { k: "04", t: "And the streams become a workspace.", d: "777 Raptor. Built for the market." },
] as const;

// deterministic pseudo-random in [0,1): the picture is identical on every visit
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);
/** progress of `p` through the window [a, b], eased */
const win = (p: number, a: number, b: number) => ease(clamp01((p - a) / (b - a)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function parseRgb(v: string, fallback: [number, number, number]): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
}

export function MarketToRaptor() {
  const sceneRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<(HTMLLIElement | null)[]>([]);
  const railRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    if (!scene || !stage || !canvas || !figure) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let live = false;
    let raf = 0;
    let visible = false;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let target = 0; // scroll progress
    let p = 0; // displayed progress (smoothed)
    let n = 0;
    let font = "system-ui, sans-serif";
    let bg: [number, number, number] = [246, 244, 238];
    let night: [number, number, number] = [12, 17, 22];
    let ink: [number, number, number] = [20, 25, 29];
    let light: [number, number, number] = [238, 240, 241];
    const TEAL: [number, number, number] = [0, 160, 152];
    const BLUE: [number, number, number] = [26, 132, 204];
    const EMERALD: [number, number, number] = [20, 160, 84];

    // per-particle static data
    let lat: Float32Array, sx: Float32Array, sy: Float32Array, sz: Float32Array, lane: Uint8Array, laneU: Float32Array, laneOff: Float32Array, tx: Float32Array, ty: Float32Array, accent: Uint8Array, delay: Float32Array;
    let labels: { i: number; text: string }[] = [];
    let centreIdx: number[] = [];
    // layout of the workspace box on the stage
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let globe = { cx: 0, cy: 0, r: 0 };

    const readTheme = () => {
      const cs = getComputedStyle(root);
      bg = parseRgb(cs.getPropertyValue("--bg"), bg);
      night = parseRgb(cs.getPropertyValue("--night"), night);
      ink = parseRgb(cs.getPropertyValue("--ink"), ink);
      light = parseRgb(cs.getPropertyValue("--on-night"), light);
      font = getComputedStyle(document.body).fontFamily || font;
    };

    const build = () => {
      const r = stage.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const desktop = w >= 1080;
      n = desktop ? 1400 : w >= 560 ? 900 : 600;

      // the workspace occupies the major (61.8%) part on desktop, the upper part on phones
      const gutter = Math.max(21, Math.min(55, w * 0.042));
      if (desktop) {
        const bw = Math.min(w * 0.5, 860, (h - 190) * (610 / 377));
        box = { w: bw, h: bw * (377 / 610), x: w - gutter - bw - (w - Math.min(w, 1320 + gutter * 2)) / 2, y: 0 };
        box.y = (h - box.h) / 2 + 13;
      } else {
        const bw = Math.min(w - gutter * 2, 560, (h * 0.42) * (610 / 377));
        box = { w: bw, h: bw * (377 / 610), x: (w - bw) / 2, y: Math.max(89, h * 0.13) };
      }
      figure.style.left = `${box.x}px`;
      figure.style.top = `${box.y}px`;
      figure.style.width = `${box.w}px`;
      figure.style.height = `${box.h}px`;
      globe = { cx: box.x + box.w / 2, cy: box.y + box.h / 2, r: Math.min(box.h * 0.62, box.w * 0.42) };

      lat = new Float32Array(n);
      sx = new Float32Array(n);
      sy = new Float32Array(n);
      sz = new Float32Array(n);
      lane = new Uint8Array(n);
      laneU = new Float32Array(n);
      laneOff = new Float32Array(n);
      tx = new Float32Array(n);
      ty = new Float32Array(n);
      accent = new Uint8Array(n);
      delay = new Float32Array(n);

      // workspace targets: points spread along the wireframe in proportion to length × weight
      const lens = WIRE.map((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) * s.w);
      const total = lens.reduce((a, b) => a + b, 0);
      let seg = 0;
      let acc = 0;
      const k = box.w / 610;
      for (let i = 0; i < n; i++) {
        const want = ((i + 0.5) / n) * total;
        while (seg < WIRE.length - 1 && acc + lens[seg] < want) {
          acc += lens[seg];
          seg++;
        }
        const s = WIRE[seg];
        const t = clamp01((want - acc) / lens[seg]);
        tx[i] = box.x + mix(s.a[0], s.b[0], t) * k;
        ty[i] = box.y + mix(s.a[1], s.b[1], t) * k;
        accent[i] = s.accent ? 1 : 0;
      }
      // shuffle targets deterministically so neighbours on the globe do not stay neighbours
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rnd(i, 7) * (i + 1));
        [tx[i], tx[j]] = [tx[j], tx[i]];
        [ty[i], ty[j]] = [ty[j], ty[i]];
        [accent[i], accent[j]] = [accent[j], accent[i]];
      }
      for (let i = 0; i < n; i++) {
        lat[i] = 1 - (2 * (i + 0.5)) / n; // y on the unit sphere (golden-angle lattice)
        sx[i] = (rnd(i, 1) - 0.5) * 2.2;
        sy[i] = (rnd(i, 2) - 0.5) * 1.7;
        sz[i] = 0.35 + rnd(i, 3) * 1.25;
        lane[i] = Math.floor(rnd(i, 4) * 6);
        laneU[i] = rnd(i, 5);
        laneOff[i] = rnd(i, 6) - 0.5;
        delay[i] = rnd(i, 8);
      }
      // the first particles carry the instrument labels, a few per stream
      labels = [];
      const perLane = desktop ? 4 : 2;
      LANES.forEach((cls, li) => {
        instruments
          .filter((x) => x.class === cls)
          .slice(0, perLane)
          .forEach((ins, j, arr) => {
            const i = labels.length;
            lane[i] = li;
            laneU[i] = (j + 0.5) / arr.length + li * 0.07;
            laneOff[i] = 0;
            labels.push({ i, text: ins.symbol });
          });
      });
      centreIdx = centres.map((_, c) => labels.length + c);
      // set free, the nine centres settle on an even 3 × 3 field so their annotations never collide
      centreIdx.forEach((i, c) => {
        sx[i] = ((c % 3) - 1) * 0.62 + (rnd(c, 11) - 0.5) * 0.16;
        sy[i] = (Math.floor(c / 3) - 1) * 0.5 + (rnd(c, 12) - 0.5) * 0.12;
        sz[i] = 0.95;
      });
    };

    const rgba = (c: [number, number, number], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    const frame = (time: number) => {
      const t = time / 1000;
      p += (target - p) * 0.14;
      if (Math.abs(target - p) < 0.0004) p = target;

      // ── stage material: ivory by day, the engine room by the end
      // the change of material is quick and falls between two statements, so the stage never rests on a mid-grey
      const dark = win(p, 0.3, 0.385);
      const bgc: [number, number, number] = [mix(bg[0], night[0], dark), mix(bg[1], night[1], dark), mix(bg[2], night[2], dark)];
      const fg: [number, number, number] = [mix(ink[0], light[0], dark), mix(ink[1], light[1], dark), mix(ink[2], light[2], dark)];
      stage.style.backgroundColor = rgba(bgc, 1);
      stage.classList.toggle("on-night", dark > 0.5);
      // while the dark stage sits under the header, the header wears the night material too
      const sr = scene.getBoundingClientRect();
      if (dark > 0.5 && sr.top <= 8 && sr.bottom > 89) root.dataset.chrome = "night";
      else if (root.dataset.chrome) delete root.dataset.chrome;

      const toScatter = win(p, 0.14, 0.34);
      const toStream = win(p, 0.32, 0.5);
      const toWire = win(p, 0.64, 0.88);
      const settle = win(p, 0.88, 0.98);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rot = t * 0.06 + p * 1.2;
      const tilt = 21 * DEG;
      const push = 1 + win(p, 0.4, 0.66) * 0.34; // the camera moves through the data
      const desktop = w >= 1080;
      const laneGap = desktop ? Math.min(h * 0.085, 62) : Math.min(h * 0.052, 44);
      const laneY = desktop ? h / 2 : h * 0.33;
      const laneX0 = desktop ? w * 0.42 : -w * 0.08; // streams keep clear of the reading column
      const laneX1 = w * 1.08;
      const flow = t * 0.018;

      const size = desktop ? 1.9 : 1.6;
      const placed: { x: number; y: number; w: number }[] = [];
      const coordAlpha = Math.min(win(toScatter, 0.2, 0.7), 1 - win(toStream, 0, 0.5));
      for (let i = 0; i < n; i++) {
        // 1 globe
        let gx: number, gy: number, gz: number;
        const ci = centreIdx.indexOf(i);
        if (ci >= 0) {
          const c = centres[ci];
          const a = c.lat * DEG;
          const b = c.lon * DEG + rot;
          gx = Math.cos(a) * Math.sin(b);
          gy = Math.sin(a);
          gz = Math.cos(a) * Math.cos(b);
        } else {
          const y = lat[i];
          const rr = Math.sqrt(1 - y * y);
          const th = i * GOLDEN_ANGLE + rot;
          gx = rr * Math.sin(th);
          gy = y;
          gz = rr * Math.cos(th);
        }
        const yy = gy * Math.cos(tilt) - gz * Math.sin(tilt);
        const zz = gy * Math.sin(tilt) + gz * Math.cos(tilt);
        const x1 = globe.cx + gx * globe.r;
        const y1 = globe.cy - yy * globe.r;

        // 2 free coordinates (depth gives parallax as the camera pushes in)
        const d = sz[i];
        const x2 = (desktop ? w * 0.64 : w / 2) + (sx[i] * w * (desktop ? 0.4 : 0.5) * push) / d;
        const y2 = (desktop ? h / 2 : h * 0.31) + (sy[i] * h * (desktop ? 0.5 : 0.3) * push) / d;

        // 3 instrument streams: six lanes, flowing left to right
        const u = (laneU[i] + flow * (0.6 + (lane[i] % 3) * 0.2)) % 1;
        const ly = laneY + (lane[i] - 2.5) * laneGap * push;
        const x3 = mix(laneX0, laneX1, u);
        const y3 = ly + Math.sin(u * Math.PI * 2 * 1.5 + lane[i]) * laneGap * 0.16 + laneOff[i] * laneGap * 0.3;

        // 4 the workspace
        const own = clamp01((toWire - delay[i] * 0.35) / 0.65);
        const e4 = ease(own);

        let x = mix(x1, x2, toScatter);
        let y = mix(y1, y2, toScatter);
        x = mix(x, x3, toStream);
        y = mix(y, y3, toStream);
        x = mix(x, tx[i], e4);
        y = mix(y, ty[i], e4);

        // appearance
        const back = zz < 0 ? 0.28 : 1;
        let alpha = mix(mix(0.85 * back, Math.min(0.95, 0.62 / d), toScatter), 0.85, toStream);
        alpha = mix(alpha, accent[i] ? 0.95 : 0.6, e4) * (1 - settle * 0.9);
        // on wide screens the free coordinates thin out before the reading column
        if (desktop) alpha *= mix(1, clamp01((x - w * 0.3) / (w * 0.1)), toScatter * (1 - toStream));
        // on phones the statement sits below, so they thin out towards it instead
        else alpha *= mix(1, clamp01((h * 0.56 - y) / (h * 0.08)), toScatter * (1 - toStream));
        const tone = accent[i] && e4 > 0.5 ? BLUE : toStream > 0.3 && e4 < 0.9 ? [TEAL, BLUE, EMERALD][lane[i] % 3] : fg;
        ctx.fillStyle = rgba(tone as [number, number, number], alpha);
        // free coordinates are sized by depth: near ones are larger, which reads as space
        const depthSize = mix(1, Math.min(2.6, 1.15 / d), toScatter * (1 - toStream));
        const s = (ci >= 0 && toStream < 0.5 ? size * 2.4 : size * (1 + toStream * 0.25 * (1 - e4))) * depthSize;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);

        // set free, each centre is annotated with its real latitude and longitude
        if (ci >= 0 && coordAlpha > 0.02) {
          const c = centres[ci];
          ctx.font = `600 11px ${font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(fg, coordAlpha * 0.92);
          ctx.fillText(c.city, x + 9, y - 7);
          ctx.font = `500 10px ${font}`;
          ctx.fillStyle = rgba(fg, coordAlpha * 0.6);
          ctx.fillText(`${Math.abs(c.lat).toFixed(1)}°${c.lat >= 0 ? "N" : "S"}  ${Math.abs(c.lon).toFixed(1)}°${c.lon >= 0 ? "E" : "W"}`, x + 9, y + 7);
        }

        // the nine centres, named while the globe is whole
        if (ci >= 0 && zz > 0.15 && toScatter < 0.5) {
          ctx.font = `600 11px ${font}`;
          const tw = ctx.measureText(centres[ci].city).width;
          const clash = placed.some((b) => x + 8 < b.x + b.w + 6 && x + 8 + tw > b.x - 6 && Math.abs(y - b.y) < 14);
          if (!clash) {
            placed.push({ x: x + 8, y, w: tw });
            ctx.fillStyle = rgba(fg, (1 - toScatter * 2) * 0.9);
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(centres[ci].city, x + 8, y);
          }
        }
      }

      // instrument symbols travelling with their stream
      const labelAlpha = Math.min(win(p, 0.42, 0.56), 1 - win(p, 0.66, 0.78));
      if (labelAlpha > 0.02) {
        ctx.font = `600 12px ${font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const l of labels) {
          const i = l.i;
          const u = (laneU[i] + flow * (0.6 + (lane[i] % 3) * 0.2)) % 1;
          const ly = laneY + (lane[i] - 2.5) * laneGap * push;
          const x = mix(laneX0, laneX1, u);
          const y = ly + Math.sin(u * Math.PI * 2 * 1.5 + lane[i]) * laneGap * 0.16;
          if (desktop && x < laneX0 + 34) continue;
          ctx.fillStyle = rgba(fg, labelAlpha * 0.92);
          ctx.fillText(l.text, x + 9, y);
        }
        // asset-class names at the head of each stream
        ctx.font = `600 10px ${font}`;
        LANES.forEach((cls, li) => {
          const y = laneY + (li - 2.5) * laneGap * push;
          const x0 = desktop ? laneX0 : Math.max(21, w * 0.055);
          // a hairline for each stream, and its asset class at the head
          ctx.strokeStyle = rgba(fg, labelAlpha * 0.1);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.fillStyle = rgba(fg, labelAlpha * 0.62);
          ctx.fillText(LANE_LABEL[cls].toUpperCase(), x0, y - laneGap * 0.36);
        });
      }

      // the wireframe draws itself as the streams arrive
      const draw = win(p, 0.74, 0.9) * (1 - settle);
      if (draw > 0.01) {
        const k = box.w / 610;
        ctx.lineWidth = 1;
        for (const sgm of WIRE) {
          ctx.strokeStyle = sgm.accent ? rgba(BLUE, draw * 0.9) : rgba(fg, draw * 0.22);
          ctx.beginPath();
          ctx.moveTo(box.x + sgm.a[0] * k, box.y + sgm.a[1] * k);
          ctx.lineTo(box.x + mix(sgm.a[0], sgm.b[0], draw) * k, box.y + mix(sgm.a[1], sgm.b[1], draw) * k);
          ctx.stroke();
        }
      }

      // the drawing settles into the finished illustration
      figure.style.opacity = String(settle);
      figure.style.transform = `translateY(${(1 - settle) * 8}px)`;

      // captions: one statement at a time, on the reading side
      const active = p < 0.15 ? 0 : p < 0.35 ? 1 : p < 0.66 ? 2 : 3;
      beatRefs.current.forEach((el, i) => {
        if (!el) return;
        const on = i === active;
        el.style.opacity = on ? "1" : "0";
        el.style.transform = on ? "none" : `translateY(${i < active ? -13 : 13}px)`;
        el.style.pointerEvents = on ? "auto" : "none";
        el.setAttribute("aria-hidden", on ? "false" : "true");
      });
      if (railRef.current) railRef.current.style.transform = `scaleY(${clamp01(p)})`;

      if (visible) raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      const r = scene.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      target = span > 0 ? clamp01(-r.top / span) : 0;
    };

    const start = () => {
      if (live) return;
      live = true;
      scene.classList.add("is-live");
      readTheme();
      build();
      onScroll();
      p = target;
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    const stop = () => {
      if (!live) return;
      live = false;
      cancelAnimationFrame(raf);
      scene.classList.remove("is-live");
      window.removeEventListener("scroll", onScroll);
      stage.style.backgroundColor = "";
      stage.classList.add("on-night");
      figure.removeAttribute("style");
      beatRefs.current.forEach((el) => el?.removeAttribute("style"));
      beatRefs.current.forEach((el) => el?.removeAttribute("aria-hidden"));
    };

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting && live;
        cancelAnimationFrame(raf);
        if (!visible) delete root.dataset.chrome;
        if (visible) raf = requestAnimationFrame(frame);
      },
      { rootMargin: "20% 0px" },
    );
    const sync = () => {
      if (still()) stop();
      else start();
      io.disconnect();
      io.observe(scene);
    };
    const ro = new ResizeObserver(() => {
      if (live) {
        build();
        onScroll();
      }
    });
    const onPrefs = () => requestAnimationFrame(() => {
      readTheme();
      sync();
    });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    sync();
    ro.observe(stage);
    window.addEventListener("gx:prefs", onPrefs);
    mq.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      delete root.dataset.chrome;
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("gx:prefs", onPrefs);
      mq.removeEventListener("change", sync);
    };
  }, []);

  return (
    <section ref={sceneRef} className="gx-seq relative" aria-labelledby="seq-title">
      <div ref={stageRef} className="gx-seq-stage on-night relative overflow-hidden">
        <canvas ref={canvasRef} aria-hidden className="gx-seq-canvas pointer-events-none absolute inset-0 h-full w-full" />

        <div className="gx-seq-copy wrap relative">
          <p className="eyebrow" id="seq-title">
            From the world to the workspace
          </p>
          <div className="gx-seq-beats-wrap relative mt-21">
            <span aria-hidden className="gx-seq-rail absolute left-0 top-0 h-full w-px bg-line">
              <span ref={railRef} className="absolute inset-0 origin-top bg-accent" style={{ transform: "scaleY(0)" }} />
            </span>
            <ol className="gx-seq-beats">
              {BEATS.map((b, i) => (
                <li
                  key={b.k}
                  ref={(el) => {
                    beatRefs.current[i] = el;
                  }}
                  className="gx-seq-beat"
                >
                  <span className="num text-xs font-semibold tracking-[0.1em] text-prestige-ink">{b.k}</span>
                  <h2 className="h2 mt-8 max-w-[14ch]">{b.t}</h2>
                  <p className="lead mt-13 max-w-[30ch]">{b.d}</p>
                  {i === 3 && (
                    <p className="mt-21 flex flex-wrap gap-13">
                      <Link href="/platforms/raptor" className="btn btn-primary">
                        Explore Raptor
                      </Link>
                      <Link href="/markets" className="btn btn-ghost">
                        Browse the markets
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div ref={figureRef} className="gx-seq-figure">
          <TerminalStudy className="h-auto w-full" />
        </div>
        <p className="gx-seq-note text-xs text-ink-3">Centres at their real coordinates; instruments as listed by GIO4X. The workspace is an illustrative study, not a screenshot. No market data is shown.</p>
      </div>
    </section>
  );
}
