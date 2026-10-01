"use client";

import { useEffect, useState } from "react";

/**
 * The index of the five-beat narrative. It stays in view while the story
 * scrolls and marks the beat on screen (with a rule and aria-current, not
 * colour alone). Without JavaScript it is simply a list of anchors.
 */
export function BeatRail({ beats }: { beats: { id: string; label: string }[] }) {
  const [active, setActive] = useState(beats[0]?.id ?? "");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const els = beats.map((b) => document.getElementById(b.id)).filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [beats]);

  return (
    <nav aria-label="The Raptor story" className="scroll-x lg:sticky lg:top-[calc(var(--header-h)+2.125rem)] lg:overflow-visible">
      <ol className="flex gap-21 lg:flex-col lg:gap-0">
        {beats.map((b, i) => {
          const on = b.id === active;
          return (
            <li key={b.id} className="shrink-0">
              <a
                href={`#${b.id}`}
                aria-current={on ? "step" : undefined}
                className={`flex min-h-[2.75rem] items-center gap-13 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-fast ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                <span className="num w-13">{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden className={`hidden h-px origin-left bg-current transition-all duration-slow lg:block ${on ? "w-34" : "w-13"}`} />
                <span>{b.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
