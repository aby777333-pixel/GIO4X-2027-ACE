"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { frameOf, isStill, stageCanvas, type Rect } from "@/components/cockpit/stage";

/**
 * PAGE TO PAGE — the instrument of the page being left turns into the next one.
 *
 * Every page opens with an instrument in a golden frame. Without this, a client
 * navigation cuts from one to the next. With it, the picture in the old frame
 * stays on screen over the new stage, travels to where the new frame stands
 * (the homepage's frame is a different rectangle from every other page's),
 * and dissolves with a slight enlargement and blur while a line of light
 * crosses the champagne frame and the new scene powers on underneath. The
 * statement fades up separately (transition.css).
 *
 * How it stays out of the way:
 *   - Navigation is never delayed and never intercepted. Nothing happens until
 *     the new page is already in the document; the old canvas, by then detached,
 *     still holds its last picture, and that is what is copied. So links, the
 *     command bar, the tour and back/forward are all covered alike, and nothing
 *     is captured or encoded at the moment of a click.
 *   - The overlay is one fixed element with `pointer-events: none`, appended to
 *     <body>, placed by a transform, clipped to the new stage and removed when
 *     done: it changes no layout and blocks nothing.
 *   - If the old picture cannot be copied, was not on screen, or either page
 *     has no stage, nothing is shown. If the new stage has not drawn within
 *     HOLD_MS, the old picture simply fades.
 *   - Not on first load, not under reduced motion or low visual effects, not
 *     in a hidden tab, never on /control (which does not mount the site shell).
 *   - Below 720px (the engine's phone layout, 30 frames a second) it is a plain
 *     cross-fade: no travel, no blur, no sweep.
 *
 * The View Transitions API is deliberately not used: it freezes rendering and
 * takes the pointer for the whole document while a transition runs, and it would
 * have to wrap the router's own update. This reaches the same picture with one
 * element and compositor-only animations, in every browser.
 */

/** how long the old picture waits for the new stage's first frame before it gives up and fades */
const HOLD_MS = 600;
/** the morph itself; the travel takes its golden section (transition.css) */
const MORPH_MS = 618;
/** the plain cross-fade on a phone */
const FADE_MS = 382;
const DROP_MS = 240;
/** the frame's corner marks and golden-cut ticks stand a few pixels outside it */
const PAD = 6;

/** The stage as last seen on screen: the canvas, and where it stood in the window. */
type Seen = { canvas: HTMLCanvasElement; left: number; top: number; width: number };

function see(canvas: HTMLCanvasElement): Seen {
  const r = canvas.getBoundingClientRect();
  return { canvas, left: r.left, top: r.top, width: r.width };
}

/**
 * Put the overlay on a rectangle of the window, and keep whatever it shows inside the new page's stage:
 * the homepage's frame is taller than the others', and its picture must not lie over the content below.
 * The position is a transform, not `left`/`top`, so moving the overlay is never a layout shift.
 */
function place(el: HTMLElement, r: Rect, within: HTMLElement | null): void {
  el.style.transform = `translate(${r.left}px, ${r.top}px)`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  const s = within?.getBoundingClientRect();
  // inset() measures inward from the overlay's own edges; a negative value lets the dissolve spill into the stage
  el.style.clipPath = s ? `inset(${s.top - r.top}px ${r.left + r.width - s.right}px ${r.top + r.height - s.bottom}px ${s.left - r.left}px)` : "";
}

/** A frame in window coordinates, with the margin its marks need. */
function onScreen(at: { left: number; top: number }, frame: Rect): Rect {
  return { left: at.left + frame.left - PAD, top: at.top + frame.top - PAD, width: frame.width + PAD * 2, height: frame.height + PAD * 2 };
}

/** At least half of it is inside the window. */
function inWindow(r: Rect): boolean {
  const seen = Math.min(window.innerHeight, r.top + r.height) - Math.max(0, r.top);
  return seen >= r.height / 2 && r.left < window.innerWidth && r.left + r.width > 0;
}

export function StageTransition() {
  const pathname = usePathname() ?? "/";
  const from = useRef<string | null>(null);
  const seen = useRef<Seen | null>(null);
  /** ends the transition in flight, if any */
  const stop = useRef<(() => void) | null>(null);

  /* ---- keep an eye on the stage being shown, so that its last position is known when it is taken away ---- */
  useEffect(() => {
    let raf = 0;
    const look = () => {
      raf = 0;
      const cur = seen.current;
      if (cur?.canvas.isConnected) {
        seen.current = see(cur.canvas);
        return;
      }
      // a stage that arrived after the page did (a streamed page)
      const canvas = stageCanvas();
      if (canvas) seen.current = see(canvas);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(look);
    };
    look();
    const opts = { passive: true, capture: true } as const;
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    // a press or a key comes before any navigation it causes
    window.addEventListener("pointerdown", look, opts);
    window.addEventListener("keydown", look, opts);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      window.removeEventListener("pointerdown", look, opts);
      window.removeEventListener("keydown", look, opts);
    };
  }, []);

  /* ---- a page change. In a layout effect: the old picture is back on screen before the browser paints the new page ---- */
  useLayoutEffect(() => {
    const was = from.current;
    from.current = pathname;
    const old = seen.current;
    const next = stageCanvas();
    seen.current = next ? see(next) : null;
    stop.current?.();

    if (was === null || was === pathname) return;
    if (was.startsWith("/control") || pathname.startsWith("/control")) return;
    if (!old || !next || old.canvas === next || old.canvas.isConnected) return;
    if (document.hidden || isStill()) return;

    const oldFrame = frameOf(old.canvas);
    if (!oldFrame || old.width < 1) return;
    const start = onScreen(old, oldFrame);
    if (!inWindow(start)) return;

    // the old picture: the frame's part of the old canvas, at the resolution it was drawn in
    const pic = document.createElement("canvas");
    try {
      const k = old.canvas.width / old.width;
      pic.width = Math.max(1, Math.round(start.width * k));
      pic.height = Math.max(1, Math.round(start.height * k));
      const ctx = pic.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(old.canvas, (oldFrame.left - PAD) * k, (oldFrame.top - PAD) * k, start.width * k, start.height * k, 0, 0, pic.width, pic.height);
    } catch {
      return;
    }

    const root = document.documentElement;
    const simple = window.innerWidth < 720;
    const layer = document.createElement("div");
    layer.className = "st-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.phase = "hold";
    if (simple) layer.dataset.simple = "";
    const move = document.createElement("div");
    move.className = "st-move";
    pic.className = "st-pic";
    move.appendChild(pic);
    const sweep = document.createElement("span");
    sweep.className = "st-sweep";
    layer.append(move, sweep);
    place(layer, start, next.parentElement);
    document.body.appendChild(layer);
    // the statement of the new page fades up on its own, quicker than the instrument
    root.dataset.stageTurn = "";

    let done = false;
    let timer = 0;
    let turn = 0;
    let target: Rect | null = null;
    const mo = new MutationObserver(() => go());

    const follow = () => {
      // a fixed element does not scroll with the stage it covers: keep it on the frame
      if (done || !target || !next.isConnected) return;
      // a fading picture that is not following anything simply goes
      if (simple) return finish();
      const f = frameOf(next);
      if (f) place(layer, onScreen(next.getBoundingClientRect(), f), next.parentElement);
    };
    const finish = () => {
      if (done) return;
      done = true;
      mo.disconnect();
      window.clearTimeout(timer);
      window.clearTimeout(turn);
      window.removeEventListener("scroll", follow);
      layer.remove();
      delete root.dataset.stageTurn;
      if (stop.current === finish) stop.current = null;
    };
    const drop = () => {
      if (done || target) return;
      mo.disconnect();
      layer.dataset.phase = "drop";
      window.clearTimeout(timer);
      timer = window.setTimeout(finish, DROP_MS + 40);
    };
    const go = () => {
      if (done || target) return;
      if (!next.isConnected) return drop();
      // the new stage has drawn its first frame: the engine marks the canvas and says where its frame is
      const frame = next.dataset.on ? frameOf(next) : null;
      if (!frame) return;
      const end = onScreen(next.getBoundingClientRect(), frame);
      if (!inWindow(end)) return drop();
      mo.disconnect();
      target = end;
      // (on a phone the old picture fades where it stands: nothing travels)
      if (!simple) {
        // the picture starts where the old frame stood and travels to the new one
        place(layer, end, next.parentElement);
        move.style.setProperty("--st-from", `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${start.width / end.width}, ${start.height / end.height})`);
        const gold = getComputedStyle(next).getPropertyValue("--tone-4").trim();
        if (gold) layer.style.setProperty("--st-gold", gold);
      }
      layer.dataset.phase = "go";
      window.addEventListener("scroll", follow, { passive: true });
      window.clearTimeout(timer);
      timer = window.setTimeout(finish, (simple ? FADE_MS : MORPH_MS) + 40);
    };

    stop.current = finish;
    mo.observe(next, { attributes: true, attributeFilter: ["data-on", "data-frame"] });
    timer = window.setTimeout(drop, HOLD_MS);
    turn = window.setTimeout(() => delete root.dataset.stageTurn, 520);
    go();
  }, [pathname]);

  useEffect(() => () => stop.current?.(), []);

  return null;
}
