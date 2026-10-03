import Link from "next/link";
import { KeptHere, SameBuilding } from "@/components/figures/extra/SideFigures";
import { CountVisitsPreference } from "@/components/company/CountVisitsPreference";
import { PrivacyControls, TimeZonePreference } from "@/components/company/PrivacyControls";
import { InstallApp } from "@/components/desk/InstallApp";
import { OfflineCopy } from "@/components/desk/OfflineCopy";
import { TradingViewPreference } from "@/components/markets/TradingViewPreference";
import { AppearanceControls } from "@/components/shell/Appearance";
import { ReplayOpening } from "@/components/shell/ReplayOpening";
import { SoundPreference } from "@/components/sound/SoundPreference";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Display & privacy",
  description: "Choose how GIO4X looks on this device, set your time zone, see exactly what the site stores in your browser and clear it with one click.",
  path: "/preferences",
  index: false,
});

export default function PreferencesPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Display & privacy", href: "/preferences" }]}
        eyebrow="Preferences"
        title="Display & privacy"
        lead="How the site looks on this device, and a precise account of what it remembers. Every setting here is stored in your browser and nowhere else."
        quiet
      />

      <section className="section-quiet" aria-labelledby="display-h">
        <div className="wrap phi phi-r items-start">
          <div>
            <h2 id="display-h" className="h3">
              Display
            </h2>
            <p className="mt-13 max-w-narrow text-ink-2">Changes apply at once and to every page. Light is the default; dark is the same building after hours.</p>
            <Link href="/design" className="go mt-21">
              Designing GIO4X
            </Link>
            <ReplayOpening />
            {/* this column ended well short of the one beside it: a figure that says what the text says */}
            <div className="mt-34 max-w-[28rem]">
              <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                <SameBuilding />
              </div>
            </div>
          </div>
          <div className="panel p-21 sm:p-34">
            <AppearanceControls />
          </div>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="time-h">
        <div className="wrap phi phi-r items-start">
          <div>
            <h2 id="time-h" className="h3">
              Time
            </h2>
            <p className="mt-13 max-w-narrow text-ink-2">Markets are a matter of clocks. Choose the zone you think in.</p>
          </div>
          <TimeZonePreference />
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="sound-h">
        <div className="wrap phi phi-r items-start">
          <div>
            <h2 id="sound-h" className="h3">
              Sound
            </h2>
            <p className="mt-13 max-w-narrow text-ink-2">The site is silent unless you switch sound on here. The choice and its volume are kept with your display preferences, in this browser only.</p>
            <div className="mt-21 border-l border-accent pl-13">
              <p className="label">Guided tour</p>
              <p className="mt-5 text-sm text-ink">Eight short stops across the markets, the accounts, the platforms, the tools and where to find help. It can be ended at any stop.</p>
              <Link href="/#tour" className="go mt-8 min-h-[2.75rem]">
                Take the tour
              </Link>
              <p className="mt-13 text-sm text-ink">Two pages have a short tour of their own, offered once on a first visit. Either can be started again here.</p>
              <div className="mt-5 flex flex-wrap gap-x-34 gap-y-3">
                <Link href="/tools#guide" className="go min-h-[2.75rem]">
                  Toolkit tour
                </Link>
                <Link href="/sign-in#guide" className="go min-h-[2.75rem]">
                  Gateway tour
                </Link>
              </div>
            </div>
          </div>
          <div className="panel p-21 sm:p-34">
            <SoundPreference />
          </div>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="privacy-h">
        <div className="wrap">
          <div className="phi phi-r items-start">
            <div>
              <h2 id="privacy-h" className="h3">
                Privacy controls
              </h2>
              <p className="mt-13 max-w-narrow text-ink-2">The complete list of what this site may keep in your browser, and whether each item is there now.</p>
              <div className="mt-21 scroll-mt-[var(--header-h)] border-l border-accent pl-13" id="counting">
                <p className="label">Trackers and counting</p>
                <p className="mt-5 text-sm text-ink">
                  There are no advertising trackers and no third-party trackers on this site. The site counts its own page views, accepted forms and searches as daily totals, with no cookie, no identifier and nothing that describes you.
                </p>
                <p className="mt-5 text-xs text-ink-3">
                  Counting is on by default. Switch it off here, or leave it to your browser: a Global Privacy Control or Do Not Track signal is honoured without any setting. Exactly what is counted is in the{" "}
                  <Link href="/legal/cookies#counting-visits" className="link">
                    Cookie Notice
                  </Link>
                  .
                </p>
                <div className="mt-13 max-w-narrow">
                  <CountVisitsPreference />
                </div>
              </div>
              <div className="mt-21 scroll-mt-[var(--header-h)] border-l border-accent pl-13" id="third-party">
                <p className="label">Third-party content</p>
                <p className="mt-5 text-sm text-ink">
                  Charts, the economic calendar, heat maps and quote panels embedded from TradingView are TradingView’s own pages, served under its own terms. A loaded frame may set TradingView’s own cookies, which this site cannot read.
                </p>
                <p className="mt-5 text-xs text-ink-3">By default each one stays unloaded until you press its button. This switch is the only standing choice, and it is kept with your display preferences.</p>
                <div className="mt-13 max-w-narrow">
                  <TradingViewPreference />
                </div>
              </div>
              {/* this column ended well short of the one beside it: a figure that says what the text says */}
              <div className="mt-34 max-w-[28rem]">
                <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                  <KeptHere />
                </div>
              </div>
            </div>
            <PrivacyControls />
          </div>
        </div>
      </section>

      <section id="offline" className="section-quiet hairline scroll-mt-[var(--header-h)] bg-paper" aria-labelledby="offline-h">
        <div className="wrap phi phi-r items-start">
          <div>
            <h2 id="offline-h" className="h3">
              Offline copy and app
            </h2>
            <p className="mt-13 max-w-narrow text-ink-2">
              Switch this on and this browser keeps a copy of the calculators and the pages you have opened in its cache storage, so they still open without a connection. It is off until you choose it. The copy stays on this device and is sent nowhere.
            </p>
            <Link href="/desk" className="go mt-21">
              My desk
            </Link>
          </div>
          <div className="grid gap-34">
            <OfflineCopy />
            <InstallApp />
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Legal", label: "Privacy Policy", note: "How personal data is handled.", href: "/legal/privacy" },
          { kind: "Legal", label: "Cookie Notice", note: "What is and is not set.", href: "/legal/cookies" },
          { kind: "Trust", label: "Online security", note: "Protecting your account.", href: "/trust/security" },
          { kind: "Company", label: "Designing GIO4X", note: "Why the site looks the way it does.", href: "/design" },
        ]}
      />
    </>
  );
}
