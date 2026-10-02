"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { usePrefs } from "@/hooks/usePrefs";
import { resolveTheme } from "@/lib/prefs";

/**
 * Third-party market panels from TradingView (calendar, heat maps, quotes).
 *
 * The rules, which are also what the site tells its visitors:
 *  - No TradingView script runs on a GIO4X page. TradingView's copy-and-paste
 *    code is a script that builds an iframe; here the iframe is built directly,
 *    at the address that script would have used, so the page itself stays
 *    script-free and the Content-Security-Policy needs no change.
 *  - Nothing is requested from TradingView until the visitor presses the
 *    button, or, if they have switched on "load TradingView panels
 *    automatically" in their preferences, until the panel scrolls into view.
 *  - Every panel carries TradingView's credit and says whose numbers they are.
 *  - Widgets that publish ratings or trade ideas (the technical-analysis gauge,
 *    the screener with its "technical rating" column) are deliberately not in
 *    the list of kinds below. GIO4X publishes no recommendations.
 */

/** The widgets verified to render as a bare frame, by the name in TradingView's embed address. */
export type TradingViewKind =
  | "events"
  | "forex-heat-map"
  | "forex-cross-rates"
  | "stock-heatmap"
  | "crypto-coins-heatmap"
  | "market-overview"
  | "market-quotes"
  | "ticker-tape";

const EMBED_BASE = "https://www.tradingview-widget.com/embed-widget";
const CREDIT_HREF = "https://www.tradingview.com/";

/** Tokens the frame may use: it must run its own script and open TradingView in a new tab, nothing more. */
const SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/**
 * Whether a TradingView frame may load, shared by every panel and the chart.
 * `loaded` turns true on the visitor's click, or, with the standing preference
 * on, when the element holding `ref` first enters the viewport.
 */
export function useTradingViewFrame<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  loaded: boolean;
  load: () => void;
  theme: "light" | "dark";
} {
  const [prefs, , ready] = usePrefs();
  const [asked, setAsked] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef<T>(null);
  const auto = ready && prefs.tvAuto === true;

  useEffect(() => {
    if (!auto || asked || seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [auto, asked, seen]);

  return { ref, loaded: asked || seen, load: () => setAsked(true), theme: resolveTheme(prefs.theme) };
}

export function TradingViewWidget({
  kind,
  title,
  what,
  height,
  mobileHeight,
  settings,
  note,
  minWidth,
  compact = false,
  transparent = true,
  subject = "prices",
  as: Heading = "h3",
  className = "",
}: {
  /** what the caption disclaims: market prices, or calendar dates and figures */
  subject?: "prices" | "calendar";
  kind: TradingViewKind;
  /** the panel's heading */
  title: string;
  /** what will load, as it reads after "Load": "the economic calendar" */
  what: string;
  /** frame height in pixels from the `sm` breakpoint up; fixed, so the page does not move when the frame arrives */
  height: number;
  /** frame height below `sm`; defaults to `height` */
  mobileHeight?: number;
  /** the widget's own settings, as in TradingView's embed code (theme, size and locale are added here) */
  settings?: Record<string, unknown>;
  /** one more sentence for the caption, specific to this panel */
  note?: string;
  /** widest the widget needs to be legible, in pixels: narrower screens scroll the frame sideways */
  minWidth?: number;
  /** for short frames such as the ticker tape: the unloaded state is the button alone */
  compact?: boolean;
  transparent?: boolean;
  as?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const { ref, loaded, load, theme } = useTradingViewFrame<HTMLDivElement>();
  const id = useId();

  const config = { ...settings, colorTheme: theme, isTransparent: transparent, locale: "en", width: "100%", height: "100%" };
  const src = `${EMBED_BASE}/${kind}/?locale=en#${encodeURIComponent(JSON.stringify(config))}`;
  const size = { "--tv-h": `${height}px`, "--tv-hm": `${mobileHeight ?? height}px` } as CSSProperties;

  return (
    <figure className={`panel min-w-0 overflow-hidden ${className}`} aria-labelledby={`${id}-h`} data-tv-widget={kind}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3 border-b border-line px-13 py-8 sm:px-21">
        <Heading id={`${id}-h`} className="text-sm font-semibold text-ink">
          {title}
        </Heading>
        <span className="label">TradingView</span>
      </div>

      <div ref={ref} style={size} className="relative h-[var(--tv-hm)] sm:h-[var(--tv-h)]">
        {loaded ? (
          <div className={minWidth ? "scroll-x h-full overflow-y-hidden" : "h-full"}>
            <iframe
              key={theme}
              src={src}
              title={`${title}, by TradingView`}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox={SANDBOX}
              className="block h-full w-full border-0"
              // TradingView's page declares no colour scheme. On the dark theme the browser would otherwise
              // paint a white sheet behind a frame whose scheme differs from this page's, hiding the panel.
              style={{ colorScheme: "light", minWidth }}
            />
          </div>
        ) : compact ? (
          <div className="absolute inset-0 grid place-items-center px-13">
            <button type="button" className="btn btn-primary h-auto min-h-[2.75rem] whitespace-normal py-5 text-center" onClick={load}>
              Load {what} from TradingView
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            <div aria-hidden className="grid-field absolute inset-0 [mask-image:radial-gradient(80%_80%_at_50%_50%,black,transparent)]" />
            <div className="relative mx-21 max-w-[28rem] text-center">
              <p className="label">Third-party panel</p>
              <p className="mt-8 text-sm text-ink-2">
                This panel is supplied by TradingView and stays unloaded until you ask for it. Loading it connects your browser to TradingView’s servers, which may set their own cookies.
              </p>
              <button type="button" className="btn btn-primary mt-13 h-auto min-h-[2.75rem] whitespace-normal py-5 text-center" onClick={load}>
                Load {what} from TradingView
              </button>
              <p className="mt-8 text-xs text-ink-3">
                <Link href="/preferences#third-party" className="link inline-flex min-h-[2.75rem] items-center md:min-h-0">
                  Load these panels automatically
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-13 gap-y-3 border-t border-line px-13 py-8 text-xs text-ink-3 sm:px-21">
        <span className="chip">Third party</span>
        <span>
          <a href={CREDIT_HREF} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-[2.75rem] items-center md:min-h-0">
            Market data by TradingView
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
        <span className="max-w-measure">
          {/* the short frame has no room for this sentence, so it stands here, the same before and after loading */}
          {compact ? "Supplied by TradingView and loaded only when you ask: loading it connects your browser to TradingView’s servers, which may set their own cookies. " : ""}
          {subject === "calendar"
            ? "The dates, figures and their accuracy are TradingView’s and may be delayed or revised. GIO4X does not compile or verify them, and they are not a forecast by GIO4X."
            : "The data, its timing and its accuracy are TradingView’s and may be delayed. These are not GIO4X prices, and not the prices at which GIO4X executes orders."}
          {note ? ` ${note}` : ""}
        </span>
        <span className="sr-only" aria-live="polite">
          {loaded ? `${title} loaded.` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
