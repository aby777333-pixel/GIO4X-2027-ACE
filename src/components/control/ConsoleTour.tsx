"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { NavEntry } from "@/components/control/nav-items";

const START_EVENT = "gxc:tour";
const DONE_EVENT = "gxc:tour-done";

/**
 * What the tour keeps in this browser, and nothing else:
 *   sessionStorage `gxc:tour`       the step the tour has reached, so it survives a reload and the
 *                                   moves between screens; removed when the tour ends
 *   localStorage   `gxc:tour-done`  "1" once the tour has been finished or ended, so the sidebar
 *                                   stops marking it as new
 * "Done" is a key of its own rather than a field of `gxc:look`: the look's writer stores exactly
 * `{ theme, palette }` (look.ts), so a third field there would be lost at the next change of look.
 * Neither key is sent anywhere. The public cookie notice says the console keeps them
 * (src/data/legal-docs.ts).
 */
const TOUR_KEY = "gxc:tour";
const TOUR_DONE_KEY = "gxc:tour-done";

/** Starts the console tour from its first step. */
export function startTour(): void {
  window.dispatchEvent(new Event(START_EVENT));
}

type Step = {
  key: string;
  /**
   * The menu item this step is about: the step is shown only to a person who has that item, and opens
   * the address the menu gives for it. null for a step everybody gets, which stays where the person is.
   */
  nav: string | null;
  title: string;
  /** two sentences, taken from what the screen itself does */
  text: string;
};

const STEPS: Step[] = [
  {
    key: "dashboard",
    nav: "dashboard",
    title: "Dashboard",
    text: "The dashboard shows enquiries, follow-ups and the pipeline at a glance. Every figure is read from real rows as you, so it shows what your role may see and nothing else.",
  },
  {
    key: "leads",
    nav: "leads",
    title: "Leads & CRM",
    text: "Leads lists the enquiries from the website’s contact and account-interest forms, and those entered by staff, newest first. Find one by its reference or e-mail address, narrow the list with the filters, and open an enquiry to work it.",
  },
  {
    key: "tickets",
    nav: "tickets",
    title: "Tickets",
    text: "Tickets is the support queue: requests for help opened on the website, the ones a customer wrote on most recently first. A ticket counts as overdue against the team’s own first-reply targets, which are for staff and are never a promise to the customer.",
  },
  {
    key: "chats",
    nav: "chats",
    title: "Live Chats",
    text: "Live Chats shows the conversations visitors start from the website’s chat window, waiting chats first. While this screen is open and your role may answer, you count as present, and the website offers chat only when somebody is.",
  },
  {
    key: "blog",
    nav: "blog",
    title: "Blog",
    text: "The website’s daily blog is written here. A post is public once it is published and its publication time has passed; until then only staff see it.",
  },
  {
    key: "config",
    nav: "config",
    title: "Configuration",
    text: "Configuration holds what the public website shows on your say: the announcement line, live chat, the support hours and the notices on the Status page. Every change made here is recorded in the audit log.",
  },
  {
    key: "activity",
    nav: "activity",
    title: "Team activity",
    text: "Team activity shows what the console recorded about each person’s work on tickets, live chat and enquiries. The figures are counts of events: nothing is scored, ranked or compared with a target.",
  },
  {
    key: "look",
    nav: null,
    title: "The console’s look",
    text: "Under Appearance, at the foot of the sidebar (at the top of the menu on a phone), choose light or dark and one of six palettes. The choice is kept in this browser only and changes nothing for anybody else.",
  },
];

function readStored(storage: "session" | "local", key: string): string {
  try {
    return (storage === "session" ? window.sessionStorage : window.localStorage).getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeProgress(step: string | null): void {
  try {
    if (step === null) window.sessionStorage.removeItem(TOUR_KEY);
    else window.sessionStorage.setItem(TOUR_KEY, JSON.stringify({ step }));
  } catch {
    /* storage unavailable: the tour still runs, and starts again after a reload */
  }
}

/** The step key that was stored, or "" when there is none or it cannot be read. */
function readProgress(): string {
  try {
    const v = JSON.parse(readStored("session", TOUR_KEY) || "null") as { step?: unknown } | null;
    return typeof v === "object" && v !== null && typeof v.step === "string" ? v.step : "";
  } catch {
    return "";
  }
}

function markDone(): void {
  try {
    window.localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* storage unavailable: the sidebar keeps marking the tour as new */
  }
  window.dispatchEvent(new Event(DONE_EVENT));
}

function subscribeDone(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === TOUR_DONE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DONE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DONE_EVENT, onChange);
  };
}
const readDone = () => readStored("local", TOUR_DONE_KEY);
// "1" on the server and before hydration: the mark appears only once this browser is known not to have taken the tour
const serverDone = () => "1";

/**
 * "Take the console tour", at the foot of the sidebar and in the phone menu.
 * Until the tour has been taken in this browser it carries a small "New" tag.
 */
export function TourButton({ onStart }: { onStart?: () => void }) {
  const done = useSyncExternalStore(subscribeDone, readDone, serverDone) === "1";
  return (
    <button
      type="button"
      className="gxc-nav-item w-full"
      onClick={() => {
        onStart?.();
        startTour();
      }}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </svg>
      <span className="min-w-0 flex-1 truncate">Take the console tour</span>
      {!done && <span className="gxc-soon">New</span>}
    </button>
  );
}

/**
 * A guided tour of the console for new staff, mounted once in the Shell.
 *
 * Each step opens a real screen and says, in two sentences, what that screen
 * does. The panel is not modal: the screen behind it stays usable, and the
 * tour can be left at any step. Steps for screens that are not on the
 * person's menu are left out, so nobody is walked to a page that would refuse
 * them (and every page checks access itself whatever this file does).
 */
export function ConsoleTour({ items }: { items: NavEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [at, setAt] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);

  // the steps this person gets, each with the address its menu item gives (null: stay where you are)
  const steps = useMemo(() => {
    const out: (Step & { href: string | null })[] = [];
    for (const step of STEPS) {
      if (step.nav === null) out.push({ ...step, href: null });
      else {
        const item = items.find((i) => i.key === step.nav && !i.soon);
        if (item) out.push({ ...step, href: item.href });
      }
    }
    return out;
  }, [items]);

  const show = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;
      writeProgress(step.key);
      setAt(index);
      if (step.href && window.location.pathname !== step.href) router.push(step.href);
    },
    [steps, router],
  );

  const end = useCallback(() => {
    writeProgress(null);
    markDone();
    setAt(null);
  }, []);

  // a tour in progress continues after a reload
  useEffect(() => {
    const stored = readProgress();
    if (!stored) return;
    const index = steps.findIndex((s) => s.key === stored);
    if (index >= 0) setAt(index);
    else writeProgress(null);
  }, [steps]);

  useEffect(() => {
    const onStart = () => {
      focusNext.current = true;
      show(0);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [show]);

  // when the tour is started, the keyboard lands on its first control; after that the focus is left alone
  useEffect(() => {
    if (at !== null && focusNext.current) {
      focusNext.current = false;
      nextRef.current?.focus();
    }
  }, [at]);

  const step = at === null ? undefined : steps[at];
  if (at === null || !step) return null;

  const last = at === steps.length - 1;
  const elsewhere = step.href !== null && pathname !== step.href;

  return (
    <section
      aria-label="Console tour"
      data-gxc-tour={step.key}
      className="fixed inset-x-13 bottom-13 z-overlay rounded-md border border-line-strong bg-paper p-21 shadow-3 sm:bottom-21 sm:left-auto sm:right-21 sm:w-[23rem]"
    >
      <p className="num text-xs text-ink-3">
        Console tour · step {at + 1} of {steps.length}
      </p>
      {/* read out when the step changes; the buttons keep the focus */}
      <div aria-live="polite" aria-atomic="true">
        <h2 className="h4 mt-5">{step.title}</h2>
        <p className="mt-8 text-sm text-ink-2">{step.text}</p>
      </div>
      {elsewhere && step.href && (
        <p className="mt-8 text-sm">
          <Link href={step.href} className="link">
            Open {step.title}
          </Link>
        </p>
      )}
      <div className="mt-13 flex flex-wrap items-center gap-8">
        <button type="button" className="btn btn-ghost" onClick={() => show(at - 1)} disabled={at === 0}>
          Back
        </button>
        <button ref={nextRef} type="button" className="btn btn-primary" onClick={() => (last ? end() : show(at + 1))}>
          {last ? "Finish" : "Next"}
        </button>
        <button type="button" className="btn btn-ghost ml-auto" onClick={end}>
          End tour
        </button>
      </div>
    </section>
  );
}
