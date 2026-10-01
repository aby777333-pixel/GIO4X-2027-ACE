"use client";

import { useId, useMemo, useState } from "react";
import { KIND_LABEL, searchNodes } from "@/data/graph";
import { KindMark } from "./glyph";

/**
 * A combobox over every node in the graph. Plain string matching on names
 * and aliases: no ranking model, nothing sent anywhere.
 */
export function NodeSearch({
  label,
  placeholder,
  onPick,
  exclude,
  disabled,
  hint,
}: {
  label: string;
  placeholder: string;
  onPick: (id: string) => void;
  exclude?: string[];
  disabled?: boolean;
  hint?: string;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const results = useMemo(() => searchNodes(q, 12).filter((n) => !exclude?.includes(n.id)).slice(0, 8), [q, exclude]);
  const show = open && q.trim().length > 0;
  const idx = Math.min(at, Math.max(0, results.length - 1));

  const choose = (id: string) => {
    onPick(id);
    setQ("");
    setOpen(false);
    setAt(0);
  };

  return (
    <div className="field relative">
      <label htmlFor={`${uid}-in`}>{label}</label>
      <input
        id={`${uid}-in`}
        className="input"
        type="text"
        role="combobox"
        aria-expanded={show}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={show && results[idx] ? `${uid}-o-${idx}` : undefined}
        aria-describedby={hint ? `${uid}-hint` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        disabled={disabled}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setAt(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setAt(results.length ? (idx + 1) % results.length : 0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAt(results.length ? (idx - 1 + results.length) % results.length : 0);
          } else if (e.key === "Enter") {
            if (show && results[idx]) {
              e.preventDefault();
              choose(results[idx].id);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {hint && (
        <p id={`${uid}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      <ul id={`${uid}-list`} role="listbox" aria-label={label} hidden={!show} className="absolute left-0 right-0 top-[4.5rem] z-2 max-h-[21rem] overflow-y-auto rounded-sm border border-line-strong bg-surface shadow-2">
        {show && results.length === 0 && <li className="px-13 py-13 text-sm text-ink-3">Nothing in the graph matches “{q.trim()}”.</li>}
        {show &&
          results.map((n, i) => (
            <li
              key={n.id}
              id={`${uid}-o-${i}`}
              role="option"
              aria-selected={i === idx}
              className={`flex min-h-[2.75rem] cursor-pointer items-center gap-13 border-b border-line px-13 py-8 last:border-b-0 ${i === idx ? "bg-brand-soft" : ""}`}
              // keep focus in the input so the list does not close before the click lands
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(n.id)}
              onPointerEnter={() => setAt(i)}
            >
              <KindMark kind={n.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-medium text-ink">{n.label}</span>
                {n.sub && <span className="block truncate text-xs text-ink-3">{n.sub}</span>}
              </span>
              <span className="label shrink-0">{KIND_LABEL[n.kind].one}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
