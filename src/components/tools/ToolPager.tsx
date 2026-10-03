import Link from "next/link";

/**
 * Previous and next tool, as ordinary links: the way through the twelve tools
 * for a keyboard, a mouse and a screen reader, and the visible counterpart of
 * the swipe on a touch screen (SwipeNav). The order is the hub's own.
 */
export type PagerTool = { href: string; name: string };

const SIDE = "flex min-h-[2.75rem] min-w-0 items-center gap-8 text-sm text-ink-2 transition-colors duration-fast hover:text-accent";

export function ToolPager({ prev, next, index, total, foot = false }: { prev: PagerTool | null; next: PagerTool | null; index: number; total: number; foot?: boolean }) {
  return (
    <nav aria-label={foot ? "Previous and next tool, repeated" : "Previous and next tool"} className={`wrap ${foot ? "pb-34" : "pt-21"}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-13 border-y border-line py-5">
        {prev ? (
          <Link href={prev.href} rel="prev" className={SIDE}>
            <span aria-hidden>←</span>
            <span className="min-w-0 truncate">
              <span className="sr-only">Previous tool: </span>
              <span className="font-medium text-ink">{prev.name}</span>
            </span>
          </Link>
        ) : (
          <Link href="/tools" className={SIDE}>
            <span aria-hidden>←</span> All tools
          </Link>
        )}
        <p className="text-center text-xs text-ink-3">
          <span className="num">{index + 1}</span> of <span className="num">{total}</span>
          {/* said only where a finger is the pointer */}
          {!foot && <span className="hidden [@media(pointer:coarse)]:block">swipe to change tool</span>}
        </p>
        {next ? (
          <Link href={next.href} rel="next" className={`${SIDE} justify-end text-right`}>
            <span className="min-w-0 truncate">
              <span className="sr-only">Next tool: </span>
              <span className="font-medium text-ink">{next.name}</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <Link href="/tools" className={`${SIDE} justify-end text-right`}>
            All tools <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
