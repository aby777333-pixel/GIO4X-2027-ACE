"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Notice } from "@/components/control/bits";

/**
 * A board: columns of cards, where a card can be moved to another column.
 *
 * Two equal ways to move a card, and neither needs the other:
 *   · drag it. Pointer events only, so a mouse, a pen and a finger behave the
 *     same way and none of the HTML5 drag-and-drop quirks apply. With a mouse
 *     or pen the drag starts once the pointer has travelled a few pixels; with
 *     a finger it starts after a press of about a third of a second, so that a
 *     swipe still scrolls the page. Escape, or letting go outside a column,
 *     cancels.
 *   · its "Move to" button, which opens the list of the other columns as
 *     ordinary buttons. Keyboard, switch and screen-reader users move cards
 *     with that, and so can anyone who prefers not to drag.
 *
 * A move is shown at once and saved in the background. If the server refuses,
 * the card goes back where it was and a plain sentence says so. When a column
 * needs something first (a lost enquiry needs a reason) the question is asked
 * BEFORE anything is shown as moved or sent.
 *
 * The board owns no data rules: the caller supplies `move` (a server action
 * answering with a fixed code) and `more` (a column again with a larger
 * limit). People who may not change anything get `writable={false}`: the same
 * cards, no drag and no menus.
 */

export type BoardItem = { id: string; reference: string };

export type BoardColumnData<C extends BoardItem> = { key: string; label: string; note?: string; count: number; cards: C[] };

/** A question one column asks before a card may enter it. */
export type BoardAsk = {
  column: string;
  title: (reference: string) => string;
  label: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  confirm: string;
};

export type BoardProps<C extends BoardItem> = {
  /** names the board for assistive technology, for example "Pipeline" */
  label: string;
  columns: BoardColumnData<C>[];
  writable: boolean;
  /** from which breakpoint the columns sit side by side without scrolling; below it they are a rail */
  wide: "lg" | "xl";
  renderCard: (card: C) => ReactNode;
  /** the card as it is once it sits in `column` */
  place: (card: C, column: string) => C;
  compare: (a: C, b: C) => number;
  /** saves the move; "ok" or a refusal code */
  move: (card: C, to: string, extra: string | null) => Promise<string>;
  /** a refusal code as a sentence */
  explain: (code: string) => string;
  ask?: BoardAsk;
  /** the column again with up to `limit` cards, or null when it could not be read */
  more: (column: string, limit: number) => Promise<{ count: number; cards: C[] } | null>;
  step: number;
  max: number;
  /** where the whole column can be read as a list */
  allHref: (column: string) => string;
  emptyText: string;
};

const WIDE = {
  lg: { rail: "lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0", column: "lg:w-auto" },
  xl: { rail: "xl:grid xl:grid-cols-6 xl:overflow-visible xl:pb-0", column: "xl:w-auto" },
} as const;

/** how far a mouse or pen travels before a press becomes a drag */
const DRAG_SLOP = 6;
/** how far a finger may wander during the long press before it is taken for a scroll */
const TOUCH_SLOP = 10;
const LONG_PRESS_MS = 350;

type Drag<C> = {
  card: C;
  from: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** where inside the card the pointer took hold */
  offX: number;
  offY: number;
  width: number;
  active: boolean;
  timer: number | null;
  raf: number | null;
};

function shift<C extends BoardItem>(cols: BoardColumnData<C>[], card: C, from: string, to: string, compare: (a: C, b: C) => number): BoardColumnData<C>[] {
  return cols.map((col) => {
    if (col.key === from) return { ...col, count: Math.max(0, col.count - 1), cards: col.cards.filter((c) => c.id !== card.id) };
    if (col.key === to) return { ...col, count: col.count + 1, cards: [...col.cards.filter((c) => c.id !== card.id), card].sort(compare) };
    return col;
  });
}

export function Board<C extends BoardItem>({ label, columns, writable, wide, renderCard, place, compare, move, explain, ask, more, step, max, allHref, emptyText }: BoardProps<C>) {
  const uid = useId();
  const [cols, setCols] = useState(columns);
  // fresh data from the server (a reload, a navigation) replaces what is on screen
  const [seen, setSeen] = useState(columns);
  if (seen !== columns) {
    setSeen(columns);
    setCols(columns);
  }

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  /** read out politely: what just happened */
  const [said, setSaid] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ card: C; from: string; to: string } | null>(null);
  const [ghost, setGhost] = useState<{ card: C; width: number; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [moreFailed, setMoreFailed] = useState<string | null>(null);

  const root = useRef<HTMLDivElement | null>(null);
  const rail = useRef<HTMLDivElement | null>(null);
  const ghostEl = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag<C> | null>(null);
  const overKey = useRef<string | null>(null);
  /** the card whose "Move to" button takes focus once the board has redrawn */
  const focusNext = useRef<string | null>(null);

  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
  const menuButtonId = (id: string) => `${uid}-move-${id}`;

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(`${uid}-move-${id}`)?.focus();
  });

  /* ---- saving a move ----------------------------------------------------- */

  const commit = async (card: C, from: string, to: string, extra: string | null) => {
    const moved = place(card, to);
    setPending((p) => new Set(p).add(card.id));
    setProblem(null);
    setCols((c) => shift(c, moved, from, to, compare));
    setSaid(`${card.reference} moved to ${labelOf(to)}. Saving.`);

    let code: string;
    try {
      code = await move(card, to, extra);
    } catch {
      code = "network";
    }

    setPending((p) => {
      const next = new Set(p);
      next.delete(card.id);
      return next;
    });
    if (code === "ok") {
      setSaid(`${card.reference} is now in ${labelOf(to)}.`);
    } else {
      // back where it was, in the order the column keeps
      setCols((c) => shift(c, card, to, from, compare));
      setSaid("");
      setProblem(`${card.reference} was not moved. ${explain(code)} It is back in ${labelOf(from)}.`);
    }
  };

  const request = (card: C, from: string, to: string) => {
    if (!writable || from === to || pending.has(card.id)) return;
    if (ask && to === ask.column) {
      // nothing is shown as moved, and nothing is sent, until the question is answered
      setAsking({ card, from, to });
      return;
    }
    void commit(card, from, to, null);
  };
  // the window listeners below outlive a render: they call whatever `request` is current
  const requestRef = useRef(request);
  requestRef.current = request;

  /* ---- dragging ------------------------------------------------------------ */

  const placeGhost = useCallback(() => {
    const d = drag.current;
    if (d && ghostEl.current) ghostEl.current.style.transform = `translate3d(${Math.round(d.x - d.offX)}px, ${Math.round(d.y - d.offY)}px, 0)`;
  }, []);

  const hit = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const under = document.elementFromPoint(d.x, d.y);
    const col = under instanceof Element ? under.closest<HTMLElement>("[data-board-col]") : null;
    const key = col && root.current?.contains(col) ? (col.dataset.boardCol ?? null) : null;
    if (key !== overKey.current) {
      overKey.current = key;
      setOver(key);
    }
  }, []);

  // while a card is held near an edge, the rail and the page scroll under it
  const tick = useCallback(() => {
    const d = drag.current;
    if (!d || !d.active) return;
    const r = rail.current;
    if (r && r.scrollWidth > r.clientWidth + 1) {
      const box = r.getBoundingClientRect();
      if (d.x < box.left + 48) r.scrollLeft -= 12;
      else if (d.x > box.right - 48) r.scrollLeft += 12;
    }
    if (d.y < 64) window.scrollBy(0, -12);
    else if (d.y > window.innerHeight - 64) window.scrollBy(0, 12);
    hit();
    d.raf = window.requestAnimationFrame(tick);
  }, [hit]);

  const activate = useCallback(() => {
    const d = drag.current;
    if (!d || d.active) return;
    d.active = true;
    d.timer = null;
    document.body.style.userSelect = "none";
    window.getSelection()?.removeAllRanges();
    setMenu(null);
    setGhost({ card: d.card, width: d.width, from: d.from });
    setSaid(`${d.card.reference} picked up. Let go over a column to move it there, or press Escape to cancel.`);
    hit();
    d.raf = window.requestAnimationFrame(tick);
  }, [hit, tick]);

  // one object, so that the same functions can be removed again
  const listeners = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void; key: (e: KeyboardEvent) => void; context: (e: Event) => void } | null>(null);

  const finish = useCallback((drop: boolean) => {
    const d = drag.current;
    drag.current = null;
    const l = listeners.current;
    if (l) {
      window.removeEventListener("pointermove", l.move);
      window.removeEventListener("pointerup", l.up);
      window.removeEventListener("pointercancel", l.cancel);
      window.removeEventListener("keydown", l.key, true);
      window.removeEventListener("contextmenu", l.context, true);
    }
    if (!d) return;
    if (d.timer !== null) window.clearTimeout(d.timer);
    if (d.raf !== null) window.cancelAnimationFrame(d.raf);
    if (!d.active) return;

    document.body.style.userSelect = "";
    const target = overKey.current;
    overKey.current = null;
    setGhost(null);
    setOver(null);
    // the release of a drag is not a click on whatever is under the pointer
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, true), 80);

    if (drop && target && target !== d.from) requestRef.current(d.card, d.from, target);
    else setSaid(`${d.card.reference} was put back.`);
  }, []);

  if (!listeners.current) {
    listeners.current = {
      move: (e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.pointerId) return;
        d.x = e.clientX;
        d.y = e.clientY;
        if (!d.active) {
          const far = Math.hypot(d.x - d.startX, d.y - d.startY);
          if (d.touch) {
            // the finger moved before the long press finished: this is a scroll
            if (far > TOUCH_SLOP) finish(false);
          } else if (far > DRAG_SLOP) {
            activate();
          }
          return;
        }
        placeGhost();
        hit();
      },
      up: (e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.pointerId) return;
        d.x = e.clientX;
        d.y = e.clientY;
        if (d.active) hit();
        finish(true);
      },
      cancel: (e) => {
        if (drag.current && e.pointerId === drag.current.pointerId) finish(false);
      },
      key: (e) => {
        if (e.key === "Escape" && drag.current?.active) {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      },
      // a long press must not open the browser's own menu over the card
      context: (e) => {
        if (drag.current?.touch) e.preventDefault();
      },
    };
  }

  const down = (e: ReactPointerEvent<HTMLLIElement>, card: C, from: string) => {
    if (!writable || drag.current || !e.isPrimary || pending.has(card.id)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // the card's own controls keep their ordinary behaviour
    if (e.target instanceof Element && e.target.closest("button, select, input, textarea, [data-board-nodrag]")) return;
    const l = listeners.current;
    if (!l) return;
    const box = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType === "touch";
    drag.current = {
      card,
      from,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offX: e.clientX - box.left,
      offY: e.clientY - box.top,
      width: box.width,
      active: false,
      timer: touch ? window.setTimeout(activate, LONG_PRESS_MS) : null,
      raf: null,
    };
    window.addEventListener("pointermove", l.move);
    window.addEventListener("pointerup", l.up);
    window.addEventListener("pointercancel", l.cancel);
    window.addEventListener("keydown", l.key, true);
    window.addEventListener("contextmenu", l.context, true);
  };

  // the ghost exists one render after the drag starts: put it under the pointer then
  useEffect(() => {
    if (ghost) placeGhost();
  }, [ghost, placeGhost]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Once a finger holds a card, its movement must not scroll the page. Only
    // a touchmove listener that is not passive can say so, and it has to be
    // in place before the touch begins.
    const block = (e: TouchEvent) => {
      if (drag.current?.active && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => {
      el.removeEventListener("touchmove", block);
      finish(false);
    };
  }, [finish]);

  /* ---- more cards ---------------------------------------------------------- */

  const showMore = async (col: BoardColumnData<C>) => {
    setLoading(col.key);
    setMoreFailed(null);
    let answer: { count: number; cards: C[] } | null = null;
    try {
      answer = await more(col.key, Math.min(col.cards.length + step, max));
    } catch {
      answer = null;
    }
    setLoading(null);
    if (!answer) {
      setMoreFailed(col.key);
      return;
    }
    const fresh = answer;
    setCols((current) => {
      // a card this board already shows in another column stays there
      const elsewhere = new Set(current.filter((c) => c.key !== col.key).flatMap((c) => c.cards.map((card) => card.id)));
      const fromServer = fresh.cards.filter((card) => !elsewhere.has(card.id));
      const known = new Set(fromServer.map((card) => card.id));
      return current.map((c) => (c.key === col.key ? { ...c, count: fresh.count, cards: [...fromServer, ...c.cards.filter((card) => !known.has(card.id))].sort(compare) } : c));
    });
    setSaid(`More of ${col.label} loaded.`);
  };

  /* ---- drawing ------------------------------------------------------------- */

  const total = (col: BoardColumnData<C>) => `${col.count} in ${col.label}`;

  return (
    <div ref={root} role="group" aria-label={`${label} board`}>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>

      {problem && (
        <div className="mb-13">
          <Notice title="The move was not saved" tone="error">
            <p>{problem}</p>
            <p className="mt-8">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProblem(null)}>
                Dismiss
              </button>
            </p>
          </Notice>
        </div>
      )}

      {/* .scroll-x is also the containing block for the cards' visually hidden labels, so they scroll with the rail instead of widening the page */}
      <div ref={rail} className={`scroll-x flex gap-13 pb-13 ${ghost ? "" : "snap-x"} ${WIDE[wide].rail}`}>
        {cols.map((col) => {
          // a column the held card could be dropped into (its own column is not one)
          const isTarget = !!ghost && over === col.key && ghost.from !== col.key;
          const others = cols.filter((c) => c.key !== col.key);
          return (
            <section
              key={col.key}
              data-board-col={col.key}
              aria-labelledby={`${uid}-h-${col.key}`}
              className={`gxc-card flex w-[17rem] min-w-0 shrink-0 snap-start flex-col p-13 ${WIDE[wide].column} ${isTarget ? "outline-dashed outline-2 -outline-offset-2 outline-accent" : ""}`}
            >
              <div className="border-b border-line pb-8">
                <div className="flex items-baseline justify-between gap-8">
                  <h2 id={`${uid}-h-${col.key}`} className="label">
                    {col.label}
                  </h2>
                  <span className="num text-sm font-medium text-ink" data-board-count={col.key} title={total(col)}>
                    <span className="sr-only">{total(col)}: </span>
                    <span aria-hidden>{col.count}</span>
                  </span>
                </div>
                {/* room for two lines, so the first cards of neighbouring columns start level */}
                {col.note && <p className="mt-3 min-h-[2.25rem] text-xs text-ink-3">{col.note}</p>}
              </div>

              {isTarget && <p className="mt-8 text-xs font-semibold text-accent">Let go to move it to {col.label}</p>}

              {col.cards.length ? (
                <ul className="mt-8 grid gap-8">
                  {col.cards.map((card) => {
                    const busy = pending.has(card.id);
                    const held = ghost?.card.id === card.id;
                    const open = menu === card.id;
                    return (
                      <li
                        key={card.id}
                        data-board-card={card.id}
                        aria-busy={busy || undefined}
                        onPointerDown={writable ? (e) => down(e, card, col.key) : undefined}
                        onDragStart={(e) => e.preventDefault()}
                        style={writable ? { WebkitTouchCallout: "none" } : undefined}
                        className={`min-w-0 rounded-[12px] border border-line bg-surface p-13 ${writable ? "cursor-grab select-none" : ""} ${held ? "opacity-40" : busy ? "opacity-70" : ""}`}
                      >
                        {renderCard(card)}

                        {writable && (
                          <div
                            className="mt-8 border-t border-line pt-8"
                            onKeyDown={(e) => {
                              if (e.key === "Escape" && open) {
                                e.stopPropagation();
                                setMenu(null);
                                focusNext.current = card.id;
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-8">
                              {/* six dots: this card can be dragged. Decoration; the button beside it does the same job. */}
                              <svg aria-hidden viewBox="0 0 10 16" width="10" height="16" className="shrink-0 text-ink-3">
                                {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" fill="currentColor" />))}
                              </svg>
                              <button
                                type="button"
                                id={menuButtonId(card.id)}
                                className="btn btn-ghost btn-sm min-h-[2.125rem]"
                                aria-expanded={open}
                                aria-controls={`${uid}-menu-${card.id}`}
                                // not `disabled`: focus has to be able to follow the card while its move is being saved
                                aria-disabled={busy || undefined}
                                onClick={() => {
                                  if (!busy) setMenu(open ? null : card.id);
                                }}
                              >
                                {busy ? "Saving…" : "Move to…"}
                                <span className="sr-only"> ({card.reference})</span>
                              </button>
                            </div>
                            <div id={`${uid}-menu-${card.id}`} hidden={!open}>
                              {open && (
                                <ul className="mt-8 grid gap-5" aria-label={`Move ${card.reference} to`}>
                                  {others.map((to) => (
                                    <li key={to.key}>
                                      <button
                                        type="button"
                                        className="btn btn-quiet btn-sm min-h-[2.125rem] w-full justify-start"
                                        onClick={() => {
                                          setMenu(null);
                                          focusNext.current = card.id;
                                          request(card, col.key, to.key);
                                        }}
                                      >
                                        {to.label}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-8 py-13 text-xs text-ink-3">{emptyText}</p>
              )}

              {col.count > col.cards.length && (
                <div className="mt-13 grid justify-items-start gap-8">
                  {col.cards.length < max && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={loading !== null || pending.size > 0} onClick={() => void showMore(col)}>
                      {loading === col.key ? "Loading…" : "Show more"}
                      <span className="sr-only"> of {col.label}</span>
                    </button>
                  )}
                  {moreFailed === col.key && (
                    <p role="alert" className="text-xs text-neg">
                      More could not be loaded. Reload the page and try again.
                    </p>
                  )}
                  <Link href={allHref(col.key)} className="go text-xs" draggable={false}>
                    All {col.count} as a list
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {ghost && (
        <div ref={ghostEl} aria-hidden className="pointer-events-none fixed left-0 top-0 z-overlay rounded-[12px] border border-line-strong bg-surface p-13 shadow-3" style={{ width: ghost.width }}>
          {renderCard(ghost.card)}
        </div>
      )}

      {asking && ask && (
        <AskDialog
          ask={ask}
          reference={asking.card.reference}
          onCancel={() => {
            focusNext.current = asking.card.id;
            setSaid(`${asking.card.reference} was not moved.`);
            setAsking(null);
          }}
          onConfirm={(value) => {
            const { card, from, to } = asking;
            focusNext.current = card.id;
            setAsking(null);
            void commit(card, from, to, value);
          }}
        />
      )}
    </div>
  );
}

/**
 * The question a column asks before a card may enter it, as a modal dialog
 * (the browser's own: focus stays inside it and Escape closes it). Closing it
 * in any way but the confirm button leaves the card where it was.
 */
function AskDialog({ ask, reference, onCancel, onConfirm }: { ask: BoardAsk; reference: string; onCancel: () => void; onConfirm: (value: string) => void }) {
  const uid = useId();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      className="m-auto w-[min(26rem,calc(100vw-2.625rem))] rounded-[16px] border border-line bg-surface p-21 text-ink shadow-3"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ask.options.some((o) => o.value === value)) onConfirm(value);
        }}
      >
        <h2 id={`${uid}-title`} className="h4">
          {ask.title(reference)}
        </h2>
        <div className="field mt-13">
          <label htmlFor={`${uid}-value`}>{ask.label}</label>
          <select id={`${uid}-value`} className="select" value={value} onChange={(e) => setValue(e.target.value)} required>
            <option value="">{ask.placeholder}</option>
            {ask.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-8 text-xs text-ink-3">Nothing is saved until you confirm. Cancel leaves {reference} where it is.</p>
        <div className="mt-21 flex flex-wrap gap-8">
          <button type="submit" className="btn btn-primary" disabled={!value}>
            {ask.confirm}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
