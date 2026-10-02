"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Fact } from "./facts";
import { buildScene, type RoundKind } from "./objects";
import { mountViewer, type ViewerHandle } from "./viewer";

/**
 * "In the round": an asset class as one object that can be turned, with what
 * the page says about the class pinned to it.
 *
 * The object is drawn on a canvas (viewer.ts, engine.ts, objects.ts). The
 * facts are an ordinary numbered list beside it, so nothing depends on the
 * picture: choosing a fact turns the object to its pin, and pointing at or
 * focusing a pin marks its fact in the list. Over each pin's head stands a
 * real button, so the pins can be reached and pressed like anything else.
 *
 * The panel is the night surface in both themes: a lit solid needs a dark
 * room, and the six classes then share one stage.
 */

type Props = {
  kind: RoundKind;
  /** the class's name, for labels */
  name: string;
  /** what the object is, in a sentence */
  object: string;
  facts: Fact[];
};

/** radians a press of an arrow key turns it */
const STEP = 0.26;

export function RoundViewer({ kind, name, object, facts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const handle = useRef<ViewerHandle | null>(null);
  const [active, setActive] = useState(-1);
  const [hot, setHot] = useState(-1);
  // the pins are placed by name; the list of names is what the picture depends on
  const pins = facts.map((f) => f.at).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = buildScene(kind);
    const names = pins ? pins.split("|") : [];
    const fallback = Object.values(scene.anchors)[0];
    const h = mountViewer(
      canvas,
      headRefs.current,
      scene,
      names.map((n) => scene.anchors[n] ?? fallback),
    );
    handle.current = h;
    return () => {
      h?.dispose();
      handle.current = null;
    };
  }, [kind, pins]);

  useEffect(() => {
    handle.current?.mark(active, hot);
  }, [active, hot]);

  const choose = useCallback((i: number) => {
    setActive(i);
    handle.current?.select(i);
  }, []);
  const cool = useCallback((i: number) => setHot((h) => (h === i ? -1 : h)), []);
  const reset = useCallback(() => {
    setActive(-1);
    handle.current?.reset();
  }, []);

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const turn: Record<string, [number, number]> = { ArrowLeft: [STEP, 0], ArrowRight: [-STEP, 0], ArrowUp: [0, -STEP / 2], ArrowDown: [0, STEP / 2] };
    const t = turn[e.key];
    if (t) {
      // the arrows turn the object while it has the focus, instead of scrolling the page
      e.preventDefault();
      handle.current?.nudge(t[0], t[1]);
    } else if (e.key === "Home") {
      e.preventDefault();
      reset();
    }
  };

  return (
    <div className="mt-34 grid gap-21 lg:grid-cols-phi lg:gap-34" data-round={kind}>
      <figure className="min-w-0">
        <div className="on-night relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-md border border-line sm:aspect-[1.618] lg:aspect-auto lg:h-full lg:min-h-[34rem]">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={`${object} It turns: drag it, or use the arrow keys while it has the focus.`}
            onKeyDown={onKey}
            className="absolute inset-0 h-full w-full cursor-grab touch-pan-y focus-visible:outline-offset-[-4px] data-[dragging]:cursor-grabbing"
          />
          {facts.map((f, i) => (
            <button
              key={f.at}
              ref={(el) => {
                headRefs.current[i] = el;
              }}
              type="button"
              data-pin={i + 1}
              aria-label={`Pin ${i + 1}: ${f.title}`}
              aria-pressed={active === i}
              onClick={() => choose(i)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") setHot(i);
              }}
              onPointerLeave={() => cool(i)}
              onFocus={() => setHot(i)}
              onBlur={() => cool(i)}
              className="absolute left-0 top-0 -ml-[20px] -mt-[20px] h-[40px] w-[40px] cursor-pointer rounded-full [transform:translate(-200px,-200px)] focus-visible:outline-offset-[-6px] data-[near=true]:z-1"
            />
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-13 p-13">
            <p className="max-w-[30ch] text-xs text-ink-2">Drag to turn it. With the keyboard, focus the picture and use the arrow keys.</p>
            <button type="button" onClick={reset} className="btn btn-ghost btn-sm pointer-events-auto shrink-0">
              Reset
            </button>
          </div>
        </div>
        <figcaption className="mt-8 text-xs text-ink-3">{object} An illustration: nothing on it is a price or a measurement.</figcaption>
      </figure>

      <div className="min-w-0">
        <h3 className="label">Pinned to it</h3>
        <ol className="mt-13 border-t border-line-strong" aria-label={`Facts about ${name}, numbered as the pins are`}>
          {facts.map((f, i) => {
            const on = active === i;
            const lit = hot === i;
            return (
              <li
                key={f.at}
                data-fact={i + 1}
                data-on={on ? "true" : undefined}
                data-hot={lit ? "true" : undefined}
                onClick={() => choose(i)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") setHot(i);
                }}
                onPointerLeave={() => cool(i)}
                // the page's row style (depth.css) owns a row's background and shadow, and keeps `bg-brand-soft` as a row's
                // own state; an outline marks the chosen and the pointed-at row without moving anything
                className={`grid cursor-pointer grid-cols-[2.125rem_1fr] gap-x-8 border-b border-line py-13 outline -outline-offset-2 ${on ? "bg-brand-soft outline-2 outline-accent" : lit ? "outline-1 outline-line-strong" : "outline-0 outline-transparent"}`}
              >
                <span
                  aria-hidden
                  className={`num mt-1 grid h-[1.625rem] w-[1.625rem] place-items-center rounded-full border text-xs font-semibold ${on ? "border-ink bg-ink text-bg" : lit ? "border-ink text-ink" : "border-line-strong text-ink-2"}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h4 className="h4">
                    <button type="button" aria-pressed={on} onFocus={() => setHot(i)} onBlur={() => cool(i)} className="text-left">
                      {f.title}
                    </button>
                  </h4>
                  <p className="mt-3 text-sm text-ink-2">{f.text}</p>
                  {f.items && f.items.length > 0 ? (
                    <ul className="mt-5 text-sm text-ink-2">
                      {f.items.map((it) => (
                        <li key={it} className="relative pl-13 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-[0.375rem] before:bg-[var(--line-strong)]">
                          {it}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-13 text-xs text-ink-3">Choose a fact and the object turns to its pin. Every fact is taken from this page.</p>
      </div>
    </div>
  );
}
