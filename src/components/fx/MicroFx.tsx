"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isStill } from "@/components/cockpit/stage";

/**
 * FIRST VIEW — two small arrivals, once each, as a thing scrolls into view.
 * Renders nothing. Styles in styles/fx.css.
 *
 *  1. COUNT UP. An element marked `data-count` whose text is a number counts
 *     from zero to that number in under a second:
 *
 *         <span className="num" data-count>1,320</span>
 *
 *     The text in the markup is the real value, so without this script, under
 *     reduced motion, for a crawler and in print it is simply the number.
 *     The author marks it, and the rule is the site's data-honesty rule: only
 *     a constant written in the page (a count of things, a year, a size), and
 *     never anything presented as a market value, a reference rate, an
 *     indicative condition or anything that updates. To hold that line the
 *     script also refuses anything inside an `aria-live` region, a table of
 *     data (`.table-gx`), or an element marked `data-live`.
 *
 *  2. DRAW. A small line figure draws itself: a left-to-right reveal of
 *       - every `<Sparkline/>` (found by its own markup, nothing to add), and
 *       - any element marked `data-draw`;
 *     and, for an SVG marked `data-draw="stroke"`, each open path is traced
 *     along its own length. `data-draw="off"` opts a sparkline out.
 *     The shape is never changed: only when it appears.
 *
 * How it stays out of the way:
 *   - one IntersectionObserver for the whole page; nothing is hidden while it
 *     waits (an element is only touched at the moment it arrives, so a script
 *     that stops half-way leaves the page as the server sent it);
 *   - no layout is read: the width a number needs comes from the observer's
 *     own entry, and all the counting numbers share one animation frame;
 *   - nothing under reduced motion (the system's or the site's) or low visual
 *     effects, and nothing in a hidden tab (frames stop there by themselves).
 */

const COUNT = "[data-count]";
/** the markup of <Sparkline/> in components/ui/Data.tsx */
const SPARK = 'svg:not([data-draw]):has(> path[fill="none"][vector-effect="non-scaling-stroke"] + circle)';
const MARKED = '[data-draw]:not([data-draw="off"])';
const DRAW = `${MARKED}, ${SPARK}`;
const NEVER = "[aria-live], [data-live], .table-gx";
const COUNT_MS = 900;

type Run = { el: HTMLElement; node: Text; inline: boolean; text: string; pre: string; post: string; to: number; decimals: number; group: boolean; start: number };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** "1,320 pages" → the parts around the one number in it; null when the text is not a plain number. */
function parse(text: string): Pick<Run, "text" | "pre" | "post" | "to" | "decimals" | "group"> | null {
  const m = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/.exec(text);
  if (!m) return null;
  const to = Number(m[2].replace(/,/g, "") + (m[3] ?? ""));
  if (!Number.isFinite(to) || to === 0) return null;
  return { text, pre: m[1], post: m[4], to, decimals: m[3] ? m[3].length - 1 : 0, group: m[2].includes(",") };
}

function show(r: Run, v: number): string {
  const fixed = v.toFixed(r.decimals);
  if (!r.group) return r.pre + fixed + r.post;
  const [whole, frac] = fixed.split(".");
  return r.pre + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? `.${frac}` : "") + r.post;
}

export function MicroFx() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const main = document.getElementById("main");
    if (!main) return;

    const seen = new WeakSet<Element>();
    const runs: Run[] = [];
    let raf = 0;
    let scan = 0;

    const settle = (r: Run) => {
      if (!r.el.isConnected) return;
      r.node.data = r.text;
      r.el.style.removeProperty("min-width");
      if (r.inline) r.el.style.removeProperty("display");
    };

    const tick = (time: number) => {
      raf = 0;
      for (let i = runs.length - 1; i >= 0; i--) {
        const r = runs[i];
        if (!r.start) r.start = time;
        const t = Math.min(1, (time - r.start) / COUNT_MS);
        if (t >= 1 || !r.el.isConnected) {
          // the last word is the markup's own text, exactly
          settle(r);
          runs.splice(i, 1);
        } else {
          r.node.data = show(r, r.to * easeOut(t));
        }
      }
      if (runs.length) raf = requestAnimationFrame(tick);
    };

    const count = (el: HTMLElement, width: number) => {
      // a number with anything inside it but text is left alone
      const node = el.firstChild;
      if (el.childNodes.length !== 1 || !(node instanceof Text) || el.closest(NEVER)) return;
      const parsed = parse(node.data.trim());
      if (!parsed) return;
      parsed.text = node.data;
      // the box keeps the width of the final number, so nothing beside it moves while the digits change
      // (the text node itself is kept and only its characters change, so React still owns it)
      const inline = width > 0 && getComputedStyle(el).display === "inline";
      if (inline) el.style.display = "inline-block";
      if (width > 0) el.style.minWidth = `${Math.ceil(width)}px`;
      runs.push({ el, node, inline, ...parsed, start: 0 });
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const draw = (el: Element) => {
      if (el.getAttribute("data-draw") === "stroke" && el instanceof SVGSVGElement) {
        el.querySelectorAll<SVGGeometryElement>('path, polyline, line').forEach((p) => {
          try {
            const len = p.getTotalLength();
            if (len > 0) p.style.setProperty("--len", String(Math.ceil(len)));
          } catch {
            /* not rendered: it keeps the stylesheet's default length */
          }
        });
      }
      el.setAttribute("data-fx-in", "");
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          if (document.hidden || isStill()) continue;
          if (e.target.matches(COUNT)) count(e.target as HTMLElement, e.boundingClientRect.width);
          else draw(e.target);
        }
      },
      // a little way in from the bottom edge, so the arrival is seen
      { rootMargin: "0px 0px -8% 0px", threshold: 0.2 },
    );

    const look = () => {
      scan = 0;
      if (isStill()) return;
      let found: NodeListOf<Element>;
      try {
        found = main.querySelectorAll(`${COUNT}, ${DRAW}`);
      } catch {
        // a browser without :has(): the marked elements only
        found = main.querySelectorAll(`${COUNT}, ${MARKED}`);
      }
      found.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    // content that arrives after the page does (a streamed section, a tab's panel)
    const queue = () => {
      if (!scan) scan = window.setTimeout(look, 240);
    };
    const mo = new MutationObserver(queue);
    mo.observe(main, { childList: true, subtree: true });
    look();

    return () => {
      mo.disconnect();
      io.disconnect();
      window.clearTimeout(scan);
      cancelAnimationFrame(raf);
      runs.forEach(settle);
    };
  }, [pathname]);

  return null;
}
