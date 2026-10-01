"use client";

import { useEffect, useRef, useState } from "react";

export type ContentsItem = { id: string; n: string; title: string };

/**
 * Contents navigation for long documents.
 * Desktop: a sticky list that marks the section being read.
 * Mobile: a disclosure that closes itself once a section is chosen.
 * Without JavaScript both are plain anchor lists and still work.
 */
export function DocContents({ items, label = "Contents" }: { items: ContentsItem[]; label?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // the first section (in document order) that is currently on screen
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [items]);

  const list = (onPick?: () => void) => (
    <ol className="grid">
      {items.map((i) => {
        const on = active === i.id;
        return (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={onPick}
              aria-current={on ? "location" : undefined}
              className={`grid min-h-[2.75rem] grid-cols-[1.625rem_1fr] items-center gap-x-8 border-l py-5 pl-13 pr-8 text-sm transition-colors duration-fast lg:min-h-0 lg:py-[0.4375rem] ${
                on ? "border-accent text-ink" : "border-line text-ink-3 hover:border-line-strong hover:text-ink"
              }`}
            >
              <span className="num text-xs">{i.n}</span>
              <span>{i.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="no-print">
      <details ref={details} className="group border-y border-line lg:hidden">
        <summary className="flex min-h-[3.4375rem] items-center justify-between gap-13">
          <span className="label">{label}</span>
          <span className="flex items-center gap-8 text-xs text-ink-3">
            <span className="num">{items.length} sections</span>
            <span aria-hidden className="relative block h-[9px] w-[9px]">
              <span className="absolute left-0 top-1/2 h-px w-full bg-ink" />
              <span className="absolute left-1/2 top-0 h-full w-px bg-ink transition-transform duration-fast group-open:scale-y-0" />
            </span>
          </span>
        </summary>
        <nav aria-label={label} className="pb-21">
          {list(() => {
            if (details.current) details.current.open = false;
          })}
        </nav>
      </details>

      <nav aria-label={label} className="sticky top-[calc(var(--header-h)+2.125rem)] hidden max-h-[calc(100dvh-var(--header-h)-4.25rem)] overflow-y-auto lg:block">
        <p className="label mb-13">{label}</p>
        {list()}
      </nav>
    </div>
  );
}
