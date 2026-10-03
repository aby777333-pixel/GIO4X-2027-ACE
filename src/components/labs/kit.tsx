"use client";

import { useId, type ReactNode } from "react";
import { Figure, type Colour, type FigureDraw } from "@/components/figures/Figure";

/** The few parts every Labs machine is made of: a framed canvas, a slider with its reading, a small note. */

export const ALERT: Colour = [214, 96, 88, 1];
export const AMBER: Colour = [214, 160, 70, 1];

export function Stage({ draw, ratio, rev }: { draw: FigureDraw; ratio: number; rev: number }) {
  return (
    // on a phone a wide, shallow canvas is too small to read: there it is never shallower than about 4:3
    <div className={`flat gx-stage ${ratio > 1.4 ? "max-sm:[&>div]:![aspect-ratio:1.4]" : ""}`}>
      <Figure draw={draw} ratio={ratio} rev={rev} />
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, text }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; text: string }) {
  const id = useId();
  return (
    <div className="mt-13 grid gap-5">
      <label htmlFor={id} className="label">
        {label}: <span className="num text-ink">{text}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-[2.75rem] w-full accent-[var(--accent)]" aria-valuetext={text} />
    </div>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <p className="mt-8 text-xs text-ink-3">{children}</p>;
