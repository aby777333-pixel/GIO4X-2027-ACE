"use client";

import Link from "next/link";
import { useState } from "react";
import { MAX_SAVED, MAX_WATCH, savedKind, toggleSaved, toggleWatch, useSaved, useWatch } from "./store";

/**
 * "Watch" and "Save": the two buttons that put something on My desk.
 *
 * Both write to this browser's local storage only (gx:watch, gx:saved) and
 * only when pressed. Before the page has mounted they render in their "off"
 * state, which is also what the server sends, so the HTML is the same for
 * everyone. The state is carried by the label and aria-pressed, not by colour.
 */

const NOUN: Record<NonNullable<ReturnType<typeof savedKind>>, string> = { article: "article", lesson: "lesson", term: "term", tool: "tool" };

function DeskLink({ show }: { show: boolean }) {
  // offered once, straight after the press that put the first thing on the desk
  if (!show) return null;
  return (
    <Link href="/desk" className="link text-sm">
      Open My desk
    </Link>
  );
}

/** On an instrument page: add the instrument to, or remove it from, the watchlist. `id` is "<class>/<slug>". */
export function WatchButton({ id, symbol, className = "btn btn-ghost" }: { id: string; symbol: string; className?: string }) {
  const watch = useWatch();
  const [pressed, setPressed] = useState(false);
  const on = !!watch?.includes(id);
  const full = !on && (watch?.length ?? 0) >= MAX_WATCH;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={on}
        disabled={full}
        title={full ? `The watchlist holds ${MAX_WATCH} instruments. Remove one on My desk to add another.` : undefined}
        onClick={() => {
          toggleWatch(id);
          setPressed(true);
        }}
      >
        <span aria-hidden>{on ? "✓" : "+"}</span>
        <span>
          {on ? "Watching" : "Watch"}
          <span className="sr-only"> {symbol}</span>
        </span>
      </button>
      <span role="status" className="contents">
        <DeskLink show={pressed && on} />
      </span>
    </>
  );
}

/**
 * On an article, lesson, glossary term or tool: keep the page for later.
 * `href` may be the absolute address of the page; only its path is stored.
 * Renders nothing for a page of a kind the desk does not keep.
 */
export function SaveButton({ href, title, className = "btn btn-ghost btn-sm" }: { href: string; title: string; className?: string }) {
  const saved = useSaved();
  const [pressed, setPressed] = useState(false);
  let path = href;
  if (!href.startsWith("/")) {
    try {
      path = new URL(href).pathname;
    } catch {
      path = "";
    }
  }
  const kind = savedKind(path);
  if (!kind) return null;
  const on = !!saved?.some((s) => s.h === path);
  const full = !on && (saved?.length ?? 0) >= MAX_SAVED;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={on}
        disabled={full}
        title={full ? `My desk holds ${MAX_SAVED} saved pages. Remove one there to save another.` : undefined}
        onClick={() => {
          toggleSaved(path, title);
          setPressed(true);
        }}
      >
        <span aria-hidden>{on ? "✓" : "+"}</span>
        <span>
          {on ? "Saved" : "Save"}
          <span className="sr-only"> this {NOUN[kind]}</span>
        </span>
      </button>
      <span role="status" className="contents">
        <DeskLink show={pressed && on} />
      </span>
    </>
  );
}
