"use client";

import { useEffect } from "react";
import { readPrefs } from "@/lib/prefs";

/** The tiles of depth.css. The contract with cockpit.css (--mx, --my, --tx, --ty on the tile under the pointer) is unchanged. */
const TILE = ":is(.tiles, .gap-px.bg-line, .gap-px.bg-night-line):not(.flat) > *, .grid.border-l.border-t:not(.flat) > .border-b.border-r";
/** A grid of tiles inside a grid of tiles is a group, not a tile (depth.css). */
const GROUP = ":is(.tiles, .grid.border-l.border-t, .gap-px.bg-line, .gap-px.bg-night-line):not(.flat)";
/** The ledger rows of depth.css: a coloured left edge. */
const ROW = "main li.border-b.border-line:not(.border-r):not(.flat)";
const PANEL = ".panel, .panel-quiet";
const CARD = `${TILE}, ${ROW}, ${PANEL}`;
/** Tilting one of these is unpleasant: a card that holds any of them stays level. */
const STILL = "input, select, textarea, table, canvas, iframe, video";
/** A tilted panel becomes the frame for anything fixed inside it, so a panel that can open something is left alone. */
const OPENS = "button, details, [role='dialog'], [aria-haspopup]";
const MAGNET = ":is(.btn-primary, .btn-accent, .btn-ghost):not([disabled]):not([aria-disabled='true'])";
/** What the cursor light can fall on: a full-width band of the page. */
const BAND = "section, footer, article, .on-night, main > div";

/** px: how near the pointer must be before a button leans, and how far it may lean. */
const REACH = 60;
const PULL = 4;
/** px: a panel larger than this takes the highlight without the tilt. */
const TILT_MAX_W = 960;
const TILT_MAX_H = 560;
/** ms: how long the list of buttons on screen is trusted before it is measured again. */
const FRESH = 1000;

type Box = { l: number; t: number; w: number; h: number };
type Kind = "tilt" | "flat" | "ptilt" | "plight" | "row";
type Magnet = { el: HTMLElement; box: Box; ox: number; oy: number; live: boolean };

const CARD_VARS = ["--mx", "--my", "--tx", "--ty"] as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, w: r.width, h: r.height };
};

/**
 * The pointer layer. Renders nothing.
 *
 * One passive `pointermove` listener for the whole page, answered at most once
 * a frame, drives three things (styles in styles/pointer.css and, for the
 * tiles, styles/cockpit.css):
 *
 *  1. the cursor light: the band of the page under the pointer is told where
 *     the pointer is, and lights its own background there;
 *  2. magnetic buttons: a filled or outlined button within 60px leans up to
 *     4px towards the pointer and springs back; a press sends a ring of light
 *     from the point pressed;
 *  3. card parallax: the tile, panel or ledger row under the pointer is told
 *     where the pointer is on it, so it can tilt and carry a highlight. (This
 *     is the tile light that used to live in CockpitFx: one mechanism, here.)
 *
 * Mouse and pen only. Off under reduced motion, low visual effects, or with
 * "Pointer effects" switched off at /preferences: then `data-pointer-fx` and
 * `data-cx-tilt` are not on <html>, no variable is written, and the page is
 * as the stylesheets leave it.
 *
 * Cost: the move handler stores three values. The frame reads layout only
 * when something changed (a new band or card under the pointer, or the first
 * move after a scroll or a resize), reads before it writes, and writes only
 * custom properties and attributes on the few elements involved.
 */
export function PointerLayer() {
  useEffect(() => {
    const root = document.documentElement;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let on = false;
    let raf = 0;
    let x = 0;
    let y = 0;
    let target: Element | null = null;
    /** set by scroll and resize: every remembered measurement is out of date */
    let stale = true;
    let measured = 0;
    let vw = window.innerWidth;
    let vh = window.innerHeight;

    let card: HTMLElement | null = null;
    let cardBox: Box | null = null;
    let cardKind: Kind | null = null;

    let band: HTMLElement | null = null;
    let bandBox: Box | null = null;
    let bandFrom: Element | null = null;
    /** every band that has been lit, so all of them can be put back */
    const bands = new Set<HTMLElement>();
    /** whether a band has a background picture of its own (then it is left alone) */
    const plain = new WeakMap<HTMLElement, boolean>();
    /** the full-width band an element belongs to, measured once (and again after a resize) */
    let wide = new WeakMap<HTMLElement, HTMLElement | null>();
    /** the card last looked at and found unsuitable, so it is not examined again on every frame */
    let refused: HTMLElement | null = null;

    let magnets = new Map<HTMLElement, Magnet>();
    const rippled = new Set<HTMLElement>();
    let flip = false;

    /* ---- reads ---- */

    const kindOf = (el: HTMLElement, box: Box): Kind | null => {
      if (el.matches(GROUP)) return null;
      if (el.matches(TILE)) return el.querySelector(STILL) ? "flat" : "tilt";
      if (el.querySelector(STILL)) return null;
      if (el.matches(ROW)) return "row";
      if (el.querySelector(OPENS)) return null;
      return box.w <= TILT_MAX_W && box.h <= TILT_MAX_H ? "ptilt" : "plight";
    };

    const findBand = (from: Element): HTMLElement | null => {
      const first = from.closest<HTMLElement>(BAND);
      if (!first) return null;
      let el = wide.get(first);
      if (el === undefined) {
        el = first;
        while (el && el.offsetWidth < vw * 0.9) el = el.parentElement?.closest<HTMLElement>(BAND) ?? null;
        wide.set(first, el);
      }
      // the stage of a page opening has its own key light and covers its band
      if (!el || el.classList.contains("cx-hero")) return null;
      let ok = plain.get(el);
      if (ok === undefined) {
        ok = getComputedStyle(el).backgroundImage === "none";
        plain.set(el, ok);
      }
      return ok ? el : null;
    };

    const measureMagnets = () => {
      const next = new Map<HTMLElement, Magnet>();
      document.querySelectorAll<HTMLElement>(MAGNET).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < -REACH || r.top > vh + REACH || r.right < -REACH || r.left > vw + REACH) return;
        const was = magnets.get(el);
        // a button that is leaning is measured where it rests
        const ox = was?.ox ?? 0;
        const oy = was?.oy ?? 0;
        next.set(el, { el, box: { l: r.left - ox, t: r.top - oy, w: r.width, h: r.height }, ox, oy, live: was?.live ?? false });
      });
      magnets.forEach((m, el) => {
        if (!next.has(el)) release(m);
      });
      magnets = next;
    };

    /* ---- writes ---- */

    const release = (m: Magnet) => {
      if (!m.live) return;
      m.live = false;
      m.ox = 0;
      m.oy = 0;
      for (const p of ["--mag-bx", "--mag-by", "--mag-sx", "--mag-sy"]) m.el.style.removeProperty(p);
      delete m.el.dataset.mag;
    };

    const dropCard = () => {
      if (!card) return;
      for (const p of CARD_VARS) card.style.removeProperty(p);
      delete card.dataset.pc;
      card = null;
      cardBox = null;
      cardKind = null;
    };

    const dimBand = () => {
      if (band) band.dataset.pl = "off";
      band = null;
      bandBox = null;
      bandFrom = null;
    };

    const clearAll = () => {
      dropCard();
      dimBand();
      magnets.forEach(release);
      bands.forEach((el) => {
        delete el.dataset.pl;
        el.style.removeProperty("--pl-x");
        el.style.removeProperty("--pl-y");
      });
      bands.clear();
      rippled.forEach((el) => {
        delete el.dataset.ripple;
        el.style.removeProperty("--mag-rx");
        el.style.removeProperty("--mag-ry");
      });
      rippled.clear();
    };

    const paint = () => {
      raf = 0;
      if (!on) return;
      const t = target && target.isConnected ? target : null;

      // 1. everything that has to be measured, before anything is written
      const now = performance.now();
      if (stale || now - measured > FRESH) {
        measureMagnets();
        measured = now;
      }

      let nextCard = t ? t.closest<HTMLElement>(CARD) : null;
      if (nextCard && nextCard === refused && !stale) nextCard = null;
      let nextBox = nextCard && nextCard === card && !stale ? cardBox : null;
      let nextKind = nextCard && nextCard === card ? cardKind : null;
      if (nextCard && !nextBox) {
        nextBox = boxOf(nextCard);
        if (nextCard !== card) {
          nextKind = kindOf(nextCard, nextBox);
          if (!nextKind) {
            refused = nextCard;
            nextCard = null;
          }
        }
      }

      let nextBand = band;
      if (t !== bandFrom || stale) {
        nextBand = t ? findBand(t) : null;
        bandFrom = t;
        bandBox = null;
      }
      let nextBandBox = nextBand && nextBand === band ? bandBox : null;
      if (nextBand && !nextBandBox) nextBandBox = boxOf(nextBand);
      stale = false;

      // 2. the light
      if (nextBand !== band) {
        if (band) band.dataset.pl = "off";
        band = nextBand;
        if (band) {
          band.dataset.pl = "on";
          bands.add(band);
        }
      }
      bandBox = nextBandBox;
      if (band && bandBox) {
        band.style.setProperty("--pl-x", `${Math.round(x - bandBox.l)}px`);
        band.style.setProperty("--pl-y", `${Math.round(y - bandBox.t)}px`);
      }

      // 3. the card
      if (nextCard !== card) {
        dropCard();
        if (nextCard && nextKind) {
          card = nextCard;
          cardKind = nextKind;
          card.dataset.pc = nextKind;
        }
      }
      if (card && nextBox && nextBox.w && nextBox.h) {
        cardBox = nextBox;
        const mx = clamp((x - nextBox.l) / nextBox.w, 0, 1);
        const my = clamp((y - nextBox.t) / nextBox.h, 0, 1);
        card.style.setProperty("--mx", mx.toFixed(3));
        card.style.setProperty("--my", my.toFixed(3));
        if (cardKind === "tilt" || cardKind === "ptilt") {
          card.style.setProperty("--tx", (mx * 2 - 1).toFixed(3));
          card.style.setProperty("--ty", (my * 2 - 1).toFixed(3));
        }
      }

      // 4. the buttons
      magnets.forEach((m) => {
        const { l, t: top, w, h } = m.box;
        const d = t ? Math.hypot(Math.max(l - x, 0, x - (l + w)), Math.max(top - y, 0, y - (top + h))) : REACH;
        if (d >= REACH || !m.el.isConnected) {
          release(m);
          return;
        }
        // strongest at the button's edge, fading to nothing 60px out; at its centre it rests
        const near = 1 - d / REACH;
        let ox = clamp((x - (l + w / 2)) / (w / 2 + REACH / 2), -1, 1) * PULL * near;
        let oy = clamp((y - (top + h / 2)) / (h / 2 + REACH / 2), -1, 1) * PULL * near;
        const len = Math.hypot(ox, oy);
        if (len > PULL) {
          ox = (ox / len) * PULL;
          oy = (oy / len) * PULL;
        }
        m.ox = ox;
        m.oy = oy;
        m.live = true;
        m.el.style.setProperty("--mag-bx", `${ox.toFixed(2)}px`);
        m.el.style.setProperty("--mag-by", `${oy.toFixed(2)}px`);
        // the light on the surface runs ahead of the button: that difference is the depth
        m.el.style.setProperty("--mag-sx",`${clamp(((x - l) / w) * 100, -30, 130).toFixed(1)}%`);
        m.el.style.setProperty("--mag-sy",`${clamp(((y - top) / h) * 100, -60, 160).toFixed(1)}%`);
        m.el.dataset.mag = "";
      });
    };

    /* ---- events ---- */

    const onMove = (e: PointerEvent) => {
      if (!on || e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      target = e.target instanceof Element ? e.target : null;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (!on) return;
      target = null;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onDown = (e: PointerEvent) => {
      if (!on || e.pointerType === "touch" || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(MAGNET);
      if (!el) return;
      const box = magnets.get(el)?.box ?? boxOf(el);
      if (!box.w || !box.h) return;
      el.style.setProperty("--mag-rx",`${(((e.clientX - box.l) / box.w) * 100).toFixed(1)}%`);
      el.style.setProperty("--mag-ry",`${(((e.clientY - box.t) / box.h) * 100).toFixed(1)}%`);
      flip = !flip;
      el.dataset.ripple = flip ? "a" : "b";
      rippled.add(el);
    };
    const onShift = () => {
      stale = true;
    };
    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      wide = new WeakMap();
      stale = true;
    };

    const sync = () => {
      let wanted = true;
      try {
        wanted = readPrefs().pointerFx !== false;
      } catch {
        /* preferences unreadable: the default (on) applies */
      }
      const next = wanted && fine.matches && !reduced.matches && root.dataset.motion !== "reduced" && root.dataset.effects !== "low";
      if (next === on) return;
      on = next;
      if (on) {
        root.dataset.pointerFx = "";
        root.dataset.cxTilt = "";
        stale = true;
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        clearAll();
        delete root.dataset.pointerFx;
        delete root.dataset.cxTilt;
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "gx:prefs" || e.key === null) sync();
    };

    sync();
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("scroll", onShift, { passive: true, capture: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("gx:prefs", sync);
    window.addEventListener("storage", onStorage);
    fine.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onShift, { capture: true });
      window.removeEventListener("resize", onResize);
      window.removeEventListener("gx:prefs", sync);
      window.removeEventListener("storage", onStorage);
      fine.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      cancelAnimationFrame(raf);
      clearAll();
      on = false;
      delete root.dataset.pointerFx;
      delete root.dataset.cxTilt;
    };
  }, []);

  return null;
}
