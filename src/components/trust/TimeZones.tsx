"use client";

import { useEffect, useRef, useState } from "react";
import { stateClass } from "@/components/markets/Now";
import { offsetLabel, zoneOffset } from "@/components/markets/time";
import { usePrefs } from "@/hooks/usePrefs";
import { centres, centreStatus, localTime, stateLabel, type CentreState } from "@/lib/sessions";

/**
 * The Earth's day as a band, for the "Time zones" chapter of the data
 * methodology page. A slim world strip (longitude across, latitude down) with
 * daylight drawn where the sun is up at this instant, the site's financial
 * centres at their real coordinates, and a marker on the meridian of the
 * visitor's own zone.
 *
 * Everything is the device clock converted with the browser's IANA database:
 * a schedule, not a data feed. Opening state is each venue's regular weekday
 * timetable from src/lib/sessions.ts; holidays are not reflected.
 *
 * The server renders a neutral placeholder; times are filled in after mount.
 */

type RGB = [number, number, number];

type Palette = {
  ink: string;
  muted: string;
  frame: string;
  accent: string;
  paper: string;
  pos: string;
  warn: string;
  sun: string;
  night: RGB;
  day: RGB;
  glint: RGB;
  font: string;
};

/** What the drawing needs from the last React render. */
type Model = {
  youLon: number;
  youLabel: string;
  active: string | null;
  centres: { key: string; lon: number; lat: number; state: CentreState; line: string }[];
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
/** strip geometry, CSS pixels: room above for the "you" caret, below for noon and midnight */
const TOP = 21;
const BOTTOM = 21;
/** latitudes at the strip's top and bottom edge: wide enough for every centre */
const LAT_N = 68;
const LAT_S = -52;
/** the daylight field is computed coarsely and scaled up, which is also what softens the terminator */
const BAND_W = 180;
const BAND_H = 40;
const SWEEP_MS = 21_000;

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const two = (n: number) => String(n).padStart(2, "0");
const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Where the sun is overhead at a given instant: longitude and declination in
 * degrees. The low-precision solar position of the Astronomical Almanac, good
 * to about a hundredth of a degree, which is far finer than a pixel here.
 */
function subsolar(ms: number): { lon: number; dec: number } {
  const n = ms / 86_400_000 - 10_957.5; // days since 2000-01-01 12:00 UTC
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lam = (280.46 + 0.9856474 * n) * RAD + 1.915 * RAD * Math.sin(g) + 0.02 * RAD * Math.sin(2 * g);
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (280.46061837 + 360.98564736629 * n) * RAD;
  return { lon: wrap180((ra - gmst) / RAD), dec: dec / RAD };
}

const FRACTION: Record<number, string> = { 15: "¼", 30: "½", 45: "¾" };

/** "5 h", "5½ h", "45 min". Zone offsets differ by quarter hours at the finest. */
function span(mins: number): string {
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  const f = FRACTION[m];
  return f ? `${h}${f} h` : `${h} h ${m} min`;
}

/** "5 h ahead of you", "3½ h behind you". `diff` is the other zone minus yours, in minutes. */
const versusYou = (diff: number) => (diff === 0 ? "the same time as you" : `${span(diff)} ${diff > 0 ? "ahead of" : "behind"} you`);

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Design tokens as the canvas needs them. Re-read whenever theme or accent changes. */
function readPalette(el: HTMLElement, probe: CanvasRenderingContext2D | null): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim() || cs.color;
  // the daylight field is written pixel by pixel, so those tokens are resolved to channels
  const rgb = (value: string): RGB => {
    if (!probe) return [0, 0, 0];
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = cs.color;
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
  };
  const paper = rgb(v("--paper"));
  // on a dark page the lit side needs more of the sun's tone to read as day
  const warmth = paper[0] + paper[1] + paper[2] < 384 ? 0.5 : 0.26;
  return {
    ink: v("--ink"),
    muted: v("--ink-3"),
    frame: v("--line-strong"),
    accent: v("--accent"),
    paper: v("--paper"),
    pos: v("--pos"),
    warn: v("--warn"),
    sun: v("--tone-4"),
    night: rgb(v("--night")),
    day: mix(paper, rgb(v("--tone-4")), warmth),
    glint: rgb(v("--on-night")),
    font: cs.fontFamily || "sans-serif",
  };
}

export function TimeZones({ className = "" }: { className?: string }) {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Model | null>(null);
  const redrawRef = useRef<() => void>(() => {});

  const [prefs, , ready] = usePrefs();
  const [now, setNow] = useState<Date | null>(null);
  const [device, setDevice] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  /** the centre under the pointer or focus, and the one fixed by a click or tap */
  const [pick, setPick] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    const figure = figureRef.current;
    const canvas = canvasRef.current;
    if (!figure || !canvas) return;
    const ctx = canvas.getContext("2d");
    const band = document.createElement("canvas");
    band.width = BAND_W;
    band.height = BAND_H;
    const bctx = band.getContext("2d");
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = probeCanvas.height = 1;
    const probe = probeCanvas.getContext("2d", { willReadFrequently: true });

    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStill = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    let pal = readPalette(canvas, probe);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let timer = 0;
    let inView = false;
    let last = 0;
    let bandAt = 0;
    let sun = subsolar(Date.now());
    // the join to "you" draws itself in when a centre is picked
    let shown: string | null = null;
    let amt = 0;

    const awake = () => inView && !document.hidden;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.round(r.width);
      h = Math.round(r.height);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };

    /** Daylight for this instant: the sun's altitude at every cell, eased across twilight. */
    const paintBand = (ms: number) => {
      if (!bctx) return;
      sun = subsolar(ms);
      bandAt = ms;
      const img = bctx.createImageData(BAND_W, BAND_H);
      const sd = Math.sin(sun.dec * RAD);
      const cd = Math.cos(sun.dec * RAD);
      for (let j = 0; j < BAND_H; j++) {
        const lat = (LAT_N - ((j + 0.5) / BAND_H) * (LAT_N - LAT_S)) * RAD;
        const sl = Math.sin(lat);
        const cl = Math.cos(lat);
        for (let i = 0; i < BAND_W; i++) {
          const lon = -180 + ((i + 0.5) / BAND_W) * 360;
          const alt = sl * sd + cl * cd * Math.cos((lon - sun.lon) * RAD);
          const k = clamp((alt + 0.17) / 0.27, 0, 1);
          const c = mix(pal.night, pal.day, k * k * (3 - 2 * k));
          const o = (j * BAND_W + i) * 4;
          img.data[o] = c[0];
          img.data[o + 1] = c[1];
          img.data[o + 2] = c[2];
          img.data[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
    };

    const draw = (ts: number) => {
      const m = modelRef.current;
      if (!ctx || !m || w < 2 || h < 2) return;
      const quiet = isStill();
      const dt = last ? Math.min(100, ts - last) : 16;
      last = ts;
      const ms = Date.now();
      if (ms - bandAt > 20_000) paintBand(ms);

      const sx = 0.5;
      const sy = TOP + 0.5;
      const sw = w - 1;
      const sh = h - TOP - BOTTOM - 1;
      const X = (lon: number) => sx + ((lon + 180) / 360) * sw;
      const Y = (lat: number) => sy + ((LAT_N - lat) / (LAT_N - LAT_S)) * sh;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      ctx.textBaseline = "alphabetic";

      // the band: daylight, the 24 nominal hours as columns, the equator
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, sw, sh);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(band, sx, sy, sw, sh);
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = pal.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 24; i++) {
        const x = Math.round(sx + (i / 24) * sw) + 0.5;
        ctx.moveTo(x, sy);
        ctx.lineTo(x, sy + sh);
      }
      const eq = Math.round(Y(0)) + 0.5;
      ctx.moveTo(sx, eq);
      ctx.lineTo(sx + sw, eq);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // a slow sweep of light, travelling west as the day does
      if (!quiet) {
        const gw = sw * 0.17;
        const cx = sx + sw + gw - ((ts % SWEEP_MS) / SWEEP_MS) * (sw + gw * 2);
        const g = ctx.createLinearGradient(cx - gw, 0, cx + gw, 0);
        g.addColorStop(0, rgba(pal.glint, 0));
        g.addColorStop(0.5, rgba(pal.glint, 0.16));
        g.addColorStop(1, rgba(pal.glint, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - gw, sy, gw * 2, sh);
      }

      // now: the meridian where it is solar noon, and the sun over it
      const nx = X(sun.lon);
      ctx.strokeStyle = pal.sun;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, sy);
      ctx.lineTo(nx, sy + sh);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(nx, Y(sun.dec), 6.5, 0, TAU);
      ctx.fillStyle = pal.paper;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nx, Y(sun.dec), 4.5, 0, TAU);
      ctx.fillStyle = pal.sun;
      ctx.fill();

      // you: the meridian of your zone, cased so it reads over day and night alike
      const yx = X(m.youLon);
      ctx.strokeStyle = pal.paper;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(yx, sy);
      ctx.lineTo(yx, sy + sh);
      ctx.stroke();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // the centres: filled inside regular hours, half at pre-open or the midday break, hollow outside
      if (m.active !== shown) {
        shown = m.active;
        amt = 0;
      }
      amt = quiet ? 1 : amt + (1 - amt) * Math.min(1, dt / 130);
      const act = m.centres.find((c) => c.key === m.active) ?? null;
      for (const c of m.centres) {
        const on = c === act;
        const x = X(c.lon);
        const y = Y(c.lat);
        const r = on ? 3.5 + 1.5 * amt : 3.5;
        ctx.globalAlpha = act && !on ? 0.5 : 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.75, 0, TAU);
        ctx.fillStyle = pal.paper;
        ctx.fill();
        if (c.state === "open") {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fillStyle = pal.pos;
          ctx.fill();
        } else {
          const tone = c.state === "closed" ? pal.ink : pal.warn;
          if (c.state !== "closed") {
            ctx.beginPath();
            ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);
            ctx.fillStyle = tone;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(x, y, r - 0.6, 0, TAU);
          ctx.strokeStyle = tone;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // the picked centre: ringed, and joined to your meridian
      let tag: { text: string; x: number; y: number } | null = null;
      if (act) {
        const x = X(act.lon);
        const y = Y(act.lat);
        const ex = x + (yx - x) * amt;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(x + Math.sign(yx - x) * Math.min(9, Math.abs(yx - x)), y);
          ctx.lineTo(ex, y);
        };
        if (Math.abs(ex - x) > 9) {
          path();
          ctx.strokeStyle = pal.paper;
          ctx.lineWidth = 3.5;
          ctx.stroke();
          path();
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, TAU);
        ctx.strokeStyle = pal.paper;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (Math.abs(ex - x) > 9) {
          ctx.beginPath();
          ctx.arc(ex, y, 4.5, 0, TAU);
          ctx.fillStyle = pal.paper;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex, y, 3, 0, TAU);
          ctx.fillStyle = pal.accent;
          ctx.fill();
        }
        tag = { text: act.line, x: (x + yx) / 2, y: y - 34 < sy ? y + 16 : y - 34 };
      }
      ctx.restore();

      ctx.strokeStyle = pal.frame;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, sw, sh);

      // the difference in words, on the join
      if (tag) {
        ctx.font = `600 11px ${pal.font}`;
        const tw = ctx.measureText(tag.text).width;
        const bw = tw + 16;
        const bx = clamp(tag.x - bw / 2, sx + 3, sx + sw - bw - 3);
        ctx.globalAlpha = amt;
        ctx.fillStyle = pal.ink;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(bx, tag.y, bw, 20, 2);
        else ctx.rect(bx, tag.y, bw, 20);
        ctx.fill();
        ctx.fillStyle = pal.paper;
        ctx.textAlign = "left";
        ctx.fillText(tag.text, bx + 8, tag.y + 14);
        ctx.globalAlpha = 1;
      }

      // above the band: the caret and label for your zone
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(yx - 5, sy - 8);
      ctx.lineTo(yx + 5, sy - 8);
      ctx.lineTo(yx, sy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.font = `600 11px ${pal.font}`;
      const lw = ctx.measureText(m.youLabel).width;
      const right = yx + 10 + lw <= w;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(m.youLabel, right ? yx + 10 : yx - 10, sy - 7);

      // below the band: solar noon and midnight
      ctx.font = `500 11px ${pal.font}`;
      ctx.textAlign = "left";
      ctx.fillStyle = pal.muted;
      ctx.strokeStyle = pal.muted;
      ctx.lineWidth = 1;
      for (const [label, lon] of [
        ["Solar noon", sun.lon],
        ["Midnight", wrap180(sun.lon + 180)],
      ] as const) {
        const x = X(lon);
        const tw = ctx.measureText(label).width;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, sy + sh);
        ctx.lineTo(Math.round(x) + 0.5, sy + sh + 5);
        ctx.stroke();
        ctx.fillText(label, clamp(x - tw / 2, 0, w - tw), sy + sh + 17);
      }
    };

    const frame = (ts: number) => {
      raf = 0;
      draw(ts);
      if (awake() && !isStill()) raf = requestAnimationFrame(frame);
    };
    const redraw = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    redrawRef.current = redraw;

    // the clock text: each second while it is on screen, each minute when motion is reduced
    const tick = () => {
      window.clearTimeout(timer);
      setNow(new Date());
      if (!awake()) return;
      const step = isStill() ? 60_000 : 1000;
      timer = window.setTimeout(tick, step - (Date.now() % step) + 13);
    };
    const wake = () => {
      last = 0;
      if (awake()) {
        tick();
        redraw();
      } else {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const ro = new ResizeObserver(() => {
      resize();
      redraw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      wake();
    });
    io.observe(figure);
    const onPrefs = () => {
      setStill(isStill());
      // theme or accent changed: re-read the tokens once the new values are applied
      requestAnimationFrame(() => {
        pal = readPalette(canvas, probe);
        bandAt = 0;
        wake();
      });
    };

    setDevice(deviceZone());
    setStill(isStill());
    setNow(new Date());
    resize();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("gx:prefs", onPrefs);
    reduced.addEventListener("change", onPrefs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("gx:prefs", onPrefs);
      reduced.removeEventListener("change", onPrefs);
      redrawRef.current = () => {};
    };
  }, []);

  // "you": the zone chosen in preferences, otherwise the device's
  const chosen = ready && prefs.tz !== "local" && validZone(prefs.tz) ? prefs.tz : null;
  const zone = chosen ?? device;
  const active = pick ?? pin;

  const you = now && zone ? { local: localTime(now, zone), off: zoneOffset(now, zone) } : null;
  const rows =
    now && you
      ? centres.map((c) => {
          const s = centreStatus(c, now);
          const off = zoneOffset(now, c.tz);
          return { c, s, off, diff: off - you.off };
        })
      : null;
  const sel = rows?.find((r) => r.c.key === active) ?? null;
  // zone offsets are whole minutes, so every zone shares the UTC second
  const sec = now && !still ? `:${two(now.getUTCSeconds())}` : "";

  modelRef.current =
    you && rows
      ? {
          youLon: wrap180(you.off / 4),
          youLabel: `You · ${offsetLabel(you.off)}`,
          active,
          centres: rows.map((r) => ({ key: r.c.key, lon: r.c.lon, lat: r.c.lat, state: r.s.state, line: `${r.c.city} · ${versusYou(r.diff)}` })),
        }
      : null;

  useEffect(() => {
    redrawRef.current();
  });

  /** The centre nearest a pointer position on the strip. */
  const nearest = (e: { clientX: number; clientY: number }): string | null => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const sh = r.height - TOP - BOTTOM;
    let best: string | null = null;
    let bestD = Infinity;
    for (const c of centres) {
      const dx = ((c.lon + 180) / 360) * r.width - (e.clientX - r.left);
      const dy = TOP + ((LAT_N - c.lat) / (LAT_N - LAT_S)) * sh - (e.clientY - r.top);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c.key;
      }
    }
    return best;
  };

  const clock = (label: string) => (
    <>
      {label}
      {sec && <span className="text-ink-3">{sec}</span>}
    </>
  );

  return (
    <figure ref={figureRef} className={`max-w-measure lg:max-w-none ${className}`} aria-live="off">
      <div className="flex items-start justify-between gap-13 border-t-2 border-ink pt-13">
        <div>
          <p className="label">{chosen ? "Your chosen zone" : "Your clock"}</p>
          <p className="num mt-3 font-display text-2xl font-light">{you ? clock(you.local.label) : "--:--"}</p>
          <p className="num mt-3 text-xs text-ink-3">{you && zone ? `${zone} · ${offsetLabel(you.off)}` : "Reading your clock…"}</p>
        </div>
        <div className="text-right">
          <p className="label">{sel ? `${sel.c.city} · ${sel.c.venue}` : "UTC"}</p>
          <p className="num mt-3 font-display text-2xl font-light">{sel ? clock(sel.s.local.label) : now ? clock(`${two(now.getUTCHours())}:${two(now.getUTCMinutes())}`) : "--:--"}</p>
          <p className="num mt-3 text-xs text-ink-3">
            {sel ? sel.c.tz : "Coordinated Universal Time"}
            {you && (
              <>
                {" · "}
                <span className="whitespace-nowrap text-ink">{versusYou(sel ? sel.diff : -you.off)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="mt-13 block h-[9rem] w-full touch-pan-y"
        aria-hidden
        onPointerMove={(e) => setPick(nearest(e))}
        onPointerLeave={() => setPick(null)}
        onClick={(e) => {
          const k = nearest(e);
          setPin((p) => (p === k ? null : k));
        }}
      />

      {/* the same information as text: every centre's time, its difference from yours, its regular-hours state */}
      <ul className="mt-13 grid grid-cols-2 gap-x-8 border-t border-line-strong sm:grid-cols-3" aria-label="Local time now at each financial centre">
        {centres.map((c) => {
          const r = rows?.find((x) => x.c.key === c.key) ?? null;
          const day = r && you && r.s.local.weekday !== you.local.weekday ? WEEKDAY[r.s.local.weekday] : null;
          return (
            <li key={c.key} className="flat border-b border-line">
              <button
                type="button"
                className={`block w-full px-5 py-8 text-left transition-colors duration-fast ${active === c.key ? "bg-surface-2" : ""}`}
                aria-pressed={pin === c.key}
                onClick={() => setPin((p) => (p === c.key ? null : c.key))}
                onPointerEnter={() => setPick(c.key)}
                onPointerLeave={() => setPick(null)}
                onFocus={() => setPick(c.key)}
                onBlur={() => setPick(null)}
              >
                <span className="flex items-baseline justify-between gap-x-8">
                  <span className={`text-sm font-medium ${pin === c.key ? "text-accent" : ""}`}>{c.city}</span>
                  <span className="sr-only">
                    , {c.venue}, {c.tz}:
                  </span>
                  <span className="num whitespace-nowrap text-sm">
                    {day && <span className="text-xs text-ink-3">{day} </span>}
                    {r ? clock(r.s.local.label) : "--:--"}
                  </span>
                </span>
                <span className="mt-3 flex flex-wrap items-center justify-between gap-x-8">
                  <span className={`state ${r ? stateClass[r.s.state] : "state-off"}`}>{r ? stateLabel[r.s.state] : "…"}</span>
                  <span className="num whitespace-nowrap text-xs text-ink-3">{r ? (r.diff === 0 ? "same time" : `${span(r.diff)} ${r.diff > 0 ? "ahead" : "behind"}`) : ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <figcaption className="mt-13 text-xs text-ink-3">
        Your device clock, converted to each centre’s own zone. Daylight is drawn from the sun’s position at the same instant. Regular weekday timetables. Holidays are not reflected.
      </figcaption>
    </figure>
  );
}
