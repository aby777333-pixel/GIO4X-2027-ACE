"use client";

import { useEffect, useRef } from "react";
import { frameOf, stageCanvas } from "@/components/cockpit/stage";
import { INTRO_END } from "@/lib/boot";

const SECTIONS = ["Markets", "Platforms", "Tools", "Intelligence"];

/* The intro's timeline, in milliseconds. With the logo already loaded it runs 2.5 seconds (it was 3.15):
   a title reveal, not a wait. A logo that arrives late can add at most WAIT_MS - DRIFT_MS to that. */
/** particles drift in the night */
const DRIFT_MS = 450;
/** the latest the logo may arrive; past this the intro gives way to the page */
const WAIT_MS = 900;
/** they gather into the mark */
const GATHER_MS = 950;
/** the mark stands, and a glint crosses it */
const HOLD_MS = 400;
/** they stream to the hero's frame and dissolve while the night lifts */
const HAND_MS = 700;
/** a skipped intro fades in this long (transition.css) */
const SKIP_MS = 220;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * THE INTRO — the logo forms from particles and hands over to the homepage hero.
 *
 * Canvas 2D, one surface the size of the window at a capped pixel ratio, 2,600
 * particles on a laptop and 1,100 on a phone. The shape and the colours are the
 * real logo's: it is drawn once to an offscreen canvas and its opaque pixels
 * are read (one `getImageData`, a same-origin image), and each particle takes
 * one of them as its place and its colour.
 *
 * The hero is running underneath the whole time. At the hand-over the night
 * lifts (CSS), the particles fly to the hero's own champagne frame (the engine
 * says where it is: `data-frame`) and fade there, so what is left is the hero.
 *
 * Returns the function that stops it without ending it (for an effect cleanup);
 * `onEnd` is called once when it ends by itself or is skipped.
 */
function playIntro(host: HTMLElement, canvas: HTMLCanvasElement, skipButton: HTMLButtonElement | null, logo: HTMLImageElement | null, onEnd: () => void): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    onEnd();
    return () => {};
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  const phone = W < 720;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  const N = phone ? 1100 : 2600;
  // where each particle drifts, how, and when it sets off
  const x0 = new Float32Array(N);
  const y0 = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const phase = new Float32Array(N);
  const delay = new Float32Array(N);
  const size = new Float32Array(N);
  // its place in the mark, and its place on the hero's frame
  const tx = new Float32Array(N);
  const ty = new Float32Array(N);
  const fx = new Float32Array(N);
  const fy = new Float32Array(N);
  const bx = new Float32Array(N);
  const by = new Float32Array(N);
  // this frame's position, light and gathering
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const pa = new Float32Array(N);
  const pk = new Float32Array(N);
  // colour: an index into `colours`, and the particles in colour order so the fill style changes a few times a frame, not thousands
  const tone = new Uint16Array(N);
  const order = new Uint16Array(N);
  const colours: string[] = [];

  for (let i = 0; i < N; i++) {
    x0[i] = Math.random() * W;
    y0[i] = Math.random() * H;
    const a = Math.random() * Math.PI * 2;
    const v = 6 + Math.random() * 16;
    vx[i] = Math.cos(a) * v;
    vy[i] = Math.sin(a) * v - 5;
    phase[i] = Math.random() * Math.PI * 2;
    delay[i] = Math.random();
    size[i] = 1.1 + Math.random() * 1.2;
    bx[i] = (Math.random() - 0.5) * 89;
    by[i] = (Math.random() - 0.5) * 89;
    order[i] = i;
  }

  // the mark: where it stands, and whether it has been read yet
  let lw = 0;
  let lh = 0;
  let lx = 0;
  let ly = 0;
  let sampled = false;
  const sample = (): boolean => {
    if (!logo || !logo.complete || !logo.naturalWidth) return false;
    lw = Math.round(Math.min(W * (phone ? 0.76 : 0.42), 560));
    lh = Math.round((lw * logo.naturalHeight) / logo.naturalWidth);
    lx = Math.round((W - lw) / 2);
    ly = Math.round(H * 0.46 - lh / 2);
    const off = document.createElement("canvas");
    off.width = lw;
    off.height = lh;
    const o = off.getContext("2d", { willReadFrequently: true });
    if (!o) return false;
    let data: Uint8ClampedArray;
    try {
      o.drawImage(logo, 0, 0, lw, lh);
      data = o.getImageData(0, 0, lw, lh).data;
    } catch {
      return false;
    }
    const total = lw * lh;
    let solid = 0;
    for (let p = 0; p < total; p++) if (data[p * 4 + 3] > 150) solid++;
    if (solid < 200) return false;
    // each particle takes one opaque pixel, spread evenly through all of them
    const index = new Map<number, number>();
    let seen = 0;
    let n = 0;
    for (let p = 0; p < total && n < N; p++) {
      if (data[p * 4 + 3] <= 150) continue;
      if (seen * N >= n * solid) {
        tx[n] = lx + (p % lw) + 0.5;
        ty[n] = ly + Math.floor(p / lw) + 0.5;
        const r = data[p * 4];
        const g = data[p * 4 + 1];
        const b = data[p * 4 + 2];
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        let c = index.get(key);
        if (c === undefined) {
          c = colours.length;
          colours.push(`rgb(${r},${g},${b})`);
          index.set(key, c);
        }
        tone[n] = c;
        n++;
      }
      seen++;
    }
    if (n < 1) return false;
    // a mark with fewer pixels than particles: the rest double up beside one that has a place
    for (let i = n; i < N; i++) {
      const j = i % n;
      tx[i] = tx[j] + (Math.random() - 0.5) * 1.2;
      ty[i] = ty[j] + (Math.random() - 0.5) * 1.2;
      tone[i] = tone[j];
    }
    order.sort((a, b) => tone[a] - tone[b]);
    return true;
  };

  /** The hero's frame, from the engine; before the engine has drawn, about where it will be. */
  const aim = () => {
    const stage = stageCanvas();
    const frame = stage ? frameOf(stage) : null;
    let left = W >= 1080 ? W * 0.5 : W * 0.08;
    let top = W >= 1080 ? H * 0.2 : H * 0.14;
    let width = W >= 1080 ? W * 0.44 : W * 0.84;
    let height = width / 1.618;
    if (stage && frame) {
      const r = stage.getBoundingClientRect();
      left = r.left + frame.left;
      top = r.top + frame.top;
      width = frame.width;
      height = frame.height;
    }
    const around = 2 * (width + height);
    for (let i = 0; i < N; i++) {
      if (Math.random() < 0.72) {
        // on the frame itself
        let u = Math.random() * around;
        if (u < width) {
          fx[i] = left + u;
          fy[i] = top;
        } else if ((u -= width) < height) {
          fx[i] = left + width;
          fy[i] = top + u;
        } else if ((u -= height) < width) {
          fx[i] = left + width - u;
          fy[i] = top + height;
        } else {
          fx[i] = left;
          fy[i] = top + height - (u - width);
        }
      } else {
        // and into the instrument
        fx[i] = left + Math.random() * width;
        fy[i] = top + Math.random() * height;
      }
    }
  };

  let raf = 0;
  let timer = 0;
  let stopped = false;
  let handed = false;
  let leaving = false;
  /** when the gathering began, in the intro's own time; -1 until the mark has been read */
  let gatherAt = -1;
  const t0 = performance.now();
  const handAt = GATHER_MS + HOLD_MS;
  const endAt = handAt + HAND_MS;

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    window.removeEventListener("keydown", skip);
    window.removeEventListener("pointerdown", skip);
    window.removeEventListener("wheel", skip);
    window.removeEventListener("touchstart", skip);
    skipButton?.removeEventListener("click", skip);
  };
  const finish = () => {
    if (stopped) return;
    stop();
    onEnd();
  };
  function skip() {
    if (stopped || leaving) return;
    leaving = true;
    // the page is the visitor's at once (pointer-events: none); the picture takes a moment to go
    host.dataset.out = "skip";
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, SKIP_MS);
  }

  const frame = (now: number) => {
    raf = 0;
    if (stopped) return;
    const t = now - t0;
    if (gatherAt < 0) {
      if (!sampled) sampled = sample();
      if (sampled && t >= DRIFT_MS) gatherAt = t;
      else if (t > WAIT_MS) return skip();
    }
    const g = gatherAt < 0 ? -1 : t - gatherAt;
    if (g >= endAt) return finish();
    if (g >= handAt && !handed) {
      handed = true;
      aim();
      // the night lifts and the page underneath takes the pointer back
      if (!leaving) host.dataset.out = "hand";
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    const rise = clamp(t / 420);
    const sec = t / 1000;
    for (let i = 0; i < N; i++) {
      // adrift
      let x = x0[i] + vx[i] * sec + Math.sin(sec * 1.1 + phase[i]) * 8;
      let y = y0[i] + vy[i] * sec + Math.cos(sec * 0.9 + phase[i]) * 8;
      const twinkle = 0.5 + 0.5 * Math.sin(sec * 2.6 + phase[i] * 3);
      let a = (0.28 + 0.47 * twinkle) * rise;
      let k = 0;
      if (g >= 0) {
        // gathering: each sets off in its own time and eases into its place
        k = easeInOut(clamp((g - delay[i] * GATHER_MS * 0.38) / (GATHER_MS * 0.62)));
        x += (tx[i] - x) * k;
        y += (ty[i] - y) * k;
        a += (0.92 - a) * k;
        if (g >= handAt) {
          // handing over: away to the frame, on a slight curve, fading as it arrives
          const h = clamp((g - handAt - delay[i] * HAND_MS * 0.3) / (HAND_MS * 0.7));
          const e = h * h * (3 - 2 * h);
          const bow = Math.sin(Math.PI * e);
          x += (fx[i] - x) * e + bx[i] * bow;
          y += (fy[i] - y) * e + by[i] * bow;
          const gone = clamp((e - 0.55) / 0.45);
          a *= 1 - gone * gone;
        }
      }
      px[i] = x;
      py[i] = y;
      pa[i] = a;
      pk[i] = k;
    }

    // the mark itself comes up under its particles as they settle, so it is whole and sharp for the held beat
    if (g >= 0 && sampled && logo) {
      const up = clamp((g - GATHER_MS * 0.78) / (GATHER_MS * 0.3));
      const off = clamp((g - handAt) / 260);
      const la = up * (1 - off) * 0.9;
      if (la > 0.004) {
        ctx.globalAlpha = la;
        ctx.drawImage(logo, lx, ly, lw, lh);
      }
    }

    ctx.globalCompositeOperation = "lighter";
    // dust, before it has a colour
    ctx.fillStyle = "#cfd8de";
    for (let i = 0; i < N; i++) {
      const a = pa[i] * (1 - pk[i]);
      if (a < 0.012) continue;
      const s = size[i];
      ctx.globalAlpha = a;
      ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
    }
    // and in the logo's colours as it finds its place. Painted plainly, not added: where particles
    // lie on one another and on the mark, the colour stays the logo's own instead of burning out.
    ctx.globalCompositeOperation = "source-over";
    if (g >= 0) {
      let current = -1;
      for (let n = 0; n < N; n++) {
        const i = order[n];
        const a = pa[i] * pk[i];
        if (a < 0.012) continue;
        if (tone[i] !== current) {
          current = tone[i];
          ctx.fillStyle = colours[current];
        }
        const s = size[i];
        ctx.globalAlpha = a;
        ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
      }
    }

    if (g >= GATHER_MS * 0.9 && g < handAt + 200) {
      // the glint: a soft band of light crossing the mark once, drawn only on what is already there
      const q = clamp((g - GATHER_MS * 0.9) / (HOLD_MS + GATHER_MS * 0.1));
      const at = lx + (q * 1.5 - 0.25) * lw;
      const band = Math.max(55, lw * 0.16);
      const light = ctx.createLinearGradient(at - band, ly, at + band, ly + lh * 0.6);
      light.addColorStop(0, "rgba(255,255,255,0)");
      light.addColorStop(0.5, `rgba(255,255,255,${0.7 * Math.sin(Math.PI * q)})`);
      light.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 1;
      ctx.fillStyle = light;
      ctx.fillRect(lx - 8, ly - 8, lw + 16, lh + 16);
    }

    if (g >= 0 && g < handAt + 400) {
      // a pool of light behind the mark, drawn behind everything
      const on = easeInOut(clamp(g / GATHER_MS)) * (1 - clamp((g - handAt) / 400));
      const cx = lx + lw / 2;
      const cy = ly + lh / 2;
      const R = lw * 0.75;
      const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      pool.addColorStop(0, `rgba(75,166,226,${0.16 * on})`);
      pool.addColorStop(0.5, `rgba(75,166,226,${0.05 * on})`);
      pool.addColorStop(1, "rgba(75,166,226,0)");
      ctx.globalCompositeOperation = "destination-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = pool;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }

    raf = requestAnimationFrame(frame);
  };

  const opts = { passive: true } as const;
  window.addEventListener("keydown", skip, opts);
  window.addEventListener("pointerdown", skip, opts);
  window.addEventListener("wheel", skip, opts);
  window.addEventListener("touchstart", skip, opts);
  // a screen reader's activation is a click with no key or pointer before it
  skipButton?.addEventListener("click", skip);
  // a tab in the background draws nothing: the intro still ends on time
  timer = window.setTimeout(finish, WAIT_MS + endAt + 600);
  raf = requestAnimationFrame(frame);
  return stop;
}

/**
 * THE START-UP — shown once per browser, on the first page of the first visit.
 *
 * The markup is always in the page and always hidden; the boot script (lib/boot)
 * decides before first paint whether this visit shows it, and which form:
 *
 *   - the homepage: THE INTRO. The logo forms from particles and hands over to
 *     the hero, in two and a half seconds. "Skip", Escape, any other key, a click,
 *     a touch or the wheel ends it at once. The canvas is decorative; a screen
 *     reader is told "GIO4X", and the keyboard starts on "Skip" and is handed
 *     back when it ends. Focus is never held.
 *   - any other page: the short power-on. It is CSS (cockpit.css) and ends on
 *     its own in under two seconds; this component only lets a key, a click,
 *     a touch or the wheel end it sooner, and clears the flag afterwards.
 *     The four lamps are the site's own sections coming up, not connection
 *     claims: nothing here says a market feed is live.
 *
 * Neither can hold the site back: both end by themselves in CSS should this
 * script never run. When the intro ends it says so on `window` (INTRO_END),
 * which is what the tour's invitation waits for.
 */
export function CockpitBoot() {
  const introRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const saidRef = useRef<HTMLParagraphElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const boot = root.dataset.boot;

    // "play" at this point is the intro being taken up again after a remount (development's double effect)
    if (boot === "intro" || boot === "play") {
      const host = introRef.current;
      const canvas = canvasRef.current;
      const before = document.activeElement;
      const end = () => {
        const held = document.activeElement;
        delete root.dataset.boot;
        if (host) delete host.dataset.out;
        if (canvas) canvas.width = canvas.height = 0;
        if (saidRef.current) saidRef.current.textContent = "";
        // the keyboard goes back to where it was; "Skip" no longer exists
        if (held instanceof HTMLElement && host?.contains(held)) {
          held.blur();
          if (before instanceof HTMLElement && before.isConnected && before !== document.body && !host.contains(before)) before.focus({ preventScroll: true });
        }
        window.dispatchEvent(new Event(INTRO_END));
      };
      if (!host || !canvas) {
        end();
        return;
      }
      // from here the timeline is this script's, not the CSS fallback's
      root.dataset.boot = "play";
      if (saidRef.current) saidRef.current.textContent = "GIO4X";
      skipRef.current?.focus({ preventScroll: true });
      const stop = playIntro(host, canvas, skipRef.current, logoRef.current, end);
      return () => {
        stop();
        // a real unmount (the site shell leaving) must not leave the flag behind; a remount finds it and carries on
        window.setTimeout(() => {
          if (!host.isConnected && (root.dataset.boot === "play" || root.dataset.boot === "intro")) end();
        }, 0);
      };
    }

    if (boot !== "run") return;
    const end = () => {
      delete root.dataset.boot;
    };
    const timer = window.setTimeout(end, 1800);
    const skip = () => {
      window.clearTimeout(timer);
      end();
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("keydown", skip, opts);
    window.addEventListener("pointerdown", skip, opts);
    window.addEventListener("wheel", skip, opts);
    window.addEventListener("touchstart", skip, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, []);

  return (
    <>
      <div className="cx-boot" aria-hidden>
        <div className="cx-boot-inner">
          <picture className="cx-boot-logo">
            <source srcSet="/brand/gio4x-logo.webp" type="image/webp" />
            {/* also the shape and the colours the intro's particles take */}
            <img ref={logoRef} src="/brand/gio4x-logo.png" alt="" width={177} height={55} decoding="async" style={{ height: 55, width: "auto" }} />
          </picture>
          <span className="cx-boot-rule" />
          <p className="cx-boot-lamps">
            {SECTIONS.map((s, i) => (
              <span key={s} style={{ ["--i" as string]: i }}>
                {s}
              </span>
            ))}
          </p>
          <p className="cx-boot-ready">System ready</p>
        </div>
      </div>

      <div ref={introRef} className="gx-intro on-night no-print">
        <div className="gx-intro-night" aria-hidden />
        <canvas ref={canvasRef} className="gx-intro-canvas" aria-hidden />
        <p ref={saidRef} role="status" aria-live="polite" className="sr-only" />
        <button ref={skipRef} type="button" className="btn btn-ghost gx-intro-skip">
          Skip<span className="sr-only"> the introduction</span>
        </button>
      </div>
    </>
  );
}
