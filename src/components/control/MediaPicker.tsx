"use client";

import { useCallback, useId, useRef, useState } from "react";
import { fmtDateTime } from "@/components/control/format";
import { fmtBytes, fmtImageType, MEDIA_LIST_PATH, type MediaListEntry } from "@/components/control/media-shared";
import { blogImageUrl, isBlogImagePath } from "@/lib/blog";

/** What the writer chose: the path a post stores, and the picture's size in pixels when the browser had read it. */
export type LibraryChoice = { path: string; width: number | null; height: number | null };

type Phase = "idle" | "loading" | "ready" | "error";

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** The route's answer, taken apart without trusting its shape. */
function readAnswer(value: unknown): { items: MediaListEntry[]; more: boolean } | { error: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { ok?: unknown; items?: unknown; more?: unknown; error?: unknown };
  if (v.ok === false && typeof v.error === "string") return { error: v.error };
  if (v.ok !== true || !Array.isArray(v.items)) return null;
  const items: MediaListEntry[] = [];
  for (const raw of v.items as unknown[]) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (!isBlogImagePath(r.path)) continue;
    items.push({
      path: r.path,
      name: str(r.name) ?? r.path,
      size: typeof r.size === "number" && Number.isFinite(r.size) ? r.size : null,
      type: str(r.type),
      uploadedAt: str(r.uploadedAt),
    });
  }
  return { items, more: v.more === true };
}

/**
 * "Choose from the library": a button that opens a small picker of the
 * pictures already in the blog's picture store, newest first, and hands back
 * the one chosen. It reads GET /control/media/list as the signed-in member of
 * staff (blog.read, checked there and by storage); it changes nothing.
 *
 * A native <dialog>: the browser keeps the keyboard inside it, closes it on
 * Escape and returns focus to the button.
 */
export function LibraryButton({
  onChoose,
  label = "Choose from the library",
  className = "btn btn-ghost",
  listPath = MEDIA_LIST_PATH,
}: {
  onChoose: (choice: LibraryChoice) => void;
  label?: string;
  className?: string;
  /** where the list is read from; the default is the console's own route */
  listPath?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<MediaListEntry[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [problem, setProblem] = useState("");

  const load = useCallback(
    async (next: number) => {
      setPhase("loading");
      setProblem("");
      try {
        const response = await fetch(`${listPath}?page=${next}`, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
        const answer = readAnswer(await response.json().catch(() => null));
        if (answer && "items" in answer) {
          setItems((before) => (next === 1 ? answer.items : [...before, ...answer.items.filter((i) => !before.some((b) => b.path === i.path))]));
          setPage(next);
          setMore(answer.more);
          setPhase("ready");
          return;
        }
        setProblem(answer && "error" in answer ? answer.error : "The library could not be read. Close this and try again.");
      } catch {
        setProblem("The library did not answer. Check the connection and try again.");
      }
      setPhase("error");
    },
    [listPath],
  );

  const open = () => {
    const el = dialog.current;
    if (!el || el.open) return;
    el.showModal();
    // read afresh each time it opens: a picture uploaded a moment ago should be there
    setItems([]);
    void load(1);
  };

  const choose = (path: string, img: HTMLImageElement | null) => {
    const loaded = img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    onChoose({ path, width: loaded ? img.naturalWidth : null, height: loaded ? img.naturalHeight : null });
    dialog.current?.close();
  };

  return (
    <>
      <button type="button" className={className} onClick={open} data-library-open>
        {label}
      </button>
      {/* the scrim is a plain translucent black: ::backdrop does not reliably inherit the console's variables */}
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        className="m-auto w-[min(46rem,calc(100vw-1.625rem))] max-w-none rounded-md border border-line bg-surface p-0 text-ink shadow-3 backdrop:bg-[rgb(0_0_0/0.5)]"
        data-library
      >
        <div className="flex max-h-[min(40rem,calc(100dvh-3.25rem))] flex-col">
          <div className="flex items-start justify-between gap-13 border-b border-line px-21 py-13">
            <div className="min-w-0">
              <h2 id={headingId} className="text-sm font-semibold text-ink">
                Choose from the library
              </h2>
              <p className="mt-3 text-xs text-ink-3">Pictures already uploaded to the blog’s picture store, newest first. Choosing one changes nothing until the post is saved.</p>
            </div>
            <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-21 py-13">
            {phase === "error" && (
              <p role="alert" className="text-sm font-medium text-neg" data-library-problem>
                {problem}
              </p>
            )}
            {phase === "loading" && items.length === 0 && (
              <p role="status" className="text-sm text-ink-3">
                Reading the library…
              </p>
            )}
            {phase === "ready" && items.length === 0 && (
              <p className="text-sm text-ink-2" data-library-empty>
                There is no picture in the library yet. Upload one with the button beside this one.
              </p>
            )}
            {items.length > 0 && (
              <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Pictures in the library">
                {items.map((item) => {
                  const url = blogImageUrl(item.path);
                  return (
                    <li key={item.path} className="grid min-w-0">
                      <button
                        type="button"
                        className="grid min-w-0 content-start gap-5 rounded-md border border-line bg-surface p-5 text-left transition-colors duration-fast hover:border-accent"
                        onClick={(e) => choose(item.path, e.currentTarget.querySelector("img"))}
                        data-library-item={item.path}
                      >
                        {url ? (
                          <img src={url} alt="" loading="lazy" decoding="async" className="aspect-[1.618/1] w-full rounded-sm bg-surface-2 object-cover" />
                        ) : (
                          <span className="grid aspect-[1.618/1] w-full place-items-center rounded-sm bg-surface-2 text-xs text-ink-3">No preview</span>
                        )}
                        <span className="num block truncate text-xs text-ink">{item.name}</span>
                        <span className="block text-xs text-ink-3">
                          {fmtImageType(item.type)} · {fmtBytes(item.size)}
                          <span className="num block">{item.uploadedAt ? fmtDateTime(item.uploadedAt) : "Upload time not known"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-8 border-t border-line px-21 py-13">
            <p className="text-xs text-ink-3" role="status">
              {phase === "loading" && items.length > 0 ? "Reading more…" : items.length > 0 ? `${items.length} shown${more ? "" : ": that is all of them"}.` : ""}
            </p>
            {more && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={phase === "loading"} onClick={() => void load(page + 1)} data-library-more>
                Show older pictures
              </button>
            )}
            {phase === "error" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(items.length > 0 ? page + 1 : 1)}>
                Try again
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
