"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavEntry } from "@/components/control/nav-items";

const OPEN_EVENT = "gxc:shortcuts";

/** Opens the sheet that lists the console's keyboard shortcuts. */
export function openShortcuts(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * `g` then one of these letters goes to that screen. Keyed by the menu's own
 * keys (nav-items.ts), so a screen is reachable this way only when it is on
 * the person's menu, and the sheet lists exactly the ones that are.
 */
const GO_KEYS: Record<string, string> = {
  dashboard: "d",
  command: "x",
  wall: "w",
  chats: "c",
  tickets: "t",
  leads: "l",
  pipeline: "p",
  tasks: "f",
  customers: "u",
  compliance: "o",
  reports: "r",
  analytics: "a",
  blog: "b",
  media: "m",
  seo: "e",
  content: "n",
  subscribers: "s",
  config: "g",
  staff: "y",
  activity: "v",
  audit: "h",
};

/** How long after `g` the second key is still taken as a destination. */
const GO_WINDOW_MS = 1500;

/** A field somebody is typing in: nothing here may take a key from it. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function Key({ children }: { children: string }) {
  return <kbd className="inline-flex min-w-[1.625rem] items-center justify-center rounded border border-line-strong bg-surface-2 px-5 py-[0.0625rem] font-sans text-xs font-semibold text-ink">{children}</kbd>;
}

/**
 * The console's keyboard layer, mounted once in the Shell.
 *
 *   g then a letter   go to a screen on the person's own menu
 *   /                 focus the search box of the screen that is open, if it has one
 *   n                 go to the screen's "new" action, if the screen offers one
 *   ?                 open the sheet that lists all of these
 *
 * None of them fires while somebody is typing in a field, a text area, a
 * select or an editable region, with Ctrl, Alt or Cmd held, or while a dialog
 * is open. `/` and `n` look at the screen itself (its search box, its link to
 * ".../new"), so they do exactly what the screen offers this person and
 * nothing when it offers nothing. Navigation here is a convenience: every
 * destination checks access itself.
 */
export function Shortcuts({ items }: { items: NavEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const goTimer = useRef<number | null>(null);

  // letter → destination, for the screens on this person's menu that are built
  const go = useMemo(() => {
    const map = new Map<string, NavEntry>();
    for (const item of items) {
      const key = GO_KEYS[item.key];
      if (key && !item.soon) map.set(key, item);
    }
    return map;
  }, [items]);

  const show = useCallback(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    restoreRef.current?.focus?.();
  }, []);

  const endGo = useCallback(() => {
    if (goTimer.current !== null) window.clearTimeout(goTimer.current);
    goTimer.current = null;
    setGoing(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;

      if (open) {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          close();
        } else if (e.key === "Tab") {
          // the sheet has one control; keep the focus on it
          e.preventDefault();
          closeRef.current?.focus();
        }
        return;
      }
      // another dialog (the command palette) is open, or the wallboard has the whole screen: the keys are theirs
      if (document.querySelector("[data-gxc-dialog]") || document.fullscreenElement) return;

      // the second key of "g then a letter"
      if (goTimer.current !== null) {
        endGo();
        const target = go.get(e.key);
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        show();
      } else if (e.key === "g") {
        setGoing(true);
        goTimer.current = window.setTimeout(endGo, GO_WINDOW_MS);
      } else if (e.key === "/") {
        // the open screen's own search box (the palette's box is not on the page while it is closed)
        const boxes = document.querySelectorAll<HTMLInputElement>('.gx-console input[type="search"]');
        const box = [...boxes].find((el) => el.offsetParent !== null && !el.disabled);
        if (box) {
          e.preventDefault();
          box.focus();
          box.select();
        }
      } else if (e.key === "n") {
        // the screen's own link to its "new" form: there only when this person may add
        const href = `${pathname.replace(/\/$/, "")}/new`;
        const link = [...document.querySelectorAll<HTMLAnchorElement>(".gx-console a[href]")].find((a) => a.getAttribute("href") === href);
        if (link) {
          e.preventDefault();
          router.push(href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [open, close, show, endGo, go, pathname, router]);

  useEffect(() => endGo, [endGo]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  // a move to another screen closes the sheet
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* said once to a screen reader, and shown while the second key is awaited */}
      <p role="status" className={going ? "fixed bottom-13 left-13 z-toast rounded-md border border-line-strong bg-paper px-13 py-8 text-sm text-ink shadow-3" : "sr-only"}>
        {going ? "Go to… press a letter" : ""}
      </p>

      {open && (
        <div data-gxc-dialog="shortcuts" className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto px-13 py-[8vh]" role="presentation">
          <div className="fixed inset-0 bg-[rgba(4,10,20,0.5)]" onClick={close} aria-hidden />
          <div role="dialog" aria-modal="true" aria-labelledby="gxc-shortcuts-title" className="relative w-full max-w-[40rem] rounded-md border border-line-strong bg-paper shadow-3">
            <div className="flex items-center justify-between gap-13 border-b border-line px-21 py-13">
              <h2 id="gxc-shortcuts-title" className="h4">
                Keyboard shortcuts
              </h2>
              <button ref={closeRef} type="button" className="btn btn-ghost" onClick={close}>
                Close
              </button>
            </div>
            <div className="grid gap-21 px-21 py-21 text-sm text-ink-2">
              <section aria-labelledby="gxc-shortcuts-any">
                <h3 id="gxc-shortcuts-any" className="label">
                  Anywhere in the console
                </h3>
                <dl className="mt-8 grid gap-8">
                  <div className="flex items-baseline gap-13">
                    <dt className="flex w-[6.5rem] shrink-0 gap-3">
                      <Key>Ctrl</Key>
                      <Key>K</Key>
                    </dt>
                    <dd>Search or jump to a screen, an enquiry, a ticket, a customer or a post. On a Mac, Cmd K.</dd>
                  </div>
                  <div className="flex items-baseline gap-13">
                    <dt className="flex w-[6.5rem] shrink-0 gap-3">
                      <Key>/</Key>
                    </dt>
                    <dd>Move to the search box of the screen that is open, on the screens that have one.</dd>
                  </div>
                  <div className="flex items-baseline gap-13">
                    <dt className="flex w-[6.5rem] shrink-0 gap-3">
                      <Key>n</Key>
                    </dt>
                    <dd>Start a new item, on a list that offers one to your role: an enquiry on Leads, a post on Blog, a question on Help &amp; FAQ.</dd>
                  </div>
                  <div className="flex items-baseline gap-13">
                    <dt className="flex w-[6.5rem] shrink-0 gap-3">
                      <Key>?</Key>
                    </dt>
                    <dd>Open or close this list.</dd>
                  </div>
                  <div className="flex items-baseline gap-13">
                    <dt className="flex w-[6.5rem] shrink-0 gap-3">
                      <Key>Esc</Key>
                    </dt>
                    <dd>Close this list or the search.</dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="gxc-shortcuts-go">
                <h3 id="gxc-shortcuts-go" className="label">
                  Go to a screen: g, then a letter
                </h3>
                <dl className="mt-8 grid gap-x-21 gap-y-8 sm:grid-cols-2">
                  {[...go.entries()].map(([key, item]) => (
                    <div key={item.key} className="flex items-baseline gap-13">
                      <dt className="flex w-[4rem] shrink-0 gap-3">
                        <Key>g</Key>
                        <Key>{key}</Key>
                      </dt>
                      <dd className="min-w-0 truncate">{item.label}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-8 text-xs text-ink-3">Only the screens on your menu are listed. Press the letter within a second or so of g.</p>
              </section>

              <p className="text-xs text-ink-3">A shortcut does nothing while you are typing in a field, or while Ctrl, Alt or Cmd is held.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
