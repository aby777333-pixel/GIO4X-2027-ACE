"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { signOut } from "@/app/control/actions";
import { startTour } from "@/components/control/ConsoleTour";
import { LOOK_EVENT, LOOK_KEY, LOOK_PALETTES, parseLook, readLookRaw, writeLook } from "@/components/control/look";
import type { NavEntry } from "@/components/control/nav-items";
import { openShortcuts } from "@/components/control/Shortcuts";

const OPEN_EVENT = "gxc:palette";

/** Opens the console's command palette. */
export function openPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** One record found by POST /control/search. `href` carries an id or a key, never an address. */
export type PaletteRecord = { kind: "lead" | "ticket" | "customer" | "post" | "faq"; href: string; title: string; note: string };
/** What POST /control/search answers with. `failed` names the kinds that could not be read just now. */
export type PaletteSearch = { ok: true; records: PaletteRecord[]; failed: PaletteRecord["kind"][] };

const KIND_GROUP: Record<PaletteRecord["kind"], string> = {
  lead: "Enquiries",
  ticket: "Tickets",
  customer: "Customers",
  post: "Blog posts",
  faq: "FAQ entries",
};
const KINDS = Object.keys(KIND_GROUP) as PaletteRecord["kind"][];

/**
 * Screens that are not on the menu themselves. Each is offered when its parent
 * section is on the person's menu. Some of them need more than the parent does
 * (writing a post, managing canned replies): the screen says so itself, as
 * every screen does, so offering it here gives nothing away.
 */
const SUB_SCREENS: { parent: string; label: string; href: string; words: string }[] = [
  { parent: "leads", label: "Add an enquiry", href: "/control/leads/new", words: "new lead enquiry add" },
  { parent: "blog", label: "New post", href: "/control/blog/new", words: "new blog post write" },
  { parent: "tickets", label: "Canned replies", href: "/control/tickets/macros", words: "macros canned replies tickets" },
  { parent: "tickets", label: "Assignment rules", href: "/control/tickets/rules", words: "rules assignment tickets" },
  { parent: "content", label: "Help & FAQ editor", href: "/control/content/faq", words: "faq help questions editor" },
  { parent: "content", label: "New FAQ question", href: "/control/content/faq/new", words: "new faq question add" },
  { parent: "reports", label: "Monthly summary", href: "/control/reports/summary", words: "monthly summary report month" },
];

/** Fewer characters than this are not sent: they would match nearly everything. The route applies the same floor. */
const MIN_CHARS = 2;
const DEBOUNCE_MS = 220;

/** What the route will make of the text (it reduces it the same way), to know whether it is worth asking. */
const reduce = (q: string) => q.replace(/[^A-Za-z0-9@._+-]/g, "");

function isPaletteSearch(value: unknown): value is PaletteSearch {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { ok?: unknown; records?: unknown; failed?: unknown };
  return (
    v.ok === true &&
    Array.isArray(v.failed) &&
    Array.isArray(v.records) &&
    v.records.every((r: unknown) => {
      if (typeof r !== "object" || r === null) return false;
      const x = r as Record<string, unknown>;
      // a link the palette will follow: only ever a path inside the console
      return typeof x.kind === "string" && KINDS.includes(x.kind as PaletteRecord["kind"]) && typeof x.href === "string" && x.href.startsWith("/control/") && typeof x.title === "string" && typeof x.note === "string";
    })
  );
}

function subscribeLook(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === LOOK_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOOK_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOOK_EVENT, onChange);
  };
}
const serverLook = () => "";

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

/**
 * The visible way in. `side` is the wide button under the name in the sidebar;
 * `top` is the icon in the phone's top bar. Both sit on the sidebar's colour.
 */
export function PaletteButton({ variant }: { variant: "side" | "top" }) {
  if (variant === "top") {
    return (
      <button type="button" className="gxc-top-button" aria-haspopup="dialog" onClick={openPalette}>
        <SearchIcon size={19} />
        <span className="sr-only">Search or jump to…</span>
      </button>
    );
  }
  return (
    <button type="button" className="gxc-nav-item w-full border border-white/20" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={openPalette}>
      <SearchIcon />
      <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
      <kbd aria-hidden className="shrink-0 rounded border border-white/25 px-5 font-sans text-[0.6875rem] leading-[1.5]">
        Ctrl K
      </kbd>
    </button>
  );
}

type Row = { key: string; group: string; title: string; note?: string; run: () => void };

/**
 * The console's command palette, mounted once in the Shell. Ctrl K or Cmd K
 * anywhere in the console, or the "Search or jump to…" button.
 *
 * A combobox with a listbox: arrow keys move, Enter runs, Escape closes and
 * puts the focus back where it was. Three kinds of result:
 *
 *   screens   the menu this person was given (`items`, already filtered by the
 *             server: access is not worked out again here), matched by name
 *   records   enquiries, tickets, customers, posts and FAQ entries, asked of
 *             POST /control/search, which reads as the signed-in person
 *   actions   light or dark, a palette, the tour, the shortcuts, sign out
 *
 * What is typed goes to the console's own search route in the body of a
 * request, not in an address, and nowhere else. Nothing typed is stored.
 */
export function CommandPalette({ items }: { items: NavEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  // the answer for `asked`; shown only while it is the answer to what is in the box
  const [found, setFound] = useState<{ asked: string; search: PaletteSearch } | null>(null);
  const [trouble, setTrouble] = useState<"" | "failed" | "ended">("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const look = parseLook(useSyncExternalStore(subscribeLook, readLookRaw, serverLook));

  const close = useCallback((restore = true) => {
    setOpen(false);
    setQ("");
    setFound(null);
    setTrouble("");
    if (restore) restoreRef.current?.focus?.();
  }, []);

  const show = useCallback(() => {
    // something else has the whole screen (the wallboard): a dialog opened behind it could not be seen
    if (document.fullscreenElement) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    setQ("");
    setCursor(0);
    setFound(null);
    setTrouble("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
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

  // arriving on another screen closes it (the focus belongs to the new screen, so it is not put back)
  useEffect(() => close(false), [pathname, close]);

  const reduced = reduce(q);
  const asking = open && reduced.length >= MIN_CHARS;

  // Records: asked for a moment after the typing stops, and the question before it abandoned.
  useEffect(() => {
    if (!asking) return;
    const text = q.trim();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/control/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ q: text }),
        credentials: "same-origin",
        cache: "no-store",
        signal: ctrl.signal,
      })
        .then(async (r) => {
          if (r.status === 401) return setTrouble("ended");
          const body: unknown = r.ok ? await r.json() : null;
          if (!isPaletteSearch(body)) return setTrouble("failed");
          setTrouble("");
          setFound({ asked: text, search: body });
        })
        .catch(() => {
          // an abandoned question is not a failure
          if (!ctrl.signal.aborted) setTrouble("failed");
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [asking, q]);

  const go = useCallback(
    (href: string) => {
      close(false);
      router.push(href);
    },
    [close, router],
  );

  const answer = asking && found && found.asked === q.trim() ? found.search : null;
  const waiting = asking && !answer && !trouble;

  const rows = useMemo(() => {
    const out: Row[] = [];
    const needle = q.trim().toLowerCase();
    const has = (...texts: string[]) => !needle || texts.some((t) => t.toLowerCase().includes(needle));

    // screens: the menu as the server filtered it for this person
    for (const item of items) {
      if (has(item.label)) out.push({ key: `screen:${item.key}`, group: "Screens", title: item.label, note: item.external ? "Opens in a new tab" : item.portal ? "In the portal console" : item.soon ? "Not built yet" : undefined, run: () => (item.external ? window.open(item.href, "_blank", "noopener") : go(item.href)) });
    }
    if (needle) {
      for (const sub of SUB_SCREENS) {
        const parent = items.find((i) => i.key === sub.parent && !i.soon);
        if (parent && has(sub.label, sub.words)) out.push({ key: `screen:${sub.href}`, group: "Screens", title: sub.label, note: parent.label, run: () => go(sub.href) });
      }
    }

    // records, in the order the route gave them
    if (answer) {
      for (const [i, r] of answer.records.entries()) out.push({ key: `${r.kind}:${i}:${r.href}`, group: KIND_GROUP[r.kind], title: r.title, note: r.note || undefined, run: () => go(r.href) });
    }

    // actions
    const act = (key: string, title: string, words: string, run: () => void, note?: string) => {
      if (has(title, words)) out.push({ key: `action:${key}`, group: "Actions", title, note, run });
    };
    const other = look.theme === "dark" ? "light" : "dark";
    act("theme", `Switch to ${other} mode`, "appearance theme look light dark mode", () => writeLook({ theme: other, palette: look.palette }), `Now ${look.theme}`);
    if (needle) {
      for (const p of LOOK_PALETTES) {
        act(`palette:${p.key}`, `Use the ${p.label} palette`, "appearance palette colour color look theme", () => writeLook({ theme: look.theme, palette: p.key }), p.key === look.palette ? "In use" : undefined);
      }
    }
    act("tour", "Take the console tour", "tour guide help new staff", () => {
      close(false);
      startTour();
    });
    act("shortcuts", "Keyboard shortcuts", "keys keyboard shortcuts help", () => {
      // closed first, with the focus put back, so that the sheet returns it to the same place
      close();
      openShortcuts();
    });
    act("signout", "Sign out", "sign out log out leave", () => {
      close(false);
      startTransition(() => {
        void signOut();
      });
    });
    return out;
  }, [q, items, answer, look.theme, look.palette, go, close]);

  useEffect(() => setCursor(0), [q]);
  // the list can shrink under the cursor when an answer arrives
  const active = Math.min(cursor, Math.max(0, rows.length - 1));
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(rows.length - 1, active + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, active - 1));
    } else if (e.key === "Home" && rows.length) {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End" && rows.length) {
      e.preventDefault();
      setCursor(rows.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[active]?.run();
    } else if (e.key === "Tab") {
      // keep the focus inside the dialog: the list is worked from the box
      e.preventDefault();
    }
  };

  const noRecords = !!answer && answer.records.length === 0;
  const nothing = rows.length === 0 && !waiting;
  let lastGroup = "";

  return (
    <div data-gxc-dialog="palette" className="fixed inset-0 z-modal flex items-start justify-center px-13 pt-[10vh]" role="presentation">
      <div className="absolute inset-0 bg-[rgba(4,10,20,0.5)]" onClick={() => close()} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search or jump to" className="relative w-full max-w-[42.5rem] overflow-hidden rounded-md border border-line-strong bg-paper shadow-3" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-13 border-b border-line px-21 text-ink-3">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTrouble("");
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="gxc-palette-list"
            aria-activedescendant={rows[active] ? `gxc-palette-row-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search or jump to a screen, an enquiry, a ticket, a customer or a post"
            placeholder="Search or jump to…"
            className="h-[3.4375rem] w-full min-w-0 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={120}
          />
          <button type="button" onClick={() => close()} tabIndex={-1} className="shrink-0 rounded border border-line-strong px-8 py-3 text-xs font-semibold text-ink-2 hover:text-ink" aria-label="Close the search">
            Esc
          </button>
        </div>

        <div ref={listRef} id="gxc-palette-list" role="listbox" aria-label="Results" className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain py-8">
          {rows.map((r, i) => {
            const head = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <div key={r.key} role="presentation">
                {head && (
                  <p role="presentation" className="label px-21 pb-5 pt-13">
                    {r.group}
                  </p>
                )}
                <div
                  id={`gxc-palette-row-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setCursor(i)}
                  onClick={r.run}
                  className={`mx-8 flex cursor-pointer flex-col gap-x-21 rounded-sm px-13 py-8 sm:flex-row sm:items-baseline sm:justify-between ${i === active ? "bg-brand-soft shadow-[inset_2px_0_0_var(--accent)]" : ""}`}
                >
                  <span className="min-w-0 truncate text-[0.9375rem] font-medium text-ink">{r.title}</span>
                  {/* beside the title on a wide screen, beneath it on a phone */}
                  {r.note && <span className="min-w-0 truncate text-xs text-ink-3 sm:max-w-[50%] sm:shrink-0">{r.note}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* what is happening, said once to a screen reader as well */}
        <div role="status" className="border-t border-line px-21 py-8 text-xs text-ink-3">
          {trouble === "ended" ? (
            <span className="text-ink-2">
              <span className="font-semibold text-ink">Your session has ended.</span> Records cannot be searched until you sign in again.
            </span>
          ) : trouble === "failed" ? (
            <span className="text-ink-2">
              <span className="font-semibold text-ink">Records could not be searched just now.</span> Screens and actions still work.
            </span>
          ) : waiting ? (
            "Searching records…"
          ) : nothing ? (
            <span className="text-ink-2">
              <span className="font-semibold text-ink">Nothing found.</span> No screen, record or action matches that.
            </span>
          ) : noRecords ? (
            "No enquiry, ticket, customer, post or FAQ entry matches that."
          ) : answer && answer.failed.length > 0 ? (
            `Could not be searched just now: ${answer.failed.map((k) => KIND_GROUP[k].toLowerCase()).join(", ")}.`
          ) : reduced.length < MIN_CHARS ? (
            <span className="flex flex-wrap items-center justify-between gap-x-21 gap-y-3">
              <span>Type two or more characters to search records your role can read.</span>
              <span className="hidden sm:inline">↑↓ move · Enter open · Esc close</span>
            </span>
          ) : (
            <span className="flex flex-wrap items-center justify-between gap-x-21 gap-y-3">
              <span>At most five of each kind are shown. The lists have the rest.</span>
              <span className="hidden sm:inline">↑↓ move · Enter open</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
