"use client";

import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Figure, clamp, type FigureDraw, type FigureFrame } from "@/components/figures/Figure";

/**
 * The frame every glossary diagram sits in: the canvas (drawn on the shared
 * figure host), and under it ONE real control wired to the same value the
 * pointer changes.
 *
 * A diagram has a single controlled value. Left alone it follows `auto`, so
 * the drawing loops calmly and the control's thumb moves with it, as the
 * scrubber of a film does. A mouse over the canvas, a finger dragged across
 * it, or the control (which takes the arrow keys) takes the value over; a few
 * seconds after the visitor lets go, the loop resumes.
 *
 * Under reduced motion the host draws one still frame at `rest`, and the
 * control still works: each change asks the host for one more frame.
 */

/** numbers a diagram keeps between frames (a spring's angle, an eased light) */
export type Mem = Record<string, number>;
export type DiagramDraw = (f: FigureFrame, v: number, mem: Mem) => void;

type Props = {
  draw: DiagramDraw;
  /** the visible label of the control under the canvas */
  control: string;
  min?: number;
  max?: number;
  step?: number;
  /** the value the loop takes, t seconds in */
  auto: (t: number) => number;
  /** the value of the composed still frame, and of the control before anything moves */
  rest: number;
  /** pointer position as fractions of the canvas (0 to 1 each way) to a value; by default, left to right */
  fromPointer?: (fx: number, fy: number, touch: boolean) => number;
  /** the state in words, shown under the control and read by a screen reader as the control's value */
  describe: (v: number) => string;
  /** the value is a position on a loop (0 and 1 are the same place) */
  wrap?: boolean;
  /** the value is a choice: it jumps rather than glides */
  snap?: boolean;
  ratio?: number;
};

/** how long after the visitor lets go the loop resumes, in milliseconds */
const IDLE = 5200;

type State = { v: number; shown: number; user: boolean; over: boolean; down: boolean; focus: boolean; still: boolean; last: number; ready: boolean; sync: number; text: string };

export function DiagramShell({ draw, control, min = 0, max = 1, step = 0.01, auto, rest, fromPointer, describe, wrap = false, snap = false, ratio = 1.7 }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLParagraphElement>(null);
  const mem = useRef<Mem>({});
  const start = clamp(rest, min, max);
  const st = useRef<State>({ v: start, shown: start, user: false, over: false, down: false, focus: false, still: false, last: 0, ready: false, sync: start, text: "" });
  const quant = (v: number) => Math.round(clamp(v, min, max) / step) * step;

  /** the control and the sentence under it, kept in step with what is drawn */
  const show = (v: number, moveThumb: boolean) => {
    const s = st.current;
    const q = quant(v);
    const input = inputRef.current;
    if (input && moveThumb && q !== s.sync) {
      input.value = String(q);
      s.sync = q;
    }
    let text = "";
    try {
      text = describe(snap ? q : v);
    } catch {
      text = "";
    }
    if (text !== s.text) {
      s.text = text;
      if (outRef.current) outRef.current.textContent = text;
      if (input) input.setAttribute("aria-valuetext", text);
    }
  };

  const paint: FigureDraw = (f) => {
    const s = st.current;
    s.still = f.still;
    if (s.user && !f.still && !s.over && !s.down && !s.focus && performance.now() - s.last > IDLE) s.user = false;
    const target = clamp(s.user ? s.v : f.still ? rest : auto(f.t), min, max);
    if (f.still || snap || !s.ready) s.shown = target;
    else {
      const k = 1 - Math.exp(-f.dt * (s.user ? 18 : 9));
      if (wrap) {
        const span = max - min;
        const d = ((((target - s.shown) % span) + span * 1.5) % span) - span / 2;
        s.shown = min + ((((s.shown - min + d * k) % span) + span) % span);
      } else s.shown += (target - s.shown) * k;
    }
    s.ready = true;
    show(s.shown, !s.user);
    try {
      draw(f, s.shown, mem.current);
    } catch {
      /* a drawing never takes the page down: a bad frame is simply skipped */
    }
  };

  /** ask the figure host for a frame: it repaints when the pointer leaves its canvas, moving or still */
  const repaint = () => wrapRef.current?.querySelector("canvas")?.dispatchEvent(new Event("pointerleave"));

  const take = (v: number, kick: boolean) => {
    const s = st.current;
    s.v = clamp(v, min, max);
    s.user = true;
    s.last = performance.now();
    s.sync = quant(s.v);
    if (inputRef.current && Number(inputRef.current.value) !== s.sync) inputRef.current.value = String(s.sync);
    if (kick || s.still) repaint();
  };

  const fromEvent = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = clamp((e.clientX - r.left) / Math.max(1, r.width));
    const fy = clamp((e.clientY - r.top) / Math.max(1, r.height));
    const touch = e.pointerType !== "mouse";
    const v = fromPointer ? fromPointer(fx, fy, touch) : min + (max - min) * clamp((fx - 0.07) / 0.86);
    take(Number.isFinite(v) ? v : st.current.v, touch);
  };

  // the still frame is drawn before this component's first value is known to the control: say it once
  useEffect(() => {
    show(st.current.shown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div
        ref={wrapRef}
        className="flat cursor-crosshair touch-pan-y rounded-[8px] border border-line bg-surface/60 p-8 sm:p-13"
        onPointerDown={(e) => {
          st.current.down = true;
          fromEvent(e);
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (e.pointerType === "mouse") s.over = true;
          else if (!s.down) return;
          fromEvent(e);
        }}
        onPointerUp={() => {
          st.current.down = false;
          st.current.last = performance.now();
        }}
        onPointerCancel={() => {
          st.current.down = false;
          st.current.last = performance.now();
        }}
        onPointerLeave={() => {
          const s = st.current;
          s.over = false;
          s.down = false;
          s.last = performance.now();
        }}
      >
        <Figure draw={paint} ratio={ratio} />
      </div>
      <div className="mt-8 grid items-center gap-x-13 sm:grid-cols-[auto_minmax(0,1fr)]">
        <label htmlFor={id} className="label">
          {control}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="range"
          className="range !h-[2.75rem]"
          min={min}
          max={max}
          step={step}
          defaultValue={start}
          onChange={(e) => take(Number(e.target.value), true)}
          onFocus={() => {
            const s = st.current;
            s.focus = true;
            // the arrow keys step from where the drawing is now, not from where the loop will be
            take(s.shown, true);
          }}
          onBlur={() => {
            st.current.focus = false;
            st.current.last = performance.now();
          }}
        />
      </div>
      <p ref={outRef} className="min-h-[1.3125rem] text-sm text-ink-2">
        {describe(snap ? quant(start) : start)}
      </p>
    </div>
  );
}
