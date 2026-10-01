"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rosette } from "@/components/brand/Rosette";
import { groupHits, parseIntent, search, type CommandId, type SearchEntry, type SearchHit } from "@/lib/search";
import { readPrefs, resetLocal, writePrefs } from "@/lib/prefs";

const OPEN_EVENT = "gx:command";

export function openCommandBar(initial = ""): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: initial }));
}

let indexPromise: Promise<SearchEntry[]> | null = null;
export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch("/search-index.json")
      .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

function runCommand(id: CommandId): string {
  const p = readPrefs();
  switch (id) {
    case "theme-dark":
      writePrefs({ ...p, theme: "dark" });
      return "Dark mode on.";
    case "theme-light":
      writePrefs({ ...p, theme: "light" });
      return "Light mode on.";
    case "theme-auto":
      writePrefs({ ...p, theme: "auto" });
      return "Following your system appearance.";
    case "motion-reduce":
      writePrefs({ ...p, motion: "reduced" });
      return "Motion reduced.";
    case "motion-full":
      writePrefs({ ...p, motion: "full" });
      return "Motion restored.";
    case "contrast-high":
      writePrefs({ ...p, contrast: "high" });
      return "Higher contrast on.";
    case "text-large":
      writePrefs({ ...p, text: "large" });
      return "Larger text on.";
    case "reset":
      resetLocal();
      return "Display reset to the GIO4X default.";
  }
}

type Row = { key: string; title: string; note?: string; group: string; run: () => void };

const STARTERS: { title: string; note: string; href: string }[] = [
  { title: "World Market Clock", note: "Who is open right now", href: "/markets/clock" },
  { title: "Gold", note: "XAU/USD", href: "/markets/metals/xau-usd" },
  { title: "Compare MetaTrader 5 and 777 Raptor", note: "Platforms", href: "/platforms/compare" },
  { title: "Position size calculator", note: "Trader Toolkit", href: "/tools/position-size" },
  { title: "Verify a GIO4X link", note: "Trust Centre", href: "/trust/verify" },
];

/**
 * The GIO4X Command Bar. Ctrl/Cmd+K anywhere, or "/" outside a text field.
 * A combobox + listbox: arrow keys move, Enter runs, Escape closes and
 * restores focus to wherever the visitor was.
 */
export function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setNotice(null);
    restoreRef.current?.focus?.();
  }, []);

  const show = useCallback((initial = "") => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    setQ(initial);
    setCursor(0);
    setFailed(false);
    loadSearchIndex()
      .then(setIndex)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = (e: Event) => show((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [open, close, show]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ("");
      router.push(href);
    },
    [router],
  );

  const { rows, hint, empty } = useMemo(() => {
    const intent = parseIntent(q);
    const out: Row[] = [];
    let hintText: string | null = null;
    const push = (hits: SearchHit[]) => {
      for (const { group, hits: hs } of groupHits(hits)) {
        for (const h of hs.slice(0, 5)) out.push({ key: `${group}:${h.h}`, title: h.t, note: h.d, group, run: () => go(h.h) });
      }
    };
    if (!q.trim()) {
      for (const s of STARTERS) out.push({ key: s.href, title: s.title, note: s.note, group: "Start here", run: () => go(s.href) });
      return { rows: out, hint: null, empty: false };
    }
    switch (intent.kind) {
      case "phi":
        out.push({ key: "phi", title: "φ = 1.618…", note: "Designing GIO4X: the proportion behind every page", group: "Design story", run: () => go("/design") });
        break;
      case "command":
        out.push({ key: intent.id, title: intent.label, note: "Display command", group: "Commands", run: () => setNotice(runCommand(intent.id)) });
        break;
      case "verify":
        out.push({
          key: "verify",
          title: "Check this link against the official GIO4X registry",
          note: intent.query || "Paste a link after verify:",
          group: "Verify",
          run: () => go(`/trust/verify${intent.query ? `#${encodeURIComponent(intent.query)}` : ""}`),
        });
        break;
      case "symbol":
        hintText = "Symbols";
        if (index) push(search(index, intent.query, { only: ["Instruments"], limit: 8 }));
        break;
      case "define":
        hintText = "Glossary";
        if (index) push(search(index, intent.query, { only: ["Glossary"], limit: 8 }));
        break;
      case "calc":
        hintText = "Tools";
        if (index) push(search(index, intent.query || "calculator", { only: ["Tools"], limit: 8 }));
        break;
      case "search":
        if (index) push(search(index, intent.query, { bias: intent.bias, limit: 24 }));
        break;
    }
    const isEmpty = out.length === 0 && !!index;
    if (isEmpty && index) {
      // nothing matched exactly: offer the closest things rather than a dead end
      const loose = search(index, q.split(/\s+/)[0] ?? q, { limit: 6 });
      for (const h of loose) out.push({ key: `near:${h.h}`, title: h.t, note: h.d, group: "Closest matches", run: () => go(h.h) });
    }
    if (q.trim().length >= 2) {
      out.push({ key: "all", title: `Search everything for “${q.trim()}”`, group: "Search", run: () => go(`/search?q=${encodeURIComponent(q.trim())}`) });
    }
    return { rows: out, hint: hintText, empty: isEmpty };
  }, [q, index, go]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[cursor]?.run();
    } else if (e.key === "Tab") {
      // keep focus inside the dialog
      e.preventDefault();
    }
  };

  let lastGroup = "";
  return (
    <div data-command className="fixed inset-0 z-modal flex items-start justify-center px-13 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--night)_38%,transparent)] backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="GIO4X command bar"
        className="relative w-full max-w-[42.5rem] overflow-hidden rounded-md border border-line-strong bg-paper shadow-3"
        style={{ animation: "gx-rise 260ms var(--ease-out)" }}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-13 border-b border-line px-21">
          <Rosette size={21} dna spin={!index && !failed} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setNotice(null);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="gx-command-list"
            aria-activedescendant={rows[cursor] ? `gx-row-${cursor}` : undefined}
            aria-autocomplete="list"
            placeholder="Search markets, tools, terms… or type a command"
            className="h-[3.4375rem] w-full bg-transparent text-md text-ink placeholder:text-ink-3 focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
          />
          <button type="button" onClick={close} className="chip shrink-0 cursor-pointer" aria-label="Close command bar">
            Esc
          </button>
        </div>

        <div ref={listRef} id="gx-command-list" role="listbox" aria-label="Results" className="max-h-[min(55vh,26rem)] overflow-y-auto overscroll-contain py-8">
          {notice && (
            <p role="status" className="px-21 py-13 text-sm text-ink-2">
              {notice}
            </p>
          )}
          {failed && (
            <p role="status" className="px-21 py-13 text-sm text-ink-2">
              Search could not load. The <a className="link" href="/explore">site directory</a> lists every page.
            </p>
          )}
          {empty && !notice && (
            <p className="px-21 pb-8 pt-13 text-sm text-ink-2">
              <span className="font-semibold text-ink">Nothing matched exactly.</span> {hint ? `No ${hint.toLowerCase()} entry for that.` : "These are the closest things we have."}
            </p>
          )}
          {rows.map((r, i) => {
            const head = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {head && <p className="label px-21 pb-5 pt-13">{r.group}</p>}
                <div
                  id={`gx-row-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseMove={() => setCursor(i)}
                  onClick={r.run}
                  className={`mx-8 flex cursor-pointer items-baseline justify-between gap-21 rounded-sm px-13 py-8 ${i === cursor ? "bg-brand-soft" : ""}`}
                >
                  <span className="truncate text-[0.9375rem] font-medium text-ink">{r.title}</span>
                  {r.note && <span className="hidden shrink truncate text-xs text-ink-3 sm:inline">{r.note}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-21 gap-y-5 border-t border-line px-21 py-8 text-xs text-ink-3">
          <span>
            <kbd className="font-sans font-semibold text-ink-2">$EURUSD</kbd> symbol
          </span>
          <span>
            <kbd className="font-sans font-semibold text-ink-2">define:</kbd> glossary
          </span>
          <span>
            <kbd className="font-sans font-semibold text-ink-2">calc:</kbd> tools
          </span>
          <span>
            <kbd className="font-sans font-semibold text-ink-2">verify:</kbd> a link
          </span>
          <span className="ml-auto hidden sm:inline">↑↓ move · Enter open</span>
        </div>
      </div>
    </div>
  );
}
