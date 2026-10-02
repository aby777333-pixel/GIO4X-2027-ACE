import Link from "next/link";
import { HeroScene } from "@/components/cockpit/HeroScene";
import { CentreSummary } from "@/components/home/CentreSummary";
import { site } from "@/config/site";

/**
 * Homepage hero: entering the GIO4X cockpit.
 *
 * The same night stage, at the same height, as every other page. Its
 * instrument is the flight-deck scene (cockpit/scenes/flightdeck.ts): the
 * globe of the world's financial centres, lit by their real regular trading
 * hours and by the real sun, with the forms of a trading floor about it. On a
 * phone it is the sky above the statement rather than a second stacked block.
 * The canvas is decorative; <CentreSummary/> says the same real information in
 * words, and the caption says what is real and what is only form.
 */
export function Hero() {
  return (
    <section className="cx-hero cx-home on-night" aria-labelledby="hero-title">
      <div className="cx-stage">
        <HeroScene scene="flightdeck" seed="/" />
        <CentreSummary />
        <p className="cx-home-note hidden text-xs text-ink-3 lg:block">
          Financial centres by regular trading hours, joined when open together, with day and night from your clock. Timeline: the day ahead in UTC, each centre&apos;s regular hours and the four FX sessions. Tape, ladder and candles are forms only, not market data.
        </p>
      </div>

      <div className="cx-main">
        <div className="cx-statement">
          <div className="cx-statement-body max-w-[40rem]">
            <p className="eyebrow" style={{ animation: "gx-rise 680ms var(--ease-out) both" }}>
              {site.tagline}
            </p>
            <h1 id="hero-title" className="display mt-21" style={{ animation: "gx-rise 680ms var(--ease-out) 80ms both" }}>
              Global markets.
              <br />
              <span className="text-ink-3">Gentlemanly</span> standards.
            </h1>
            <p className="lead mt-21 max-w-[30rem]" style={{ animation: "gx-rise 680ms var(--ease-out) 160ms both" }}>
              Six asset classes on MetaTrader&nbsp;5 and 777&nbsp;Raptor. And an open library of tools, research and plain disclosure, so you understand a market before you trade it.
            </p>
            <div className="mt-34 flex flex-wrap items-center gap-13" style={{ animation: "gx-rise 680ms var(--ease-out) 240ms both" }}>
              <Link href="/open-account" className="btn btn-primary btn-lg">
                Open an account
              </Link>
              <Link href="/markets" className="btn btn-ghost btn-lg">
                Explore markets
              </Link>
            </div>
            <p className="mt-34 flex flex-wrap items-center gap-x-13 gap-y-5 text-xs font-medium tracking-[0.08em] text-ink-3" style={{ animation: "gx-fade 1100ms var(--ease-out) 420ms both" }}>
              <Link href="/platforms/metatrader-5" className="link-quiet uppercase">
                MetaTrader 5
              </Link>
              <span aria-hidden className="text-prestige">
                ×
              </span>
              <Link href="/platforms/raptor" className="link-quiet uppercase">
                777 Raptor
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
