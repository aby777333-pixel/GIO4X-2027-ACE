import Link from "next/link";
import { MarketSphere } from "@/components/market/MarketSphere";
import { site } from "@/config/site";

/**
 * Homepage hero. Composition: 38.2% statement / 61.8% market sphere.
 * On mobile the sphere becomes a cropped backdrop behind the statement
 * rather than a second stacked block: its own composition, not a shrink.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* the coordinate field: fine, almost subliminal */}
      <div aria-hidden className="grid-field pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_70%_at_70%_45%,black,transparent)]" />

      <div className="wrap relative grid min-h-[calc(100svh-var(--header-h)-4.5rem)] items-center gap-34 py-34 lg:grid-cols-phi-r lg:py-55">
        <div className="relative z-1 max-w-[34rem] pb-34 pt-55 lg:py-0">
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

        <div
          className="pointer-events-none absolute -right-[38%] top-[4%] w-[118%] opacity-50 sm:-right-[20%] sm:w-[90%] lg:pointer-events-auto lg:static lg:w-full lg:opacity-100"
          style={{ animation: "gx-fade 1100ms var(--ease-out) 160ms both" }}
        >
          <MarketSphere className="mx-auto w-full max-w-[46rem]" />
          <p className="mt-8 hidden text-center text-xs text-ink-3 lg:block">
            Financial centres by regular trading hours, live from your clock. Outer dial: 24h UTC with the four FX sessions.
          </p>
        </div>
      </div>
    </section>
  );
}
