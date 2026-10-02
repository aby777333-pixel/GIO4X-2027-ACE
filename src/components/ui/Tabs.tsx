"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Tab = { key: string; label: string; content: ReactNode };

/**
 * Tabs, as the ARIA pattern describes them: one tab stop, arrow keys move
 * between tabs (Home and End jump to the ends), and the chosen panel is the
 * only one shown. Every panel is rendered on the server, so the text is in the
 * page for readers and search engines whichever tab is open; the others are
 * hidden, not absent. `minHeight` keeps the block from changing height as
 * panels of different lengths are chosen.
 */
export function Tabs({ tabs, label, minHeight, className = "" }: { tabs: Tab[]; label: string; minHeight?: string; className?: string }) {
  const [current, setCurrent] = useState(tabs[0]?.key ?? "");
  const base = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === current);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = tabs[next]!.key;
    setCurrent(key);
    refs.current.get(key)?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="scroll-x flex gap-5 border-b border-line">
        {tabs.map((tab) => {
          const selected = tab.key === current;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) refs.current.set(tab.key, el);
                else refs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCurrent(tab.key)}
              className={`-mb-px flex min-h-[2.75rem] shrink-0 items-center whitespace-nowrap border-b-2 px-13 text-sm transition-colors duration-fast ${
                selected ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={minHeight ? { minHeight } : undefined}>
        {tabs.map((tab) => (
          <div key={tab.key} role="tabpanel" id={`${base}-panel-${tab.key}`} aria-labelledby={`${base}-tab-${tab.key}`} hidden={tab.key !== current} tabIndex={0} className="pt-21">
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
