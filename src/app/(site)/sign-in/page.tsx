import Link from "next/link";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { ThreeDoors } from "@/components/figures/stage/ThreeDoors";
import { PageTour } from "@/components/tour/PageTour";
import type { PageTourStop } from "@/components/tour/stops";
import { PageHero } from "@/components/ui/Page";
import { destinationAddress, portalMeta, portals, type PortalKey } from "@/config/destinations";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Sign in",
  description: "The GIO4X gateway to the Client Portal, Trader Portal and IB Portal. Destinations are shown only when they are verified.",
  path: "/sign-in",
  index: false,
});

const ORDER: PortalKey[] = ["client", "trader", "ib"];

/** A small shield with a tick: shape plus label, never colour alone. */
function VerifiedMark() {
  return (
    <span className="inline-flex items-center gap-5 text-xs font-medium text-pos">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
        <path d="M6.5 1 11 2.7v3.4c0 2.7-1.8 4.8-4.5 5.9C3.8 10.900 2 8.800 2 6.100V2.700L6.500 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="m4.500 6.500 1.500 1.500 2.600-2.900" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified GIO4X destination
    </span>
  );
}

/**
 * The gateway. Three destinations and nothing else. A destination becomes a
 * link only when the registry marks it CONFIGURED; otherwise it is a plain,
 * honest row. There is never a "#" link and never a guessed address.
 */
export default function SignInPage() {
  const anyUnconfigured = ORDER.some((k) => portals[k].status === "UNCONFIGURED");

  // the first-visit gateway tour: what each door is, in the registry's own words, and whether it is connected
  const tour: PageTourStop[] = [
    {
      target: '[data-tour="doors"]',
      title: "Three doors",
      body: "This page is the way from the website into GIO4X’s portals. A door is a link only once its destination is verified; until then it reads “Not connected yet”. There is never a guessed address.",
    },
    ...ORDER.map((key): PageTourStop => {
      const dest = portals[key];
      return {
        target: `[data-tour="door-${key}"]`,
        title: portalMeta[key].label,
        body: `${portalMeta[key].summary} ${dest.status === "CONFIGURED" ? `It opens at ${destinationAddress(dest.url)}, shown beside it.` : "It is not connected to this website yet."}`,
      };
    }),
    {
      target: '[data-tour="gateway-safety"]',
      title: "Before you type anything",
      body: "GIO4X will never ask for your password or a one-time security code by email or message. If you were sent a link, the Official Destination Checker compares it with the registry of GIO4X domains and approved third parties.",
    },
  ];

  return (
    <>
    <PageTour id="gateway" stops={tour} />
    <PageHero
      crumbs={[{ name: "Sign in", href: "/sign-in" }]}
      eyebrow="Sign in"
      title="Welcome back"
      lead="Choose your destination:"
      aside={
        <div>
          <ul className="border-t border-line-strong" data-tour="doors">
            {ORDER.map((key) => {
              const dest = portals[key];
              const meta = portalMeta[key];
              if (dest.status === "CONFIGURED") {
                return (
                  <li key={key} className="border-b border-line" data-tour={`door-${key}`}>
                    <a href={dest.url} rel="noopener noreferrer" className="group grid grid-cols-[1fr_auto] items-center gap-x-21 gap-y-5 py-21 transition-colors duration-fast hover:bg-surface sm:px-13">
                      <span>
                        <span className="h3 block transition-colors duration-fast group-hover:text-accent">{meta.label}</span>
                        <span className="mt-5 block text-sm text-ink-2">{meta.summary}</span>
                        <span className="mt-8 flex flex-wrap items-center gap-x-13 gap-y-5">
                          <span className="num text-sm font-medium text-ink">{destinationAddress(dest.url)}</span>
                          <VerifiedMark />
                        </span>
                      </span>
                      <span className="go" aria-hidden>
                        Continue
                      </span>
                    </a>
                  </li>
                );
              }
              return (
                <li key={key} className="grid grid-cols-[1fr_auto] items-start gap-x-21 border-b border-line py-21 sm:px-13" data-tour={`door-${key}`}>
                  <span>
                    <span className="h3 block text-ink-2">{meta.label}</span>
                    <span className="mt-5 block text-sm text-ink-3">{meta.summary}</span>
                  </span>
                  <span className="state state-off mt-[0.6rem]">Not connected yet</span>
                </li>
              );
            })}
          </ul>

          {anyUnconfigured && (
            <p className="mt-21 text-sm text-ink-2">
              Portal access is being connected to this website. If you already hold a GIO4X account, use the link in your account emails, or{" "}
              <Link href="/contact?topic=account" className="link">
                contact support
              </Link>
              .
            </p>
          )}

          <div className="mt-34 border-t border-line pt-21 text-sm text-ink-3" data-tour="gateway-safety">
            <p>
              GIO4X will never ask for your password or a one-time security code by email or message. Unsure about a link?{" "}
              <Link href="/trust/verify" className="link">
                Verify it
              </Link>
              .
            </p>
            <p className="mt-8">
              New to GIO4X?{" "}
              <Link href="/open-account" className="link">
                Open an account
              </Link>
            </p>
          </div>
        </div>
      }
      companion={
        <HeroCompanion figure={<ThreeDoors />} label="Before you sign in">
          A destination is shown here as a link only once it is verified. To check an address you have been sent, paste it into the{" "}
          <Link href="/trust/verify" className="link">
            Official Destination Checker
          </Link>
          , which compares it with the registry of GIO4X domains and approved third parties.
        </HeroCompanion>
      }
    />
    </>
  );
}
