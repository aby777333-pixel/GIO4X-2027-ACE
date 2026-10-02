"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * The announcement line staff publish from GIO4X Control (Configuration).
 *
 * One slim line directly under the fixed header and above the page's night
 * stage, so it wears the same night material in both themes. It is read after
 * first paint through site_public(), which anyone may call and which returns
 * only the three published settings. Until the answer arrives, on any failure,
 * and when the site has no database configured, nothing is rendered and no
 * space is held: the line opens with a short height transition (none when
 * motion is reduced) instead of pushing the page in one step.
 *
 * The text is plain text from the database and is rendered as text. The link
 * is followed only when it is a path on this site.
 */

export type Announcement = { text: string; href: string; tone: "info" | "notice" };

/** Where a dismissal is remembered: this tab, this visit. The value is the line that was dismissed, so a new one is shown. */
export const ANNOUNCEMENT_DISMISSED_KEY = "gx:announcement:dismissed";

const REFRESH_MS = 60_000;

/** A same-site path: one leading slash, no second slash or backslash after it, no whitespace. */
const isSitePath = (href: string) => /^\/(?![/\\])[^\s\\]*$/.test(href);

/** What site_public() returned, reduced to a line worth showing, or null. Nothing here trusts the shape. */
export function readAnnouncement(value: unknown): Announcement | null {
  if (typeof value !== "object" || value === null) return null;
  const a = (value as { announcement?: unknown }).announcement;
  if (typeof a !== "object" || a === null) return null;
  const { enabled, text, href, tone } = a as Record<string, unknown>;
  if (enabled !== true || typeof text !== "string" || !text.trim()) return null;
  return { text: text.trim().slice(0, 200), href: typeof href === "string" && isSitePath(href) ? href : "", tone: tone === "notice" ? "notice" : "info" };
}

// One answer for the page's life, shared by every mount, refreshed at most once a minute.
let cache: { at: number; value: Announcement | null } | null = null;
let inFlight: Promise<Announcement | null> | null = null;

function load(): Promise<Announcement | null> {
  if (cache && Date.now() - cache.at < REFRESH_MS) return Promise.resolve(cache.value);
  if (inFlight) return inFlight;
  const supabase = getBrowserSupabase();
  if (!supabase) return Promise.resolve(null);
  inFlight = (async () => {
    try {
      const { data, error } = await supabase.rpc("site_public");
      // a failure keeps whatever was showing, and is not asked again for a minute
      const value = error ? (cache?.value ?? null) : readAnnouncement(data);
      cache = { at: Date.now(), value };
      return value;
    } catch {
      cache = { at: Date.now(), value: cache?.value ?? null };
      return cache.value;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

const signature = (a: Announcement) => `${a.tone}|${a.href}|${a.text}`;

function wasDismissed(a: Announcement): boolean {
  try {
    return window.sessionStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === signature(a);
  } catch {
    return false;
  }
}

/**
 * The line itself. Presentation only: Control renders the same component as
 * its preview. Without `onDismiss` it is a picture of the line: the link and
 * the close mark are drawn but cannot be used.
 */
export function AnnouncementLine({ announcement, onDismiss }: { announcement: Announcement; onDismiss?: () => void }) {
  const { text, href, tone } = announcement;
  const notice = tone === "notice";
  const link = href && isSitePath(href) ? href : "";
  return (
    <div
      className="on-night border-b border-night-line bg-night-2 text-on-night"
      // a notice is warmer than information: a wash of the night palette's champagne from the left
      style={notice ? { backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--tone-4) 16%, transparent), transparent 61.8%)" } : undefined}
    >
      <div className="wrap flex items-start gap-13">
        <p className="min-w-0 flex-1 py-[0.6875rem] text-sm leading-snug [overflow-wrap:anywhere]">
          {/* the tone is said in words; the mark's shape and colour only repeat it */}
          <span className="mr-13 inline-flex items-center gap-5 whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-[0.1em]" style={{ color: notice ? "var(--tone-4)" : "var(--accent)" }}>
            <span aria-hidden className="h-[0.4375rem] w-[0.4375rem] rounded-full border border-current" style={{ background: notice ? "linear-gradient(90deg, currentColor 50%, transparent 50%)" : "currentColor" }} />
            {notice ? "Notice" : "Announcement"}
          </span>
          <span>{text}</span>
          {link &&
            (onDismiss ? (
              <Link href={link} className="link ml-8 whitespace-nowrap font-medium">
                Read more
              </Link>
            ) : (
              <span className="ml-8 whitespace-nowrap font-medium text-accent">Read more</span>
            ))}
        </p>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="-mr-8 flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded text-on-night-2 transition-colors duration-fast hover:text-on-night" aria-label="Dismiss this announcement">
            <CloseMark />
          </button>
        ) : (
          <span aria-hidden className="-mr-8 flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center text-on-night-2">
            <CloseMark />
          </span>
        )}
      </div>
    </div>
  );
}

function CloseMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function AnnouncementBar() {
  const pathname = usePathname();
  const [shown, setShown] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  // After first paint, and again on a client navigation: load() answers from
  // memory unless the last answer is more than a minute old.
  useEffect(() => {
    let alive = true;
    void load().then((value) => {
      if (!alive) return;
      setShown(value && !wasDismissed(value) ? value : null);
    });
    return () => {
      alive = false;
    };
  }, [pathname]);

  // The line is mounted closed and opened on the next frame, so the height
  // transition runs instead of the page jumping by one line.
  const present = !!shown;
  useEffect(() => {
    if (!present) {
      setOpen(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(raf);
  }, [present]);

  if (!shown) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, signature(shown));
    } catch {
      /* storage unavailable: it is hidden until the next full page load */
    }
    setShown(null);
  };

  return (
    <aside aria-label="Announcement from GIO4X" className={`grid transition-[grid-template-rows] duration-[260ms] ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="min-h-0 overflow-hidden">
        <AnnouncementLine announcement={shown} onDismiss={dismiss} />
      </div>
    </aside>
  );
}
