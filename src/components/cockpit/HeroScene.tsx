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
 * The engine and the scene are separate chunks. The headline is in the HTML
 * and painted before this effect runs, so the two chunks are requested at once
 * (they used to wait for an idle moment, up to 900ms, before the request was
 * even made). Only the mounting waits: for the next animation frame, so the
 * first picture is drawn in step with the browser's own painting. The engine
 * draws that first frame synchronously as it mounts (engine.ts, `drawNow`),
 * so the canvas is never shown empty.
 */
export function HeroScene({ scene, tag = "", seed = "", className = "" }: { scene: SceneId; tag?: string; seed?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const load = SCENES[scene];
    if (!canvas || !load) return;
    let dispose: (() => void) | undefined;
    let dead = false;

    let raf = 0;

    const go = async () => {
      try {
        const [engine, mod] = await Promise.all([import("@/components/cockpit/engine"), load()]);
        if (dead) return;
        const begin = () => {
          raf = 0;
          if (dead) return;
          try {
            dispose = engine.mount(canvas, mod.default, { seed: hash(seed || scene), tag });
          } catch {
            /* the stage stands on its own */
          }
        };
        // a hidden tab has no animation frames: mount at once there, and the engine draws its one frame
        if (document.hidden) begin();
        else raf = requestAnimationFrame(begin);
      } catch {
        /* the stage stands on its own */
      }
    };
    void go();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      dispose?.();
      delete canvas.dataset.on;
    };
  }, [scene, tag, seed]);

  // data-scene names the instrument in the markup, so a page's scene can be checked without running it
  return <canvas ref={ref} aria-hidden data-scene={scene} className={`cx-scene ${className}`} />;
}
