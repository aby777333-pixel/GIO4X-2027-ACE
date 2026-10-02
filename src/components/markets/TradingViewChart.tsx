"use client";

import { useTradingViewFrame } from "@/components/markets/TradingViewWidget";

/**
 * A third-party chart, loaded only when the visitor asks for it.
 *
 * Nothing is requested from TradingView until "Load chart" is pressed (or,
 * if the visitor has chosen to load TradingView panels automatically, until
 * the chart scrolls into view): no script, no cookie, no connection. The
 * iframe is sandboxed, sends no referrer and follows the visitor's current
 * theme. The data inside it is TradingView's, not GIO4X's, and the caption
 * says so.
 */
export function TradingViewChart({ symbol, tv, name }: { symbol: string; tv: string; name: string }) {
  const { ref, loaded, load, theme } = useTradingViewFrame<HTMLDivElement>();
  const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tv)}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&theme=${theme}&style=2&timezone=Etc%2FUTC&locale=en`;

  return (
    <figure className="panel overflow-hidden">
      <div ref={ref} className="relative h-[21rem] sm:h-[26rem] lg:h-[30rem]">
        {loaded ? (
          <iframe
            key={theme}
            src={src}
            title={`${symbol} daily chart by TradingView`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            <div aria-hidden className="grid-field absolute inset-0 [mask-image:radial-gradient(80%_80%_at_50%_50%,black,transparent)]" />
            {/* a neutral study of axes: shape only, deliberately no price path */}
            <svg aria-hidden viewBox="0 0 610 377" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-[var(--viz-stroke)]">
              <path d="M34 21V343H589" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {[89, 144, 233, 288].map((y) => (
                <path key={y} d={`M34 ${y}H589`} stroke="var(--viz-faint)" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <div className="relative mx-21 max-w-[26rem] text-center">
              <p className="label">Third-party chart</p>
              <p className="h4 mt-8">
                {symbol} on a daily chart
              </p>
              <p className="mt-8 text-sm text-ink-2">The chart is supplied by TradingView and stays unloaded until you ask for it. Loading it connects your browser to TradingView’s servers.</p>
              <button type="button" className="btn btn-primary mt-21" onClick={load}>
                Load chart
              </button>
            </div>
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-13 gap-y-3 border-t border-line px-13 py-8 text-xs text-ink-3 sm:px-21">
        <span className="chip">Third party</span>
        <span>
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-[2.75rem] items-center md:min-h-0">
            Chart by TradingView
          </a>
        </span>
        <span>
          Third-party data for {name}, not supplied or verified by GIO4X and not a GIO4X price. Symbol <span className="num">{tv}</span>, UTC.
        </span>
        <span className="sr-only" aria-live="polite">
          {loaded ? "Chart loaded." : ""}
        </span>
      </figcaption>
    </figure>
  );
}
