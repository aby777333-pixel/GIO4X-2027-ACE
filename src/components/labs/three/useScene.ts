"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/** Motion should not run by itself: the system setting, or the site's own switches. */
export const calmNow = (): boolean => {
  const root = document.documentElement;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
};

type Running = { refresh: () => void; dispose: () => void };

/**
 * Runs one of the Labs 3D scenes on a host element.
 *
 *  - The scene module (and Three.js with it) is fetched only when the host
 *    comes near the viewport, and only on the page that mounts this.
 *  - `load` returns null when WebGL is not available; a failed fetch is treated
 *    the same way. The state is then "none" and the server-drawn still inside
 *    the host is what the visitor keeps.
 *  - A change of theme, accent or motion preference re-reads the colours.
 *  - Leaving the page disposes the scene, which hands the WebGL context back.
 *
 * No Three.js is imported here.
 */
export function useScene<T extends Running>(hostRef: RefObject<HTMLElement | null>, load: (host: HTMLElement) => Promise<T | null>): { scene: RefObject<T | null>; state: "wait" | "live" | "none" } {
  const scene = useRef<T | null>(null);
  const loader = useRef(load);
  loader.current = load;
  const [state, setState] = useState<"wait" | "live" | "none">("wait");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let started = false;

    const start = async () => {
      if (started || dead) return;
      started = true;
      try {
        const made = await loader.current(host);
        if (dead) {
          made?.dispose();
          return;
        }
        scene.current = made;
        setState(made ? "live" : "none");
      } catch {
        if (!dead) setState("none");
      }
    };

    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void start();
      },
      { rootMargin: "400px 0px" },
    );
    near.observe(host);

    // the site applies a changed preference to <html> just after it announces it
    let raf = 0;
    const refresh = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => scene.current?.refresh());
    };
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const attrs = new MutationObserver(refresh);
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "data-contrast", "data-motion", "data-effects"] });
    window.addEventListener("gx:prefs", refresh);
    mq.addEventListener("change", refresh);
    scheme.addEventListener("change", refresh);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      near.disconnect();
      attrs.disconnect();
      window.removeEventListener("gx:prefs", refresh);
      mq.removeEventListener("change", refresh);
      scheme.removeEventListener("change", refresh);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [hostRef]);

  return { scene, state };
}
