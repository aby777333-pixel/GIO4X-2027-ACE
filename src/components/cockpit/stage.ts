/**
 * Finding a page's stage from outside it.
 *
 * The page-to-page transition (StageTransition) and the first-visit intro
 * (Boot) both need to know where the instrument's champagne frame stands on
 * screen. Neither draws it: the engine publishes the rectangle on its canvas as
 * `data-frame` once a frame has been drawn (engine.ts), and these two helpers
 * read it.
 */

export type Rect = { left: number; top: number; width: number; height: number };

/** The instrument canvas of the page being shown, or null on a page with no stage (/search, the not-found page). */
export function stageCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>("#main .cx-hero > .cx-stage > canvas.cx-scene");
}

/** The frame the engine last drew on this canvas, in the canvas's own CSS pixels; null until a frame has been drawn. */
export function frameOf(canvas: HTMLCanvasElement): Rect | null {
  const raw = canvas.dataset.frame;
  if (!raw) return null;
  const n = raw.split(",").map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[2] < 8 || n[3] < 8) return null;
  return { left: n[0], top: n[1], width: n[2], height: n[3] };
}

/** Reduced motion (the system's or the site's) or low visual effects: nothing here moves. */
export function isStill(): boolean {
  const d = document.documentElement.dataset;
  return d.motion === "reduced" || d.effects === "low" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
