"use client";

/**
 * The first-visit tour.
 *
 * Two things live here. The invitation: a small card at the bottom-left of
 * the homepage, offering the tour once. It waits a few seconds and until the
 * visitor has scrolled past the hero, so it never lies over the first screen.
 * And the tour: a compact panel that walks a newcomer across eight real
 * pages (stops.ts), one page per stop, moving between them by ordinary client
 * navigation and, where a stop names one, bringing a single element of the
 * page into view with a soft ring round it.
 *
 * It is a labelled, non-modal dialog. The page behind stays fully usable,
 * focus is never trapped, "End tour" and Escape always end it, and each stop
 * is announced politely. The panel keeps to the bottom-left so that it never
 * meets the scroll arrows and the help button at the bottom-right, and sits a
 * layer below them, so an open chat window covers it instead of fighting it.
 *
 * What it stores: that the tour was started or declined, as `tourDone` in the
 * visitor's preferences (`gx:prefs`), so the invitation is not offered again;
 * and the stop a tour in progress has reached, in sessionStorage under
 * `gx:tour`, so the tour survives navigation and a reload within the visit.
 * Nothing is sent anywhere.
 *
 * A link to `/#tour` (the footer, /preferences, the command bar) starts it
 * from anywhere, however often.
 */
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFooterLift } from "@/components/shell/ChatWidget";
import { signalSound } from "@/components/sound/signal";
import { TOUR_HASH, TOUR_KEY, TOUR_STOPS } from "@/components/tour/stops";
import { usePrefs } from "@/hooks/usePrefs";
import { DEFAULT_PREFS, readPrefs, type Prefs } from "@/lib/prefs";

/** Long enough for the start-up animation to finish and the page to be read for a moment. */
const INVITE_AFTER_MS = 6000;

/** Bottom-left, clear of the right-hand column that the scroll arrows and the help button use on a phone. */
const PLACE =
  "no-print fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-8 right-[4.25rem] z-[37] sm:bottom-[max(1.3125rem,env(safe-area-inset-bottom))] sm:left-[max(1.3125rem,env(safe-area-inset-left))] sm:right-auto";

/** 44px touch targets on a phone, the compact size from `sm` up. */
const SMALL = "btn-sm h-[2.75rem] sm:h-[2.125rem]";

function readStop(): number | null {
  try {
    const raw = window.sessionStorage.getItem(TOUR_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { stop } = value as { stop?: unknown };
    return typeof stop === "number" && Number.isInteger(stop) && stop >= 0 && stop < TOUR_STOPS.length ? stop : null;
  } catch {
    return null;
  }
}

function writeStop(stop: number | null): void {
  try {
    if (stop === null) window.sessionStorage.removeItem(TOUR_KEY);
    else window.sessionStorage.setItem(TOUR_KEY, JSON.stringify({ stop }));
  } catch {
    /* storage unavailable: the tour works on this page and is not carried through a reload */
  }
}

function isStill(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
}

export function Tour() {
  const pathname = usePathname();
  const router = useRouter();
  const [prefs, update, ready] = usePrefs();
  const uid = useId();
  const lift = useFooterLift();

  /** the stop a tour in progress has reached, or null when there is no tour */
  const [stop, setStop] = useState<number | null>(null);
  const [invite, setInvite] = useState(false);
  /** a page change the tour itself asked for is under way */
  const [going, setGoing] = useState(false);
  /** said once, politely, when the tour ends */
  const [said, setSaid] = useState("");

  const panelRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  /** the panel takes focus when a tour starts, and only then */
  const focusPanel = useRef(false);

  // GIO4X Control never mounts the site shell; the check is a second lock on the same door
  const blocked = pathname?.startsWith("/control") ?? false;

  const start = useCallback(() => {
    setInvite(false);
    setSaid("");
    writeStop(0);
    setStop(0);
    focusPanel.current = true;
    if (!readPrefs().tourDone) update({ tourDone: true });
    if (pathRef.current !== TOUR_STOPS[0].path) {
      setGoing(true);
      router.push(TOUR_STOPS[0].path);
    }
    signalSound("chime");
  }, [router, update]);
  const startRef = useRef(start);
  startRef.current = start;

  const end = useCallback((finished: boolean) => {
    writeStop(null);
    setStop(null);
    setGoing(false);
    setSaid(finished ? "The tour is finished." : "The tour has ended.");
  }, []);

  const go = (n: number) => {
    const next = TOUR_STOPS[n];
    if (!next) return;
    writeStop(n);
    setStop(n);
    signalSound("chime");
    if (pathname !== next.path) {
      setGoing(true);
      router.push(next.path);
    }
  };

  const decline = () => {
    setInvite(false);
    update({ tourDone: true });
  };

  /** `/#tour` in the address: take the fragment out again and start. */
  const checkHash = useCallback(() => {
    if (window.location.hash !== TOUR_HASH) return;
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* the fragment stays; the tour still starts */
    }
    startRef.current();
  }, []);

  /* ---- a tour from earlier in this visit; and "Clear everything" ends one ---- */
  useEffect(() => {
    if (blocked) return;
    const stored = readStop();
    if (stored !== null) setStop(stored);
    const onPrefs = (e: Event) => {
      // resetLocal() announces the defaults themselves: it has just emptied this site's storage, gx:tour included
      if ((e as CustomEvent<Prefs>).detail === DEFAULT_PREFS) {
        setStop(null);
        setGoing(false);
      }
    };
    window.addEventListener("gx:prefs", onPrefs);
    return () => window.removeEventListener("gx:prefs", onPrefs);
  }, [blocked]);

  /* ---- every page change: the tour follows the visitor to whichever stop they are now on ---- */
  useEffect(() => {
    if (blocked) return;
    setGoing(false);
    const at = TOUR_STOPS.findIndex((s) => s.path === pathname);
    setStop((current) => (current !== null && at >= 0 ? at : current));
    if (at >= 0 && readStop() !== null) writeStop(at);
    checkHash();
  }, [pathname, blocked, checkHash]);

  /* ---- the ways in: a link to /#tour, or that address typed, pasted or pushed ---- */
  useEffect(() => {
    if (blocked) return;
    let later = 0;
    let latest = 0;
    // twice: once for a quick page, once more for a slow one
    const soon = () => {
      window.clearTimeout(later);
      window.clearTimeout(latest);
      later = window.setTimeout(checkHash, 300);
      latest = window.setTimeout(checkHash, 1500);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (a instanceof HTMLAnchorElement && a.origin === window.location.origin && a.pathname === "/" && a.hash === TOUR_HASH && (!a.target || a.target === "_self")) {
        // handled here, so the fragment never reaches the address bar
        e.preventDefault();
        startRef.current();
        return;
      }
      // the command bar navigates in script, which raises no hashchange: look once it has
      soon();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") soon();
    };
    window.addEventListener("hashchange", checkHash);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(later);
      window.clearTimeout(latest);
      window.removeEventListener("hashchange", checkHash);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [blocked, checkHash]);

  /* ---- the invitation: the homepage only, once, never over a tour, and never over the hero ---- */
  useEffect(() => {
    if (blocked || !ready || prefs.tourDone || stop !== null || pathname !== "/") {
      setInvite(false);
      return;
    }
    // Two conditions, both needed: a few seconds have passed, and the hero has
    // left the window. The first screen is the hero's alone, so the card waits
    // until the visitor has scrolled past it, and steps aside if they return.
    let waited = false;
    let past = false;
    const show = () => setInvite(waited && past);
    const timer = window.setTimeout(() => {
      waited = true;
      show();
    }, INVITE_AFTER_MS);

    const hero = document.querySelector("main .cx-hero");
    let io: IntersectionObserver | null = null;
    let raf = 0;
    const measure = () => {
      raf = 0;
      past = window.scrollY > window.innerHeight;
      show();
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    if (hero && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([entry]) => {
        past = !entry.isIntersecting;
        show();
      });
      io.observe(hero);
    } else {
      // no hero to watch: a full window of scrolling stands in for it
      measure();
      window.addEventListener("scroll", queue, { passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
    };
  }, [blocked, ready, prefs.tourDone, stop, pathname]);

  /* ---- Escape ends the tour, unless it belongs to something else that is open ---- */
  const active = stop !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = document.activeElement;
      if (el && el !== document.body && !panelRef.current?.contains(el)) {
        // a field being typed in, or a menu, the command bar, the Lens or the chat window: Escape is theirs
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
        const page = document.getElementById("main");
        const footer = document.querySelector("footer[data-site-footer]");
        if (!page?.contains(el) && !footer?.contains(el)) return;
      }
      end(false);
    };
    // on window, so a component that stops the key (the chat window does) keeps it
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, end]);

  /* ---- a tour that has just started hands the keyboard its panel ---- */
  useEffect(() => {
    if (stop !== null && focusPanel.current) {
      focusPanel.current = false;
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [stop]);

  /* ---- the one element a stop points at: brought into view, then ringed ---- */
  const current = stop !== null ? TOUR_STOPS[stop] : null;
  const onPath = !!current && pathname === current.path;
  const target = current && onPath && !going ? current.target : undefined;
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const hide = () => {
      ring.style.display = "none";
    };
    hide();
    if (!target) return;

    let el: HTMLElement | null = null;
    let dead = false;
    let raf = 0;
    let timer = 0;
    let tries = 0;

    const place = () => {
      raf = 0;
      if (dead || !el || !el.isConnected) return hide();
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return hide();
      // a full-width element keeps its ring inside the window
      const pad = 5;
      const left = Math.max(3, r.left - pad);
      const right = Math.min(document.documentElement.clientWidth - 3, r.right + pad);
      ring.style.display = "block";
      ring.style.left = `${left}px`;
      ring.style.top = `${r.top - pad}px`;
      ring.style.width = `${Math.max(0, right - left)}px`;
      ring.style.height = `${r.height + pad * 2}px`;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };

    const bring = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      const header = document.querySelector("header[data-site-header]")?.getBoundingClientRect().height ?? 55;
      const panel = panelRef.current?.getBoundingClientRect();
      // where the panel would lie over the element, the room it takes is not counted as room
      const taken = panel && r.left < panel.right + 13 ? panel.height + 21 : 0;
      const room = window.innerHeight - header - taken;
      const offset = r.height + 42 <= room ? r.top - header - (room - r.height) / 2 : r.top - header - 21;
      const top = Math.max(0, window.scrollY + offset);
      if (Math.abs(top - window.scrollY) < 8) return;
      window.scrollTo({ top, behavior: isStill() ? "auto" : "smooth" });
    };

    const find = () => {
      if (dead) return;
      el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (!el) {
        // the page may still be arriving
        if (++tries < 12) timer = window.setTimeout(find, 250);
        return;
      }
      bring(el);
      place();
    };
    // after the new page has taken its own scroll position
    timer = window.setTimeout(find, 420);

    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    const ro = new ResizeObserver(queue);
    ro.observe(document.body);
    return () => {
      dead = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      ro.disconnect();
      hide();
    };
  }, [target]);

  if (blocked) return null;

  const total = TOUR_STOPS.length;
  const last = stop === total - 1;

  return (
    <>
      {/* always present, so that the end of a tour can be announced after its panel has gone */}
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>

      <div
        ref={ringRef}
        aria-hidden
        className="no-print pointer-events-none fixed z-[36] rounded-md border-2 border-accent"
        style={{ display: "none", boxShadow: "0 0 0 5px color-mix(in srgb, var(--accent) 21%, transparent)" }}
      />

      {invite && stop === null && (
        <aside aria-label="Guided tour" className={`panel ${PLACE} p-13 shadow-3 sm:w-[21rem]`} style={{ marginBottom: lift || undefined, animation: "gx-rise 260ms var(--ease-out)" }}>
          <p className="text-sm font-semibold text-ink">New here?</p>
          <p className="mt-3 text-sm leading-snug text-ink-2">Take a two-minute tour of the markets, the accounts and the tools.</p>
          <div className="mt-13 flex flex-wrap items-center gap-8">
            <button type="button" className={`btn btn-primary ${SMALL}`} onClick={start}>
              Start<span className="sr-only"> the tour</span>
            </button>
            <button type="button" className={`btn btn-quiet ${SMALL}`} onClick={decline}>
              Not now
            </button>
          </div>
        </aside>
      )}

      {current && stop !== null && (
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-title`}
          tabIndex={-1}
          data-tour-panel=""
          className={`panel ${PLACE} flex max-h-[calc(100dvh-var(--header-h)-1rem)] flex-col shadow-3 focus:outline-none sm:w-[23rem]`}
          style={{ marginBottom: lift || undefined, animation: "gx-rise 260ms var(--ease-out)" }}
        >
          <div className="flex items-center justify-between gap-13 border-b border-line py-3 pl-13 pr-5">
            <p className="label">
              Tour · <span className="num">{stop + 1}</span> of <span className="num">{total}</span>
              {/* on a slow connection the panel changes before the page does: say that the page is on its way */}
              {going && <span className="text-ink-3"> · opening</span>}
            </p>
            <button type="button" className={`btn btn-quiet ${SMALL}`} onClick={() => end(false)}>
              End tour
            </button>
          </div>

          <div aria-live="polite" aria-atomic="true" className="min-h-0 overflow-y-auto px-13 py-13">
            <p id={`${uid}-title`} className="h4">
              <span className="sr-only">
                Stop {stop + 1} of {total}:{" "}
              </span>
              {current.title}
            </p>
            {onPath || going ? (
              <p className="mt-5 text-sm leading-snug text-ink-2">{current.body}</p>
            ) : (
              <p className="mt-5 text-sm leading-snug text-ink-2">This page is not one of the tour’s stops. The tour is waiting where you left it, and goes on from there when you are ready.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-8 border-t border-line px-13 py-8">
            {/* drawn progress; the count above says the same in words */}
            <span aria-hidden className="flex items-center gap-3">
              {TOUR_STOPS.map((s, i) => (
                <span key={s.path} className={`h-[3px] rounded-full ${i === stop ? "w-13 bg-accent" : i < stop ? "w-5 bg-ink-3" : "w-5 bg-line-strong"}`} />
              ))}
            </span>
            {onPath || going ? (
              <span className="flex items-center gap-5">
                {stop > 0 && (
                  <button type="button" className={`btn btn-quiet ${SMALL}`} onClick={() => go(stop - 1)} aria-label={`Back: ${TOUR_STOPS[stop - 1].title}`}>
                    Back
                  </button>
                )}
                {last ? (
                  <button type="button" className={`btn btn-primary ${SMALL}`} onClick={() => end(true)}>
                    Finish
                  </button>
                ) : (
                  <button type="button" className={`btn btn-primary ${SMALL}`} onClick={() => go(stop + 1)} aria-label={`Next: ${TOUR_STOPS[stop + 1].title}`}>
                    Next
                  </button>
                )}
              </span>
            ) : (
              <button
                type="button"
                className={`btn btn-primary ${SMALL}`}
                onClick={() => {
                  setGoing(true);
                  router.push(current.path);
                }}
              >
                Return to the tour
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
