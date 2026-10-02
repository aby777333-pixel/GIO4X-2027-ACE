"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { LOOK_EVENT, LOOK_KEY, parseLook, readLookRaw } from "@/components/control/look";

/**
 * What the wallboard shows, and what GET /control/wall/feed answers with.
 * Counts and durations only: no name, no address, no subject, no message.
 * Read by src/app/control/(console)/wall/data.ts.
 */
export type WallFeed = {
  ok: true;
  /** the database's clock when command_summary() counted (ISO, UTC) */
  at: string;
  chats: {
    waiting: number;
    active: number;
    staffOnline: number;
    /** whether the website's chat is switched on in Configuration */
    enabled: boolean;
    /** how long the longest-waiting chat has waited; null when nobody waits or the caller may not read chats */
    longestWaitSeconds: number | null;
    /** conversations started in the 24 hours before `at`; null when the caller may not read chats */
    last24h: number | null;
  };
  tickets: {
    /** open, with no first reply yet */
    unanswered: number;
    /** of those, past the internal first-reply target for their priority */
    late: number;
    /** how far past its target the most overdue ticket is; null when none is late or the caller may not read tickets */
    oldestLateHours: number | null;
    /** tickets opened in the 24 hours before `at`; null when the caller may not read tickets */
    last24h: number | null;
  };
  leads: { unassigned: number; last24h: number };
  followUps: { overdue: number };
  incidentsOpen: number;
};

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isCountOrNull = (v: unknown): v is number | null => v === null || isCount(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The answer is printed as figures, so its shape is checked before it is believed: anything else is "not updating", never zeros. */
export function isWallFeed(value: unknown): value is WallFeed {
  if (!isRecord(value) || value.ok !== true || typeof value.at !== "string" || Number.isNaN(Date.parse(value.at))) return false;
  const { chats, tickets, leads, followUps } = value;
  return (
    isRecord(chats) &&
    isCount(chats.waiting) &&
    isCount(chats.active) &&
    isCount(chats.staffOnline) &&
    typeof chats.enabled === "boolean" &&
    isCountOrNull(chats.longestWaitSeconds) &&
    isCountOrNull(chats.last24h) &&
    isRecord(tickets) &&
    isCount(tickets.unanswered) &&
    isCount(tickets.late) &&
    isCountOrNull(tickets.oldestLateHours) &&
    isCountOrNull(tickets.last24h) &&
    isRecord(leads) &&
    isCount(leads.unassigned) &&
    isCount(leads.last24h) &&
    isRecord(followUps) &&
    isCount(followUps.overdue) &&
    isCount(value.incidentsOpen)
  );
}

export type WallViewProps = {
  /** what the page read on the server; null when the database did not answer */
  initial: WallFeed | null;
  /** how often the board asks again while its tab is visible */
  intervalMs?: number;
};

const FEED_PATH = "/control/wall/feed";

/** A length of time in words a person can read from across a room. */
function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

/** hh:mm:ss in UTC, cut from the ISO form so the server and the browser print the same thing. */
function utcClock(iso: string, seconds = true): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toISOString().slice(11, seconds ? 19 : 16);
}

// Type that fills the board whatever its size: container units on a wide screen (the board is a size
// container from `lg`), and the small viewport units they fall back to on a phone, where it is not.
const SIZE = {
  title: "clamp(1.125rem, min(2cqw, 3.6cqh), 2.5rem)",
  clock: "clamp(1.375rem, min(2.8cqw, 5cqh), 3.5rem)",
  label: "clamp(0.8125rem, min(1.7cqw, 2.8cqh), 1.875rem)",
  value: "clamp(2.75rem, min(11cqw, 17cqh), 14rem)",
  part: "clamp(2rem, min(6.5cqw, 10.5cqh), 8.5rem)",
  detail: "clamp(0.75rem, min(1.35cqw, 2.3cqh), 1.5rem)",
  foot: "clamp(0.75rem, min(1cqw, 1.9cqh), 1.25rem)",
} as const;
const size = (key: keyof typeof SIZE): CSSProperties => ({ fontSize: SIZE[key] });

/** The six single figures, by tile: what is compared between two refreshes. */
type TileKey = "waiting" | "unanswered" | "unassigned" | "overdue" | "present" | "incidents";
const figures = (f: WallFeed): Record<TileKey, number> => ({
  waiting: f.chats.waiting,
  unanswered: f.tickets.unanswered,
  unassigned: f.leads.unassigned,
  overdue: f.followUps.overdue,
  present: f.chats.staffOnline,
  incidents: f.incidentsOpen,
});

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

/** Whether this person has asked for less motion, through the system or the site's own display settings. */
function reducedMotion(): boolean {
  try {
    const root = document.documentElement;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduced" || root.dataset.effects === "low";
  } catch {
    return true;
  }
}

/** The time, in UTC and where the viewer is. Its own component, so that only it is redrawn as the clock moves. */
function Clock() {
  // unknown until the browser has started: the server's clock and zone are not the viewer's
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  let local = "–";
  let zone = "";
  if (now) {
    try {
      const format = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      local = format.format(now);
      zone = format.resolvedOptions().timeZone ?? "";
    } catch {
      local = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
  }

  return (
    <div className="num flex flex-wrap items-baseline gap-x-21 gap-y-3 text-ink" style={size("clock")}>
      <p className="whitespace-nowrap font-semibold">
        {now ? utcClock(now.toISOString(), false) : "–"} <span className="font-sans font-medium text-ink-3" style={size("detail")}>UTC</span>
      </p>
      <p className="whitespace-nowrap font-semibold">
        {local}{" "}
        <span className="font-sans font-medium text-ink-3" style={size("detail")}>
          here{zone ? ` (${zone.replace(/_/g, " ")})` : ""}
        </span>
      </p>
    </div>
  );
}

function Tile({ label, value, was, tick, alert = false, wide = false, children }: { label: string; value?: number; was?: number; tick?: boolean; alert?: boolean; wide?: boolean; children?: ReactNode }) {
  return (
    <div
      data-tick={tick ? "" : undefined}
      className={`flex min-h-0 min-w-0 flex-col justify-between gap-5 rounded-[16px] border p-13 transition-colors duration-700 motion-reduce:transition-none lg:p-[min(1.6cqw,2.8cqh)] ${
        // two columns on a phone: the wide tile goes last there, so that it leaves no hole beside a single one
        wide ? "order-last col-span-2 lg:order-none" : ""
      } ${
        alert ? "border-neg" : "border-line"
      } ${tick ? "bg-[color-mix(in_srgb,var(--gxc-tint)_26%,var(--surface))]" : "bg-surface"}`}
    >
      <dt className="font-semibold leading-tight text-ink-2" style={size("label")}>
        {label}
      </dt>
      <dd className="min-w-0">
        {/* four digits would not fit a tile at the full size: they are set a step smaller */}
        {value !== undefined && (
          <p className="num font-bold leading-none text-ink" style={size(value >= 1000 ? "part" : "value")}>
            {value}
          </p>
        )}
        <div className="mt-5 leading-snug text-ink-3" style={size("detail")}>
          {children}
          {/* the figure before this refresh, in words: the change is not carried by the flash alone */}
          {was !== undefined && <p className="num">Was {was} at the last refresh</p>}
        </div>
      </dd>
    </div>
  );
}

/** One of the three figures of "the last 24 hours". A figure the caller's role may not read is said to be so, never shown as zero. */
function Part({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <p className="num font-bold leading-none text-ink" style={size("part")}>
        {value === null ? <span aria-hidden>–</span> : value}
        {value === null && <span className="sr-only">Not available to your role</span>}
      </p>
      <p className="mt-3 truncate text-ink-3" style={size("detail")}>
        {label}
      </p>
    </div>
  );
}

/**
 * The wallboard: one screen of counts for a television on the wall.
 *
 * It starts from what the page read on the server and then asks the feed again
 * every twenty seconds, never while its tab is hidden. Every figure is counted
 * by the database at that moment (command_summary and tickets_overdue, and two
 * counts of the last 24 hours); zero is shown as zero; a refresh that fails is
 * said plainly ("Not updating") and the figures already shown keep the time
 * they were counted at, so a stale board cannot pass for a current one.
 *
 * Only counts: it is made for a shared screen, so it shows no customer's name
 * and no address, and the feed carries none.
 *
 * The board is always dark, in the palette the person chose: it is a nested
 * console root with the dark mode named on it (console.css keys the colours on
 * these attributes). "Full screen" puts the board itself in the browser's full
 * screen, which leaves the sidebar behind.
 */
export function WallView({ initial, intervalMs = 20_000 }: WallViewProps) {
  const [feed, setFeed] = useState<WallFeed | null>(initial);
  const [was, setWas] = useState<Partial<Record<TileKey, number>>>({});
  const [tick, setTick] = useState(false);
  const [stale, setStale] = useState<"" | "failed" | "ended" | "forbidden">("");
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const shown = useRef<WallFeed | null>(initial);
  const tickTimer = useRef<number | null>(null);
  const { palette } = parseLook(useSyncExternalStore(subscribeLook, readLookRaw, serverLook));

  const accept = useCallback((next: WallFeed) => {
    const before = shown.current;
    shown.current = next;
    setFeed(next);
    setStale("");
    const changed: Partial<Record<TileKey, number>> = {};
    if (before) {
      const a = figures(before);
      const b = figures(next);
      for (const key of Object.keys(a) as TileKey[]) if (a[key] !== b[key]) changed[key] = a[key];
    }
    setWas(changed);
    if (Object.keys(changed).length > 0 && !reducedMotion()) {
      setTick(true);
      if (tickTimer.current !== null) window.clearTimeout(tickTimer.current);
      tickTimer.current = window.setTimeout(() => setTick(false), 1600);
    }
  }, []);

  useEffect(() => {
    let ctrl: AbortController | null = null;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      ctrl?.abort();
      const mine = new AbortController();
      ctrl = mine;
      // `manual`: a signed-out request is answered with a redirect to the sign-in page, which must not be followed and read as figures
      fetch(FEED_PATH, { cache: "no-store", credentials: "same-origin", redirect: "manual", headers: { Accept: "application/json" }, signal: mine.signal })
        .then(async (r) => {
          if (r.type === "opaqueredirect" || r.status === 401) return setStale("ended");
          if (r.status === 403) return setStale("forbidden");
          const body: unknown = r.ok ? await r.json() : null;
          if (isWallFeed(body)) accept(body);
          else setStale("failed");
        })
        .catch(() => {
          if (!mine.signal.aborted) setStale("failed");
        });
    };
    const timer = window.setInterval(refresh, intervalMs);
    // back in view after being hidden: ask at once rather than show old figures for up to twenty seconds
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      ctrl?.abort();
    };
  }, [accept, intervalMs]);

  useEffect(
    () => () => {
      if (tickTimer.current !== null) window.clearTimeout(tickTimer.current);
    },
    [],
  );

  useEffect(() => {
    setCanFull(document.fullscreenEnabled === true);
    const onChange = () => setFull(document.fullscreenElement !== null && document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = () => {
    // either can be refused by the browser; the board then simply stays as it is
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void boardRef.current?.requestFullscreen().catch(() => undefined);
  };

  const seconds = Math.round(intervalMs / 1000);

  return (
    <div
      ref={boardRef}
      className="gx-console flex min-w-0 flex-col gap-13 rounded-[16px] p-13 lg:h-[calc(100dvh-7.6875rem)] lg:min-h-[27rem] lg:gap-[min(1.2cqw,2.1cqh)] lg:p-[min(1.6cqw,2.8cqh)] lg:[container-type:size] [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none"
      data-gxc-theme="dark"
      data-gxc-palette={palette}
      data-wall={stale ? "stale" : "current"}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-21 gap-y-8">
        <h1 className="font-bold leading-tight text-ink" style={size("title")}>
          Wallboard
        </h1>
        <div className="flex flex-wrap items-center gap-x-21 gap-y-8">
          <Clock />
          {canFull && (
            <button type="button" className="btn btn-ghost" aria-pressed={full} onClick={toggleFull}>
              {full ? "Leave full screen" : "Full screen"}
            </button>
          )}
          {!full && (
            <Link href="/control/command" className="btn btn-ghost">
              Command Centre
            </Link>
          )}
        </div>
      </header>

      {!feed ? (
        <div className="grid flex-1 place-items-center rounded-[16px] border border-line bg-surface p-21 text-center">
          <div role="alert">
            <p className="font-semibold text-ink" style={size("label")}>
              The figures could not be read
            </p>
            <p className="mt-5 text-ink-2" style={size("detail")}>
              The database did not answer. The board asks again every {seconds} seconds.
            </p>
          </div>
        </div>
      ) : (
        <dl className="grid min-h-0 flex-1 grid-cols-2 gap-8 lg:grid-cols-4 lg:grid-rows-2 lg:gap-[min(1cqw,1.8cqh)]">
          <Tile label="Chats waiting" value={feed.chats.waiting} was={was.waiting} tick={tick && was.waiting !== undefined}>
            <p>{feed.chats.waiting === 0 ? "Nobody is waiting" : feed.chats.longestWaitSeconds === null ? "Longest wait not available" : `Longest wait: ${duration(feed.chats.longestWaitSeconds)}`}</p>
            <p className="num">{feed.chats.active} in conversation</p>
          </Tile>
          <Tile label="Tickets awaiting a first reply" value={feed.tickets.unanswered} was={was.unanswered} tick={tick && was.unanswered !== undefined} alert={feed.tickets.late > 0}>
            {/* the target is the team's own, by priority; it is never a promise made to a customer */}
            <p className={feed.tickets.late > 0 ? "num font-semibold text-neg" : "num"}>{feed.tickets.late} late against the internal target</p>
            {feed.tickets.late > 0 && feed.tickets.oldestLateHours !== null && <p>Longest overdue: {duration(feed.tickets.oldestLateHours * 3600)}</p>}
          </Tile>
          <Tile label="New enquiries with no owner" value={feed.leads.unassigned} was={was.unassigned} tick={tick && was.unassigned !== undefined} />
          <Tile label="Follow-ups overdue" value={feed.followUps.overdue} was={was.overdue} tick={tick && was.overdue !== undefined} />

          <Tile label="Staff present for chat" value={feed.chats.staffOnline} was={was.present} tick={tick && was.present !== undefined}>
            <p>Website chat is switched {feed.chats.enabled ? "on" : "off"}</p>
          </Tile>
          <Tile label="Last 24 hours" wide>
            <div className="grid grid-cols-3 gap-8">
              <Part label="Enquiries" value={feed.leads.last24h} />
              <Part label="Tickets" value={feed.tickets.last24h} />
              <Part label="Chats" value={feed.chats.last24h} />
            </div>
          </Tile>
          <Tile label="Open incidents" value={feed.incidentsOpen} was={was.incidents} tick={tick && was.incidents !== undefined} />
        </dl>
      )}

      <footer className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 text-ink-3" style={size("foot")}>
        <div role="status" className="min-w-0">
          {stale ? (
            <p className="text-ink">
              <span className="mr-8 inline-block rounded-full border border-neg px-8 font-semibold text-neg">Not updating</span>
              {stale === "ended" ? (
                <>
                  Your session has ended.{" "}
                  <Link href="/control/sign-in" className="link">
                    Sign in again
                  </Link>
                  .
                </>
              ) : stale === "forbidden" ? (
                "Your role no longer includes the wallboard."
              ) : (
                `The last refresh failed. It is tried again every ${seconds} seconds.`
              )}{" "}
              {feed && <span className="num">The figures are as of {utcClock(feed.at)} UTC.</span>}
            </p>
          ) : feed ? (
            <p>
              <span className="num">As of {utcClock(feed.at)} UTC.</span> Counted again every {seconds} seconds while this tab is visible.
            </p>
          ) : null}
        </div>
        <p className="min-w-0">Counts only: no names and no addresses, because this board is made for a shared screen.</p>
      </footer>
    </div>
  );
}
