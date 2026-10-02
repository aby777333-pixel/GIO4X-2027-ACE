"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { fmtDateTime } from "@/components/control/format";
import { CALENDAR_ERRORS, type CalendarPost, type CalendarResult, type ScheduleAction, type UnscheduleAction } from "@/components/control/views/blog-calendar-shared";
import { blogState, parseWhen, type BlogState } from "@/components/control/views/blog-shared";
import { BlogStateBadge } from "@/components/control/views/BlogListView";
import { BLOG_CATEGORY_LABEL } from "@/lib/blog";
import { CALENDAR_DEFAULT_TIME, dayKeyOf, dayKeyOfIso, dayLabel, dayNumber, dayShortLabel, isDayKey, isPastDay, monthLabel, timeOfIso, WEEKDAYS, weeksOf } from "@/lib/blog-calendar";

export type BlogCalendarProps = {
  /** "YYYY-MM": the month on show */
  month: string;
  /** the days drawn, whole weeks from a Monday (monthGrid) */
  days: string[];
  /** posts with a publication time inside those days: scheduled ones and published ones */
  dated: CalendarPost[];
  /** drafts and posts ready for review, the most recently changed first */
  tray: CalendarPost[];
  /** how many unscheduled posts there are in all; null when that could not be counted */
  trayTotal: number | null;
  /** rendered-at time: decides which days have passed and "scheduled" against "published" */
  now: number;
  /** may schedule, move and unschedule (blog.publish) */
  canPublish: boolean;
  schedule: ScheduleAction;
  unschedule: UnscheduleAction;
};

/** A post as the calendar places it. */
type Item = { post: CalendarPost; state: BlogState; day: string; time: string };

/** What is waiting for a confirmation. Nothing is saved until the dialog's button is pressed. */
type Pending =
  | { kind: "schedule"; item: Item; day: string; time: string; at: { x: number; y: number } | null }
  | { kind: "unschedule"; item: Item };

type Said = { tone: "ok" | "error"; text: string; month?: string };

/** A finger must rest this long on a chip before it lifts: shorter, and scrolling the page would pick posts up by accident. */
const LONG_PRESS_MS = 400;
/** How far a pointer travels before a press on a chip is a drag (mouse, pen) or a scroll (finger). */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
/** Dragging is for the month grid, which is drawn from `md` up. Below it the agenda's menus do the same. */
const GRID_QUERY = "(min-width: 820px)";

const TRAY = "tray";

function toItem(post: CalendarPost, now: number): Item {
  return { post, state: blogState(post, now), day: dayKeyOfIso(post.published_at), time: timeOfIso(post.published_at) };
}

/** A post that is already in front of the public is not the calendar's to move; neither is an archived one. */
const movable = (item: Item) => item.state === "draft" || item.state === "review" || item.state === "scheduled";

/* -------------------------------------------------------------------------- */
/* the menu on a chip: the same three actions without dragging                */
/* -------------------------------------------------------------------------- */

type MenuAction = { key: string; text: string; run: () => void };

/**
 * A menu button (WAI-ARIA menu pattern): Enter or Space opens it with the
 * first action focused, the arrow keys move, Escape closes it and returns to
 * the button. `data-no-drag` keeps a press on it from starting a drag.
 */
function ChipMenu({ title, actions }: { title: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // leaving the menu closes it; focus goes where Tab takes it
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className="relative shrink-0" data-no-drag>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for “${title}”`}
        title="Schedule, move or unschedule"
        data-chip-menu
        className="grid h-[2.75rem] w-[2.75rem] place-items-center rounded border border-line bg-surface text-ink-2 transition-colors duration-fast hover:border-accent hover:text-ink md:h-[1.75rem] md:w-[1.75rem]"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div ref={list} id={menuId} role="menu" aria-label={`Actions for “${title}”`} onKeyDown={onKeyDown} className="absolute right-0 top-full z-20 mt-3 grid min-w-[10.5rem] rounded-md border border-line-strong bg-surface p-3 shadow-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              data-menu-action={action.key}
              className="rounded px-8 py-13 text-left text-sm text-ink hover:bg-surface-2 focus-visible:bg-surface-2 md:py-5"
              onClick={() => {
                // focus first, so that the dialog this opens returns to the button when it closes
                close(true);
                action.run();
              }}
            >
              {action.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* the confirmation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The date and time a post is about to be scheduled for, said in full before
 * anything is saved. Both fields can be changed here; the button stays off
 * until they make a moment that is still to come.
 */
function ScheduleForm({
  pending,
  busy,
  problem,
  onConfirm,
  onCancel,
}: {
  pending: Extract<Pending, { kind: "schedule" }>;
  busy: boolean;
  problem: string;
  onConfirm: (day: string, time: string) => void;
  onCancel: () => void;
}) {
  const { item } = pending;
  const [day, setDay] = useState(pending.day);
  const [time, setTime] = useState(pending.time);
  // the moment the dialog opened: what "still to come" is measured against here (the server measures again)
  const [opened] = useState(() => Date.now());
  const moving = item.state === "scheduled";
  const id = useId();

  const when = day && time ? parseWhen(day, time, opened) : null;
  const iso = when && when.ok ? when.iso : null;
  const unchanged = moving && day === item.day && time === item.time;
  const wrong = !day
    ? "Choose a day."
    : !time
      ? "Choose a time."
      : !iso
        ? "That is not a date and time that can be used."
        : isPastDay(day, opened)
          ? "That day has passed. A post cannot be scheduled in the past: to publish it now, open it in the editor."
          : Date.parse(iso) <= opened
            ? "That time has already passed today. Choose a later time, or publish the post now from the editor."
            : unchanged
              ? "That is when the post is scheduled already."
              : "";

  return (
    <form
      className="grid gap-13 p-21"
      onSubmit={(e) => {
        e.preventDefault();
        if (!wrong && !busy) onConfirm(day, time);
      }}
    >
      <div>
        <h2 id="calendar-dialog-title" className="text-sm font-semibold text-ink">
          {moving ? "Move this post" : "Schedule this post"}
        </h2>
        <p className="mt-3 break-words text-sm text-ink-2">“{item.post.title}”</p>
        {moving && (
          <p className="mt-3 text-xs text-ink-3">
            Scheduled now for <span className="num">{fmtDateTime(item.post.published_at)}</span>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-8">
        <div className="field min-w-0">
          <label htmlFor={`${id}-day`}>Day (UTC)</label>
          <input id={`${id}-day`} type="date" className="input num" value={day} min={dayKeyOf(opened)} onChange={(e) => setDay(e.target.value)} required data-calendar-day />
        </div>
        <div className="field min-w-0">
          <label htmlFor={`${id}-time`}>Time (UTC)</label>
          <input id={`${id}-time`} type="time" className="input num" value={time} onChange={(e) => setTime(e.target.value)} required data-calendar-time />
        </div>
      </div>

      <p className="text-sm text-ink" role="status" data-calendar-exact>
        {wrong ? (
          <span className="font-medium text-neg">{wrong}</span>
        ) : (
          <>
            The post will appear on the website by itself on{" "}
            <strong className="num font-semibold">
              {dayLabel(day)} at {time} UTC
            </strong>
            .
          </>
        )}
      </p>
      <p className="text-xs text-ink-3">UTC, not your local time. Nothing is saved until you press {moving ? "Move" : "Schedule"}. The words of the post are not changed.</p>

      {problem && (
        <p role="alert" className="text-sm font-medium text-neg" data-calendar-problem>
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-8">
        <button type="submit" className="btn btn-primary" disabled={busy || wrong !== ""} aria-disabled={busy || wrong !== ""} data-calendar-confirm>
          {busy ? "Saving…" : moving ? "Move" : "Schedule"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function UnscheduleForm({ item, busy, problem, onConfirm, onCancel }: { item: Item; busy: boolean; problem: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <form
      className="grid gap-13 p-21"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onConfirm();
      }}
    >
      <div>
        <h2 id="calendar-dialog-title" className="text-sm font-semibold text-ink">
          Unschedule this post
        </h2>
        <p className="mt-3 break-words text-sm text-ink-2">“{item.post.title}”</p>
      </div>
      <p className="text-sm text-ink" data-calendar-exact>
        It is scheduled for <strong className="num font-semibold">{fmtDateTime(item.post.published_at)}</strong>. Unscheduling makes it a draft again and clears that time: it will not appear on the website until it is scheduled or published again.
      </p>
      <p className="text-xs text-ink-3">Nothing is saved until you press Unschedule. The words of the post are not changed.</p>
      {problem && (
        <p role="alert" className="text-sm font-medium text-neg" data-calendar-problem>
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-8">
        <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy} data-calendar-confirm>
          {busy ? "Saving…" : "Unschedule"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* the calendar                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The month as a grid of UTC days with each day's posts, and beside it the
 * tray of posts that have no date yet. Someone who may publish can drag a
 * post onto a day, to another day, or back to the tray; every chip also has a
 * menu that does the same without dragging. Either way a small dialog states
 * the exact date and time and nothing is saved until it is confirmed.
 *
 * What is offered follows the role as a courtesy: the actions check the role
 * again and the database has the final say. After a change the page is read
 * again from the server, so what is shown is what was stored.
 */
export function BlogCalendar({ month, days, dated, tray, trayTotal, now, canPublish, schedule, unschedule }: BlogCalendarProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState("");
  const [said, setSaid] = useState<Said | null>(null);
  const [dragging, setDragging] = useState<{ item: Item; over: string | null } | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const saidRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ item: Item; pointerId: number; type: string; x: number; y: number; started: boolean; timer: number | null; el: HTMLElement } | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const justDragged = useRef(false);

  const today = dayKeyOf(now);
  const weeks = useMemo(() => weeksOf(days), [days]);
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const post of dated) {
      const item = toItem(post, now);
      if (!item.day) continue;
      const list = map.get(item.day);
      if (list) list.push(item);
      else map.set(item.day, [item]);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time) || a.post.title.localeCompare(b.post.title));
    return map;
  }, [dated, now]);
  const trayItems = useMemo(() => tray.map((post) => toItem(post, now)), [tray, now]);

  /* ---- saying what happened ---- */
  const say = useCallback((next: Said) => setSaid(next), []);

  // After the page is read again the chip that had focus may be elsewhere, so the outcome is where the keyboard goes.
  // The dialog is closed in a layout effect (below), which runs before this one: by now it has handed focus back.
  useEffect(() => {
    if (!said || pending) return;
    saidRef.current?.focus({ preventScroll: true });
    saidRef.current?.scrollIntoView({ block: "nearest" });
  }, [said, pending]);

  /* ---- the dialog ---- */
  // Opened and closed to follow `pending`. A drop opens it beside the day it was dropped on; from a menu, or on a
  // narrow screen, it is centred.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (pending && !el.open) el.showModal();
    if (!pending && el.open) el.close();
    const at = pending?.kind === "schedule" ? pending.at : null;
    if (!at || !window.matchMedia(GRID_QUERY).matches) {
      el.style.cssText = "";
      return;
    }
    const box = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.x + 13, window.innerWidth - box.width - 8));
    const top = Math.max(8, Math.min(at.y + 13, window.innerHeight - box.height - 8));
    el.style.cssText = `position:fixed;margin:0;left:${left}px;top:${top}px`;
  }, [pending]);

  const cancel = () => {
    if (busy) return;
    setPending(null);
    setProblem("");
  };

  const finish = (result: CalendarResult, item: Item, day: string) => {
    if (!result.ok) {
      setProblem(CALENDAR_ERRORS[result.code]);
      // the post is not where this page thought it was: read it again
      if (result.code === "gone" || result.code === "live" || result.code === "archived" || result.code === "unscheduled") router.refresh();
      return;
    }
    setPending(null);
    setProblem("");
    const title = `“${item.post.title}”`;
    const elsewhere = day && day.slice(0, 7) !== month ? day.slice(0, 7) : undefined;
    if (result.code === "unscheduled") say({ tone: "ok", text: `Unscheduled. ${title} is a draft again, under “Not scheduled”.` });
    else if (result.code === "moved") say({ tone: "ok", text: `Moved. ${title} is now scheduled for ${fmtDateTime(result.at)}.`, month: elsewhere });
    else say({ tone: "ok", text: `Scheduled. ${title} appears on the website by itself on ${fmtDateTime(result.at)}.`, month: elsewhere });
    router.refresh();
  };

  const confirmSchedule = (item: Item, day: string, time: string) => {
    setProblem("");
    startTransition(async () => {
      let result: CalendarResult;
      try {
        result = await schedule(item.post.id, day, time);
      } catch {
        result = { ok: false, code: "save" };
      }
      finish(result, item, day);
    });
  };

  const confirmUnschedule = (item: Item) => {
    setProblem("");
    startTransition(async () => {
      let result: CalendarResult;
      try {
        result = await unschedule(item.post.id);
      } catch {
        result = { ok: false, code: "save" };
      }
      finish(result, item, "");
    });
  };

  /* ---- the menu's way in ---- */
  const askSchedule = (item: Item, at: { x: number; y: number } | null = null, day = item.state === "scheduled" ? item.day : "") => {
    setProblem("");
    setSaid(null);
    // a scheduled post keeps its time of day when it moves; a new one starts at the default
    setPending({ kind: "schedule", item, day, time: item.state === "scheduled" && item.time ? item.time : CALENDAR_DEFAULT_TIME, at });
  };
  const askUnschedule = (item: Item) => {
    setProblem("");
    setSaid(null);
    setPending({ kind: "unschedule", item });
  };

  const actionsFor = (item: Item): MenuAction[] =>
    item.state === "scheduled"
      ? [
          { key: "move", text: "Move…", run: () => askSchedule(item) },
          { key: "unschedule", text: "Unschedule", run: () => askUnschedule(item) },
        ]
      : [{ key: "schedule", text: "Schedule…", run: () => askSchedule(item) }];

  /* ---- dragging ---- */
  const targetAt = (x: number, y: number): string | null => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]")?.dataset.drop ?? null;

  const moveGhost = (x: number, y: number) => {
    point.current = { x, y };
    if (ghost.current) ghost.current.style.transform = `translate(${x + 13}px, ${y + 13}px)`;
  };

  const drop = (item: Item, target: string | null, at: { x: number; y: number }) => {
    if (!target) return;
    if (target === TRAY) {
      if (item.state === "scheduled") askUnschedule(item);
      return;
    }
    if (!isDayKey(target)) return;
    // put back where it was: nothing to do
    if (item.state === "scheduled" && item.day === target) return;
    if (isPastDay(target, now)) {
      say({ tone: "error", text: `${dayLabel(target)} has passed. A post cannot be scheduled on a day that has passed. To publish a post now, open it in the editor.` });
      return;
    }
    askSchedule(item, at, target);
  };

  const endPress = () => {
    const p = press.current;
    if (p?.timer) window.clearTimeout(p.timer);
    press.current = null;
    setDragging(null);
  };

  const begin = (p: NonNullable<typeof press.current>) => {
    p.started = true;
    try {
      // the chip keeps receiving this pointer's events wherever it travels
      p.el.setPointerCapture(p.pointerId);
    } catch {
      /* the pointer is already gone: the drag ends at the next event */
    }
    point.current = { x: p.x, y: p.y };
    setSaid(null);
    setDragging({ item: p.item, over: targetAt(p.x, p.y) });
  };

  const dragProps = (item: Item) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (press.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      if (!window.matchMedia(GRID_QUERY).matches) return;
      const p = { item, pointerId: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, started: false, timer: null as number | null, el: e.currentTarget };
      // a finger lifts a chip by resting on it; a mouse or pen by moving it
      if (e.pointerType === "touch") {
        p.timer = window.setTimeout(() => {
          if (press.current === p) begin(p);
        }, LONG_PRESS_MS);
      }
      press.current = p;
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (!p.started) {
        const travelled = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.type === "touch") {
          // the finger moved before the chip lifted: it is scrolling the page
          if (travelled > TOUCH_SLOP) endPress();
          else {
            p.x = e.clientX;
            p.y = e.clientY;
          }
          return;
        }
        if (travelled < MOUSE_SLOP) return;
        begin(p);
      }
      moveGhost(e.clientX, e.clientY);
      const over = targetAt(e.clientX, e.clientY);
      setDragging((d) => (d && d.over !== over ? { ...d, over } : d));
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      const started = p.started;
      endPress();
      if (!started) return;
      // the click that follows a drag must not open the post
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 80);
      drop(p.item, targetAt(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
      if (press.current?.pointerId === e.pointerId) endPress();
    },
    onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
      if (!justDragged.current) return;
      e.preventDefault();
      e.stopPropagation();
    },
    // the browser's own drag of a link, and the long-press menu on a touch screen, would both get in the way
    onDragStart: (e: ReactDragEvent<HTMLElement>) => e.preventDefault(),
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
      if (press.current?.type === "touch") e.preventDefault();
    },
  });

  // While a chip is lifted the page must not scroll under the finger. React listens to touchmove passively,
  // so this one is added by hand; it does nothing unless a drag is under way.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (press.current?.started && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", hold, { passive: false });
    return () => el.removeEventListener("touchmove", hold);
  }, []);

  // Escape puts a lifted chip back
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const p = press.current;
      if (p?.timer) window.clearTimeout(p.timer);
      press.current = null;
      setDragging(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragging]);

  /* ---- drawing ---- */
  const chip = (item: Item, where: "grid" | "tray" | "agenda") => {
    const can = canPublish && movable(item);
    const draggable = can && where !== "agenda";
    const lifted = dragging?.item.post.id === item.post.id;
    return (
      <div
        data-chip={item.post.id}
        data-chip-state={item.state}
        data-chip-where={where}
        className={`rounded border bg-surface p-5 ${item.state === "live" ? "border-line bg-surface-2" : "border-line-strong"} ${draggable ? "cursor-grab select-none [-webkit-touch-callout:none]" : ""} ${lifted ? "opacity-40" : ""}`}
        {...(draggable ? dragProps(item) : {})}
      >
        <Link href={`/control/blog/${item.post.id}`} draggable={false} className={`break-words font-medium text-ink hover:text-accent ${where === "grid" ? "line-clamp-2 text-xs" : "block text-sm"}`} title={item.post.title}>
          {item.post.title}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <BlogStateBadge post={item.post} now={now} />
          {item.time && (item.state === "scheduled" || item.state === "live") && <span className="num whitespace-nowrap text-[0.6875rem] text-ink-3">{item.time} UTC</span>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-5">
          <span className="min-w-0 truncate text-[0.6875rem] text-ink-3">{BLOG_CATEGORY_LABEL[item.post.category]}</span>
          {can && <ChipMenu title={item.post.title} actions={actionsFor(item)} />}
        </div>
      </div>
    );
  };

  const dropClass = (key: string, past: boolean) =>
    dragging?.over === key ? (past ? "outline-dashed outline-2 -outline-offset-2 outline-line-strong" : "bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))] outline outline-2 -outline-offset-2 outline-accent") : "";

  const anyDated = days.some((d) => byDay.has(d));
  const trayMore = trayTotal !== null && trayTotal > trayItems.length;

  return (
    <div ref={root} className="grid gap-13" data-calendar data-dragging={dragging ? "" : undefined} aria-busy={busy}>
      <div ref={saidRef} tabIndex={-1} role={said?.tone === "error" ? "alert" : "status"} data-calendar-said={said?.tone} className={`outline-none ${said ? "" : "hidden"}`}>
        {said && (
          <div className={`panel-quiet border-l-2 px-21 py-13 ${said.tone === "error" ? "border-l-neg" : "border-l-pos"}`}>
            <p className="text-sm font-semibold text-ink">{said.text}</p>
            {said.month && (
              <p className="mt-3 text-sm text-ink-2">
                That is in another month.{" "}
                <Link href={`/control/blog/calendar?month=${said.month}`} className="link">
                  Show {monthLabel(said.month)}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-13 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* the tray comes first in the page (a post is picked up here, then placed) and sits to the right from `lg` up */}
        <section
          aria-labelledby="calendar-tray-h"
          data-drop={canPublish ? TRAY : undefined}
          data-tray
          className={`gxc-card min-w-0 lg:sticky lg:top-21 lg:col-start-2 lg:row-start-1 ${dropClass(TRAY, false)}`}
        >
          <div className="gxc-card-head">
            <h2 id="calendar-tray-h" className="gxc-card-title">
              Not scheduled
            </h2>
            <span className="num text-xs text-ink-3" data-tray-count>
              {trayTotal ?? trayItems.length}
            </span>
          </div>
          <div className="gxc-card-body">
            <p className="text-xs text-ink-3">
              Drafts and posts ready for review, the most recently changed first.
              {canPublish ? <span className="hidden md:inline"> Drag one onto a day, or use its menu. Drop a scheduled post here to unschedule it.</span> : ""}
            </p>
            {trayItems.length ? (
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:max-h-[38rem] lg:grid-cols-1 lg:overflow-y-auto" aria-label="Posts that are not scheduled">
                {trayItems.map((item) => (
                  <li key={item.post.id}>{chip(item, "tray")}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 border-t border-line pt-8 text-sm text-ink-2" data-tray-empty>
                There is no draft and no post ready for review.
              </p>
            )}
            {trayMore && (
              <p className="mt-8 text-xs text-ink-3">
                {trayItems.length} of {trayTotal} shown. The rest are in the{" "}
                <Link href="/control/blog?status=draft" className="link">
                  list of drafts
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {/* the month as a grid, from `md` up */}
          <table className="hidden w-full table-fixed border-separate border-spacing-0 border border-line bg-surface md:table" data-calendar-grid>
            <caption className="sr-only">
              {monthLabel(month)}: posts by the day they are published or scheduled for. Days and times are UTC.
            </caption>
            <thead>
              <tr>
                {WEEKDAYS.map((name) => (
                  <th key={name} scope="col" className="border-b border-line px-5 py-5 text-left text-[0.6875rem] font-semibold text-ink-3">
                    <abbr title={name} className="no-underline">
                      {name.slice(0, 3)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]}>
                  {week.map((day, column) => {
                    const past = isPastDay(day, now);
                    const inMonth = day.startsWith(month);
                    const items = byDay.get(day) ?? [];
                    return (
                      <td
                        key={day}
                        data-drop={canPublish ? day : undefined}
                        data-day={day}
                        data-past={past ? "" : undefined}
                        className={`h-[7.5rem] border-b border-line p-3 align-top ${column > 0 ? "border-l" : ""} ${past || !inMonth ? "bg-surface-2" : ""} ${dropClass(day, past)}`}
                      >
                        <p className="flex items-center gap-5 px-2 pb-3 text-xs">
                          <time dateTime={day} className={`num ${day === today ? "font-bold text-accent" : inMonth ? "font-semibold text-ink" : "text-ink-3"}`}>
                            <span aria-hidden>{inMonth ? dayNumber(day) : dayShortLabel(day).slice(4)}</span>
                            <span className="sr-only">{dayLabel(day)}</span>
                          </time>
                          {day === today && <span className="text-[0.6875rem] font-semibold text-accent">Today</span>}
                        </p>
                        {items.length > 0 && (
                          <ul className="grid gap-3">
                            {items.map((item) => (
                              <li key={item.post.id}>{chip(item, "grid")}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* the same month as an agenda, below `md`: week by week, the days that have a post */}
          <div className="md:hidden" data-calendar-agenda>
            {weeks.map((week) => {
              const withPosts = week.filter((day) => byDay.has(day));
              return (
                <section key={week[0]} aria-label={`Week of ${dayLabel(week[0])}`} className="border-t border-line py-13 first:border-t-0 first:pt-0">
                  <h3 className="label">
                    {dayShortLabel(week[0])} to {dayShortLabel(week[6])}
                  </h3>
                  {withPosts.length ? (
                    <ul className="mt-8 grid gap-13">
                      {withPosts.map((day) => (
                        <li key={day} data-agenda-day={day}>
                          <p className="text-sm font-semibold text-ink">
                            <time dateTime={day}>{dayLabel(day)}</time>
                            {day === today && <span className="ml-8 text-xs font-semibold text-accent">Today</span>}
                          </p>
                          <ul className="mt-5 grid gap-5">
                            {(byDay.get(day) ?? []).map((item) => (
                              <li key={item.post.id}>{chip(item, "agenda")}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-sm text-ink-3">Nothing published or scheduled.</p>
                  )}
                </section>
              );
            })}
          </div>

          <p className="mt-8 text-xs text-ink-3" data-calendar-foot>
            {anyDated ? "" : "Nothing is published or scheduled in the weeks shown. "}
            Every day is a UTC day and every time is UTC. A post sits on the day it is published or scheduled for; archived posts are not shown.
          </p>
        </div>
      </div>

      {/* what is being carried: follows the pointer, and is never in the way of what is underneath */}
      {dragging && (
        <div
          ref={ghost}
          aria-hidden
          data-calendar-ghost
          className="pointer-events-none fixed left-0 top-0 z-[70] max-w-[14rem] rounded border border-accent bg-surface px-8 py-5 text-xs font-medium text-ink shadow-3"
          style={{ transform: `translate(${point.current.x + 13}px, ${point.current.y + 13}px)` }}
        >
          <span className="line-clamp-2 break-words">{dragging.item.post.title}</span>
          <span className="mt-2 block font-normal text-ink-3">
            {dragging.over === null
              ? "Drop on a day, or on “Not scheduled”"
              : dragging.over === TRAY
                ? dragging.item.state === "scheduled"
                  ? "Drop to unschedule"
                  : "Not scheduled"
                : isPastDay(dragging.over, now)
                  ? `${dayShortLabel(dragging.over)}: this day has passed`
                  : dayShortLabel(dragging.over)}
          </span>
        </div>
      )}

      {/* the scrim is a plain translucent black: ::backdrop does not reliably inherit the console's variables */}
      <dialog
        ref={dialog}
        aria-labelledby="calendar-dialog-title"
        data-calendar-dialog
        className="m-auto w-[min(23rem,calc(100vw-1.625rem))] max-w-none rounded-md border border-line bg-surface p-0 text-ink shadow-3 backdrop:bg-[rgb(0_0_0/0.35)]"
        onClose={() => {
          setPending(null);
          setProblem("");
        }}
        onCancel={(e) => {
          // Escape while a save is on its way would leave the outcome nowhere to be said
          if (busy) e.preventDefault();
        }}
      >
        {pending?.kind === "schedule" && (
          <ScheduleForm key={`${pending.item.post.id}:${pending.day}:${pending.time}`} pending={pending} busy={busy} problem={problem} onConfirm={(day, time) => confirmSchedule(pending.item, day, time)} onCancel={cancel} />
        )}
        {pending?.kind === "unschedule" && <UnscheduleForm item={pending.item} busy={busy} problem={problem} onConfirm={() => confirmUnschedule(pending.item)} onCancel={cancel} />}
      </dialog>
    </div>
  );
}
