"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Step } from "@/components/tools/ui";
import { DataNote } from "@/components/ui/Page";
import { educationalNote } from "@/config/legal";

/**
 * What the Academy's exercises share: the frame, a labelled slider, the
 * sentence that states the current state in words, the "working" list, and
 * two small hooks.
 *
 * An exercise is drawn as SVG at the size it is shown (so its words stay
 * readable on a phone) in the page's own token colours. The drawing is
 * decorative to assistive technology: every value it shows is also in the
 * sliders and in the sentence under it, which is announced politely.
 */

/** The width an element is shown at, measured after mount; `fallback` until then (and on the server). */
export function useWidth<T extends HTMLElement>(fallback = 640): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** True when the visitor asked for less motion, by the system setting or by the site's own preferences. */
export function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(media.matches || root.dataset.motion === "reduced" || root.dataset.effects === "low");
    read();
    media.addEventListener("change", read);
    window.addEventListener("gx:prefs", read);
    return () => {
      media.removeEventListener("change", read);
      window.removeEventListener("gx:prefs", read);
    };
  }, []);
  return still;
}

/** The frame of an exercise: a real object on the page, so it takes a panel. */
export function LabFrame({ children, lab }: { children: ReactNode; lab: string }) {
  return (
    <div className="panel min-w-0 p-13 sm:p-21 lg:p-34" data-lab={lab}>
      {children}
    </div>
  );
}

/** The plate the drawing sits on. */
export function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flat select-none rounded-[8px] border border-line bg-surface/60 ${className}`}>{children}</div>;
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** the value in words: shown beside the label and read as the slider's value */
  text: string;
  hint?: ReactNode;
  /** a name for scripts and tests */
  name?: string;
};

/** A labelled range input: takes the pointer and the arrow keys, and says its value in words. */
export function Slider({ label, value, min, max, step, onChange, text, hint, name }: SliderProps) {
  const id = useId();
  return (
    <div className="field min-w-0 content-start !gap-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-13">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <output htmlFor={id} className="num text-sm font-medium text-ink">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range !h-[2.75rem]"
        data-slider={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={text}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The current state in words. Announced politely, as a whole sentence. */
export function Say({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="mt-21 max-w-measure text-[1.0625rem] leading-relaxed text-ink" data-lab-say>
      {children}
    </p>
  );
}

/** The arithmetic, one line at a time, in the manner of the Trader Toolkit's "With your numbers". */
export function Working({ steps, title = "The working" }: { steps: Step[]; title?: string }) {
  return (
    <div className="mt-21">
      <h3 className="label">{title}</h3>
      <ol className="mt-8 border-t border-line" data-lab-working>
        {steps.map((s, i) => (
          <li key={s.what} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] gap-x-8 border-b border-line py-13">
            <span className="num pt-2 text-xs font-semibold text-prestige-ink">{i + 1}</span>
            <span>
              <span className="block text-xs text-ink-3">{s.what}</span>
              <span className="num mt-2 block break-words text-[0.9375rem] text-ink">{s.calc}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Every exercise says what its figures are: invented, round, and no one's price. */
export function LabNote({ children }: { children?: ReactNode }) {
  return (
    <DataNote status="simulation" className="mt-21">
      Every figure here is an invented round example: no real instrument and no real price. {children} {educationalNote}
    </DataNote>
  );
}

/** An SVG label in the page's text face. */
export function Tag({ x, y, children, anchor = "start", tone = "ink-2", weight = 600, size = 12 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; tone?: "ink" | "ink-2" | "ink-3" | "accent" | "neg" | "pos"; weight?: number; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={size} fontWeight={weight} fill={`var(--${tone})`} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
      {children}
    </text>
  );
}
