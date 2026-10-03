"use client";

import { useEffect, useRef } from "react";
import { hash } from "@/components/cockpit/engine";
import { SCENES, type SceneId } from "@/components/cockpit/scenes";

/**
 * One page's instrument. The canvas is decorative (the statement beside it is
 * the content), so it is hidden from assistive technology and the page is
 * complete without it: no script, no canvas support or a failed chunk simply
 * leaves the lit stage behind the headline.
 *
 * The engine and the scene are separate chunks fetched after first paint, when
 * the browser is idle, so a hero never competes with the headline for bytes.
 */
export function HeroScene({ scene, tag = "", seed = "", className = "" }: { scene: SceneId; tag?: string; seed?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const load = SCENES[scene];
    if (!canvas || !load) return;
    let dispose: (() => void) | undefined;
    let dead = false;

    const go = async () => {
      try {
        const [engine, mod] = await Promise.all([import("@/components/cockpit/engine"), load()]);
        if (dead) return;
        dispose = engine.mount(canvas, mod.default, { seed: hash(seed || scene), tag });
      } catch {
        /* the stage stands on its own */
      }
    };

    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(() => void go(), { timeout: 900 }) : window.setTimeout(() => void go(), 120);
    return () => {
      dead = true;
      if (idle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      dispose?.();
      delete canvas.dataset.on;
    };
  }, [scene, tag, seed]);

  // data-scene names the instrument in the markup, so a page's scene can be checked without running it
  return <canvas ref={ref} aria-hidden data-scene={scene} className={`cx-scene ${className}`} />;
}
