"use client";

import Link from "next/link";
import { useState } from "react";
import { raptorTour, type RegionKey } from "@/data/platforms";
import { RaptorLive } from "./RaptorLive";
import { REGIONS, WORKSPACE } from "./RaptorWorkspace";

/**
 * Interface tour. Nine areas of the workspace study, each a real button:
 * numbered markers on the drawing (pointer and keyboard, from md up) and a
 * labelled list beside it (the primary control on touch screens). Selecting
 * one dims the rest of the drawing and explains what that area is for.
 */
export function RaptorTour() {
  const [active, setActive] = useState<RegionKey>("watchlist");
  const index = raptorTour.findIndex((r) => r.key === active);
  const current = raptorTour[index];

  return (
    <div className="grid gap-34 lg:grid-cols-phi lg:gap-55">
      <figure>
        <div className="rounded-md border border-line bg-surface p-8 shadow-3 sm:p-13">
          <div className="relative">
            <RaptorLive mode="tour" focus={[active]} ring tilt={false} label={`Illustrative study of a trading workspace, with the ${current.label.toLowerCase()} area brought forward`} />
            {raptorTour.map((r, i) => {
              const g = REGIONS[r.key];
              const on = r.key === active;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${i + 1}. ${r.label}`}
                  onClick={() => setActive(r.key)}
                  style={{ left: `${((g.x + g.w / 2) / WORKSPACE.w) * 100}%`, top: `${((g.y + g.h / 2) / WORKSPACE.h) * 100}%` }}
                  className={`num absolute hidden h-34 w-34 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-fast md:flex ${
                    on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-bg text-ink hover:border-ink"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <figcaption className="mt-13 text-xs text-ink-3">Illustrative study, not a screenshot; no live account, no real trading. Shapes stand in for figures on purpose.</figcaption>
      </figure>

      <div className="flex flex-col gap-21">
        <div className="order-2 border-t border-line-strong pt-21 lg:order-1" aria-live="polite">
          <p className="label">
            <span className="num text-prestige-ink">{String(index + 1).padStart(2, "0")}</span> <span aria-hidden>/</span> <span className="num">{String(raptorTour.length).padStart(2, "0")}</span>
          </p>
          <h3 className="h3 mt-8">{current.label}</h3>
          <p className="mt-13 min-h-[6.5rem] text-ink-2">{current.purpose}</p>
          {current.links.length > 0 && (
            <ul className="mt-13 flex flex-wrap gap-x-21 gap-y-8">
              {current.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link text-sm">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ul className="order-1 grid grid-cols-3 border-l border-t border-line lg:order-2 lg:mt-auto" aria-label="Areas of the workspace">
          {raptorTour.map((r, i) => {
            const on = r.key === active;
            return (
              <li key={r.key} className="border-b border-r border-line">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(r.key)}
                  className={`flex h-full min-h-[3.4375rem] w-full flex-col items-start justify-center gap-2 px-8 py-8 text-left transition-colors duration-fast sm:px-13 ${on ? "bg-surface" : "hover:bg-surface"}`}
                >
                  <span className={`num text-[0.6875rem] font-semibold ${on ? "text-accent" : "text-ink-3"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={`text-xs font-medium leading-tight sm:text-sm ${on ? "text-ink" : "text-ink-2"}`}>{r.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
