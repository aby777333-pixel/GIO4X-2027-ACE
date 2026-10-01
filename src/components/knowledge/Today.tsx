"use client";

import { useNow } from "@/hooks/useNow";

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", opts).format(d);

/**
 * Today's date in the visitor's own time zone. The server cannot know it, so
 * the element is empty until the page has mounted: no stale date is ever
 * presented as today's.
 */
export function EditionDate({ className = "" }: { className?: string }) {
  const now = useNow(60_000);
  return (
    <time className={className} dateTime={now ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` : undefined} aria-live="off">
      {now ? fmt(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
    </time>
  );
}

/** "Good morning", "Good afternoon" or "Good evening", by the visitor's clock. */
export function Greeting({ fallback = "Good day" }: { fallback?: string }) {
  const now = useNow(60_000);
  if (!now) return <>{fallback}</>;
  const h = now.getHours();
  return <>{h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}</>;
}

/** The visitor's local time, to the minute, with the zone name. */
export function LocalClock({ className = "" }: { className?: string }) {
  const now = useNow(20_000);
  if (!now) return <span className={className}>--:--</span>;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.replace(/_/g, " ") ?? "local time";
  return (
    <span className={className}>
      <span className="num">{fmt(now, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span> <span className="text-ink-3">{zone}</span>
    </span>
  );
}
