import Link from "next/link";
import { HeroScene } from "@/components/cockpit/HeroScene";
import { MarketSphere } from "@/components/market/MarketSphere";
import { site } from "@/config/site";

/**
 * Homepage hero: entering the GIO4X cockpit.
 *
 * The same night stage, at the same height, as every other page. Its
 * instrument is the market sphere (the world's financial centres, lit by
 * their real regular trading hours), standing on the stage's focal point
 * inside the flight-deck frame that the scene draws around it. On a phone the
 * sphere is the sky above the statement rather than a second stacked block.
 */
export function Hero() {
  return (
    <section className="cx-hero cx-home on-night" aria-labelledby="hero-title">
      <div className="cx-stage">
        <HeroScene scene="flightdeck" seed="/" />
        <div className="cx-home-sphere" style={{ animation: "gx-fade 1100ms var(--ease-out) 160ms both" }}>
          <MarketSphere className="w-full" />
        </div>
        <p className="cx-home-note hidden text-xs text-ink-3 lg:block">
          Financial centres by regular trading hours, live from your clock. Outer dial: 24h UTC with the four FX sessions.
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
