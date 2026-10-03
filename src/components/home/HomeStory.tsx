"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createStory, STORY_STATES, type StoryPalette } from "@/components/home/story-scene";

/**
 * The homepage as one shot. Three things, one scroll listener, one frame loop.
 *
 * 1  THE TRAVELLING INSTRUMENT. As the hero leaves, a small instrument comes
 *    away from the hero's frame and docks under the header. It stays with the
 *    visitor down the page and is four things in turn, each matched to the
 *    chapter being read: the market as a whole (a globe), one instrument (the
 *    form of a chart), an order (entry, target, stop) and the account (a
 *    statement). The passage between two states happens while the boundary
 *    between two chapters crosses the middle of the window.
 * 2  HEADINGS IN STEP. Each section's heading receives `--story-in` (0 to 1)
 *    from its position in the window; home.css uses it to draw the eyebrow's
 *    rule and settle the heading.
 * 3  DEPTH. Elements marked `data-depth="n"` shift by a few pixels with the
 *    scroll position and with the pointer: negative is behind the page,
 *    positive in front of it. `data-depth-pointer="off"` keeps the scroll part
 *    only.
 *
 * The scroll position is the only clock for 1 and 2 and for the scroll part of
 * 3, so scrubbing back reverses all of it exactly; nothing here runs by
 * itself. The pointer part of 3 eases toward the pointer and stops.
 *
 * It renders nothing on the server and adds nothing to the page's text, so
 * without JavaScript the page is as it was. Under reduced motion or "low
 * visual effects" nothing moves: no depth, no heading motion, and the
 * instrument shows whole states only (no passage, no flight, no turn). The
 * pointer part is off on touch. Below 820px the instrument is not shown at
 * all: there is no room for it beside the reading column.
 *
 * Honesty: the instrument is a set of fixed forms (see story-scene.ts) and
 * says so. It is decoration, hidden from assistive technology.
 */

/** the chapters, by the id of the heading that opens each one */
const CHAPTERS = [
  { n: "01", label: "The market", from: "asset-index" },
  { n: "02", label: "One instrument", from: "platforms-chapter" },
  { n: "03", label: "An order", from: "tools-home" },
  { n: "04", label: "The account", from: "accounts-home" },
] as const;
/** the instrument stands aside while these fill the window, and leaves for good at the last */
const ASIDE = ".gx-seq";
const END = "intel-home";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t: number) => t * t * (3 - 2 * t);

export function HomeStory() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    const anchor = anchorRef.current;
    const dock = dockRef.current;
    const canvas = canvasRef.current;
    const page = anchor?.parentElement;
    if (!anchor || !dock || !canvas || !page || !host) return;
    const ctx = canvas.getContext("2d");

    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = () => reduced.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";

    const hero = page.querySelector<HTMLElement>(".cx-home");
    const heroCanvas = hero?.querySelector<HTMLCanvasElement>("canvas.cx-scene") ?? null;
    const sectionOf = (id: string) => document.getElementById(id)?.closest<HTMLElement>("section") ?? null;
    const starts = CHAPTERS.map((c) => sectionOf(c.from));
    const aside = page.querySelector<HTMLElement>(ASIDE);
    const end = sectionOf(END);
    const heads = [...page.querySelectorAll<HTMLElement>(":scope > section[aria-labelledby]")].filter((s) => !s.matches(".cx-hero, .gx-seq") && s.querySelector("h2"));
    const layers = [...page.querySelectorAll<HTMLElement>("[data-depth]")].map((el) => ({
      el: el as HTMLElement,
      d: Number(el.dataset.depth) || 0,
      pointer: el.dataset.depthPointer !== "off",
      frame: el.closest<HTMLElement>("section") ?? el,
      last: "",
    }));
    // the hero's instrument is the middle distance: scroll only, since its scene turns its own camera to the pointer
    if (heroCanvas && hero) layers.push({ el: heroCanvas, d: -3, pointer: false, frame: hero, last: "" });
    const headIn = new Map<HTMLElement, number>();

    const story = createStory();
    let pal: StoryPalette = { ink: "#eef0f1", accent: "#5ab0e8", gold: "#cdb98a" };
    const readPalette = () => {
      const cs = getComputedStyle(dock);
      const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
      pal = { ink: get("--ink", pal.ink), accent: get("--accent", pal.accent), gold: get("--prestige", pal.gold) };
    };

    let raf = 0;
    let cw = 0;
    let ch = 0;
    let px = 0; // pointer, -1..1 from the middle of the window, eased
    let py = 0;
    let tpx = 0;
    let tpy = 0;
    let drawn = "";
    let chapter = -1;
    let calm = still();
    // where the dock stands when it is home, in the window (it is fixed; its own transform is not part of this)
    let home = { left: 0, top: 0, w: 0, h: 0 };
    const measure = () => {
      const cs = getComputedStyle(dock);
      const w = parseFloat(cs.width) || 0;
      const h = parseFloat(cs.height) || 0;
      home = { w, h, top: parseFloat(cs.top) || 0, left: root.clientWidth - (parseFloat(cs.right) || 0) - w };
    };

    const sizeCanvas = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w !== cw || h !== ch || canvas.width !== Math.round(w * dpr)) {
        cw = w;
        ch = h;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        drawn = "";
      }
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const frame = () => {
      raf = 0;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      /* ── depth ─────────────────────────────────────────────────────── */
      const usePointer = !calm && fine.matches;
      if (usePointer) {
        px += (tpx - px) * 0.12;
        py += (tpy - py) * 0.12;
        if (Math.abs(tpx - px) < 0.002) px = tpx;
        if (Math.abs(tpy - py) < 0.002) py = tpy;
      } else {
        px = py = tpx = tpy = 0;
      }
      for (const l of layers) {
        let next = "";
        if (!calm) {
          const r = l.frame.getBoundingClientRect();
          if (r.bottom > -vh * 0.25 && r.top < vh * 1.25) {
            const sy = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
            const x = l.pointer ? -px * l.d * 4 : 0;
            const y = sy * l.d * 8 + (l.pointer ? -py * l.d * 3 : 0);
            next = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
          } else {
            next = l.last; // out of sight: leave it where it is
          }
        }
        if (next !== l.last) {
          l.el.style.transform = next;
          l.last = next;
        }
      }

      /* ── headings in step ──────────────────────────────────────────── */
      for (const s of heads) {
        let v = 1;
        if (!calm) {
          // measured on the section, which nothing here moves
          const top = s.getBoundingClientRect().top;
          v = Math.round(clamp01((vh * 0.9 - top) / (vh * 0.38)) * 100) / 100;
        }
        if (headIn.get(s) !== v) {
          headIn.set(s, v);
          if (calm) {
            s.style.removeProperty("--story-in");
            delete s.dataset.storyIn;
          } else {
            s.style.setProperty("--story-in", String(v));
            s.dataset.storyIn = "";
          }
        }
      }

      /* ── the travelling instrument ─────────────────────────────────── */
      if (ctx && home.w > 0 && hero) {
        const hr = hero.getBoundingClientRect();
        const dockTop = home.top;
        const dockBottom = dockTop + home.h;
        // how far the hero has left: 0 while its foot is low in the window, 1 once it is up by the dock
        const out = clamp01((vh * 0.78 - hr.bottom) / (vh * 0.46));
        // a full-window chapter with its own picture, or the end of the story, passing behind the dock
        const cover = (el: HTMLElement | null, toEnd = false) => {
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          const enter = clamp01((dockBottom + 110 - r.top) / 110);
          return toEnd ? enter : Math.min(enter, clamp01((r.bottom - dockTop + 110) / 110));
        };
        let show = Math.min(out, 1 - cover(aside), 1 - cover(end, true));

        // story position: each boundary is crossed while the next chapter's top passes the middle of the window
        let s = 0;
        for (let k = 1; k < CHAPTERS.length; k++) {
          const el = starts[k];
          if (!el) continue;
          s += clamp01((vh * 0.72 - el.getBoundingClientRect().top) / (vh * 0.5));
        }
        s = Math.min(STORY_STATES - 1, s);
        let rot = window.scrollY * 0.0021;
        let fly = ease(out);

        if (calm) {
          s = Math.round(s);
          rot = 0.6;
          fly = 1;
          show = show > 0.5 ? 1 : 0;
        }

        // the flight from the hero's frame to the dock
        let transform = "none";
        if (fly < 1) {
          let fx = vw * 0.7;
          let fy = hr.top + hr.height * 0.46;
          const f = heroCanvas?.dataset.frame?.split(",").map(Number);
          if (heroCanvas && f && f.length === 4 && f.every(Number.isFinite)) {
            const cr = heroCanvas.getBoundingClientRect();
            fx = cr.left + f[0] + f[2] / 2;
            fy = cr.top + f[1] + f[3] / 2;
          }
          const dx = (fx - (home.left + home.w / 2)) * (1 - fly);
          const dy = (fy - (dockTop + home.h / 2)) * (1 - fly);
          transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(${(1 + (1 - fly) * 1.6).toFixed(3)})`;
        }
        dock.style.transform = transform;
        dock.style.opacity = show.toFixed(3);
        dock.style.visibility = show < 0.01 ? "hidden" : "visible";

        const now = Math.min(CHAPTERS.length - 1, Math.round(s));
        if (now !== chapter) {
          chapter = now;
          if (numRef.current) numRef.current.textContent = CHAPTERS[now].n;
          if (labelRef.current) labelRef.current.textContent = CHAPTERS[now].label;
        }

        if (show >= 0.01 && sizeCanvas()) {
          const key = `${s.toFixed(3)}|${rot.toFixed(3)}|${pal.ink}|${pal.accent}`;
          if (key !== drawn) {
            drawn = key;
            story.draw(ctx, cw, ch, s, rot, pal);
          }
        }
      }

      if (usePointer && (px !== tpx || py !== tpy)) schedule();
    };

    const schedule = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" || calm || !fine.matches) return;
      tpx = (e.clientX / window.innerWidth) * 2 - 1;
      tpy = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    // the site applies a changed preference to <html> just after it announces it
    const onPrefs = () =>
      requestAnimationFrame(() => {
        calm = still();
        readPalette();
        drawn = "";
        schedule();
      });

    const onResize = () => {
      measure();
      schedule();
    };
    dock.dataset.live = "";
    readPalette();
    measure();
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("gx:prefs", onPrefs);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", onPrefs);
    fine.addEventListener("change", onPrefs);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("gx:prefs", onPrefs);
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", onPrefs);
      fine.removeEventListener("change", onPrefs);
      for (const l of layers) l.el.style.transform = "";
      for (const s of heads) {
        s.style.removeProperty("--story-in");
        delete s.dataset.storyIn;
      }
    };
  }, [host]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {host &&
        createPortal(
          <div ref={dockRef} className="gx-story on-night no-print" aria-hidden>
            <canvas ref={canvasRef} className="gx-story-canvas" />
            <p className="gx-story-cap">
              <span ref={numRef} className="num gx-story-n">
                01
              </span>
              <span ref={labelRef}>The market</span>
            </p>
            <p className="gx-story-note">Form only, not data</p>
          </div>,
          host,
        )}
    </>
  );
}
