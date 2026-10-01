import Link from "next/link";
import { PrivacyControls, TimeZonePreference } from "@/components/company/PrivacyControls";
import { AppearanceControls } from "@/components/shell/Appearance";
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

      <section className="section-quiet hairline" aria-labelledby="privacy-h">
        <div className="wrap">
          <div className="phi phi-r items-start">
            <div>
              <h2 id="privacy-h" className="h3">
                Privacy controls
              </h2>
              <p className="mt-13 max-w-narrow text-ink-2">The complete list of what this site may keep in your browser, and whether each item is there now.</p>
              <div className="mt-21 border-l border-accent pl-13">
                <p className="label">Trackers</p>
                <p className="mt-5 text-sm text-ink">There are no advertising or analytics trackers on this site at present.</p>
                <p className="mt-5 text-xs text-ink-3">
                  If that ever changes, this page and the{" "}
                  <Link href="/legal/cookies" className="link">
                    Cookie Notice
                  </Link>{" "}
                  will say so. Charts embedded from TradingView are served by TradingView under its own terms.
                </p>
              </div>
            </div>
            <PrivacyControls />
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
