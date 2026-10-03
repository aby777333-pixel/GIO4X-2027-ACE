"use client";

import { useEffect } from "react";

/**
 * POLISH — three small behaviours for the whole site, one listener each.
 * Renders nothing.
 *
 *   the stage light   a soft light inside a machine's card that follows the
 *                     pointer (styles/fx.css reads --gx, --gy on .gx-stage).
 *                     Mouse and pen only; absent under reduced motion or low
 *                     visual effects.
 *   machine keys      while the pointer is over a machine, or focus is inside
 *                     it, the arrow keys move its first slider and Enter
 *                     presses its main button. Never while typing in a field.
 *   the part of day   <html data-daypart> is set from the visitor's own clock
 *                     (morning, day, evening, night); the heroes are lit a
 *                     little differently for each.
 */
export function Polish() {
  useEffect(() => {
    const root = document.documentElement;
    const h = new Date().getHours();
    root.dataset.daypart = h < 5 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 21 ? "evening" : "night";

    const quiet = () => root.dataset.motion === "reduced" || root.dataset.effects === "low";
    let lit: HTMLElement | null = null;
    let machine: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      machine = target?.closest<HTMLElement>("[data-machine]") ?? null;
      if (e.pointerType === "touch" || quiet()) return;
      const stage = target?.closest<HTMLElement>(".gx-stage") ?? null;
      if (lit && lit !== stage) lit.removeAttribute("data-lit");
      lit = stage;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      stage.style.setProperty("--gx", `${e.clientX - r.left}px`);
      stage.style.setProperty("--gy", `${e.clientY - r.top}px`);
      stage.setAttribute("data-lit", "");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName))) return;
      const m = (el?.closest<HTMLElement>("[data-machine]") ?? machine) as HTMLElement | null;
      if (!m || !m.isConnected) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const range = m.querySelector<HTMLInputElement>('input[type="range"]');
        if (!range) return;
        e.preventDefault();
        if (e.key === "ArrowRight") range.stepUp();
        else range.stepDown();
        range.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (e.key === "Enter") {
        const button = m.querySelector<HTMLButtonElement>("button.btn-primary:not([disabled])");
        if (!button) return;
        e.preventDefault();
        button.click();
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      delete root.dataset.daypart;
    };
  }, []);
  return null;
}
