import Link from "next/link";
import { AddressCheck } from "@/components/figures/extra/SideFigures";
import { Rosette } from "@/components/brand/Rosette";
import { InterestForm } from "@/components/company/InterestForm";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { SteppingStones } from "@/components/figures/stage/SteppingStones";
import { PageHero } from "@/components/ui/Page";
import { destinationAddress, portals } from "@/config/destinations";
import { companyLine, riskWarning } from "@/config/legal";
import { site } from "@/config/site";
import { accounts, restrictedJurisdictions } from "@/data/accounts";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Open an account",
  description: "Start a GIO4X application. What you will need, the three account types, where services are not available and the risk warning.",
  path: "/open-account",
  index: false,
});

const needs = [
  { t: "An identity document", d: "A current document that establishes who you are." },
  { t: "Proof of address", d: "A recent document that shows your name and where you live." },
];

/**
 * The account-opening moment. The page goes quiet on purpose: one column of
 * explanation, one object to act on, and the security cues in plain sight.
 */
export default function OpenAccountPage() {
  const dest = portals.openAccount;
  const configured = dest.status === "CONFIGURED";

  return (
    <>
      {/* the stage: the explanation, and the one object to act on standing beside it */}
      <PageHero
        crumbs={[{ name: "Open an account", href: "/open-account" }]}
        eyebrow="Open an account"
        title="One step at a time."
        quiet
        lead={
          configured
            ? "The application is completed on the GIO4X account-opening portal. Have the two documents below to hand before you begin."
            : "Online applications are being connected to this website and cannot be started from this page yet. Leave your details and we will write to you about opening an account."
        }
        aside={
        <div className="panel p-21 shadow-2 sm:p-34">
          {configured ? (
            <>
              <Rosette size={34} dna />
              <h2 className="h3 mt-13">Continue to the application</h2>
              <p className="mt-8 text-ink-2">The application continues in the GIO4X portal, at the address below.</p>
              <p className="mt-21 flex flex-wrap items-center gap-x-13 gap-y-5 border-y border-line py-13">
                <span className="num font-medium text-ink">{destinationAddress(dest.url)}</span>
                <span className="inline-flex items-center gap-5 text-xs font-medium text-pos">
                  <span aria-hidden>{"✓"}</span> Verified GIO4X destination
                </span>
              </p>
              <a href={dest.url} rel="noopener noreferrer" className="btn btn-primary btn-lg mt-21 w-full">
                Start application
              </a>
            </>
          ) : (
            <>
              <p className="state state-pre">Applications not connected yet</p>
              <h2 className="h3 mt-13">Register your interest</h2>
              <p className="mb-21 mt-8 text-ink-2">Four details, used only to write to you about opening an account.</p>
              <InterestForm email={site.email} accountNames={accounts.map((a) => a.name)} restricted={restrictedJurisdictions} />
            </>
          )}
        </div>
        }
        companion={
          <HeroCompanion figure={<SteppingStones />} label="What comes later">
            The application itself will ask for an identity document and a proof of address. No documents are requested at this stage, and neither should be sent by email or through a form on this site: you will be told how to provide them.
          </HeroCompanion>
        }
      />

      <div className="bg-paper">
      <div className="wrap pb-55 pt-34 lg:pb-89 lg:pt-55">
        <div className="grid gap-34 lg:grid-cols-phi-r lg:gap-89">
          {/* left: the calm explanation */}
          <div>
            <h2 className="label border-b border-line-strong pb-13">What you will need</h2>
            <ol>
              {needs.map((n, i) => (
                <li key={n.t} className="grid grid-cols-[1.3125rem_1fr] gap-x-13 border-b border-line py-13">
                  <span className="num pt-2 text-xs font-semibold text-ink-3" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{n.t}</span>
                    <span className="block text-sm text-ink-2">{n.d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-13 text-sm text-ink-3">Do not send either document by email or through a form on this site. You will be told how to provide them as part of the application.</p>

            <h2 className="label mt-34 border-b border-line-strong pb-13">The three accounts</h2>
            <ul>
              {accounts.map((a) => (
                <li key={a.key} className="grid grid-cols-[5.5625rem_1fr_auto] items-baseline gap-x-13 border-b border-line py-13">
                  <span className="h4">{a.name}</span>
                  <span className="text-sm text-ink-2">{a.suits}</span>
                  <span className="num text-sm text-ink-3">from {a.minDeposit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-13 flex flex-wrap gap-x-34 gap-y-3">
              <Link href="/trading/accounts" className="go min-h-[2.75rem]">
                Compare account types
              </Link>
              <Link href="/trading/accounts/choose" className="go min-h-[2.75rem]">
                Help me choose
              </Link>
            </div>
          </div>

          {/* right: the security cues, strong and quiet */}
          <div>
            <h2 className="label border-b border-line-strong pb-13">Before you type anything</h2>
            <ul className="mt-13 grid gap-8 text-sm text-ink-2">
              <li className="grid grid-cols-[1.3125rem_1fr] gap-x-8">
                <LockIcon />
                <span>
                  Check that the address bar shows <span className="num font-medium text-ink">{site.domain}</span> before you type anything.{" "}
                  <Link href="/trust/verify" className="link">
                    Verify a link
                  </Link>
                </span>
              </li>
              <li className="grid grid-cols-[1.3125rem_1fr] gap-x-8">
                <LockIcon />
                <span>GIO4X will never ask for your password or a one-time security code by email or message.</span>
              </li>
              <li className="grid grid-cols-[1.3125rem_1fr] gap-x-8">
                <LockIcon />
                <span>
                  Already a client?{" "}
                  <Link href="/sign-in" className="link">
                    Sign in
                  </Link>
                </span>
              </li>
            </ul>
            {/* this column ended well short of the one beside it: a figure that says what the text says */}
            <div className="mt-34 max-w-[28rem]">
              <div className="flat rounded-[8px] border border-line bg-surface/60 p-13">
                <AddressCheck domain={site.domain} />
              </div>
            </div>
          </div>
        </div>

        {/* the statements that must be read, in ordinary type */}
        <div className="mt-55 grid gap-34 border-t border-line-strong pt-34 lg:grid-cols-2 lg:gap-89">
          <section id="jurisdictions" className="scroll-mt-[calc(var(--header-h)+1.3125rem)]" aria-labelledby="jur-h">
            <h2 id="jur-h" className="label">
              Where services are not available
            </h2>
            <p className="mt-13 text-sm leading-relaxed text-ink-2">Services are not available to residents of: {restrictedJurisdictions.join(", ")}.</p>
          </section>
          <section aria-labelledby="risk-h">
            <h2 id="risk-h" className="label">
              Risk warning
            </h2>
            <p className="mt-13 text-sm leading-relaxed text-ink-2">{riskWarning}</p>
            <p className="mt-13 text-sm text-ink-3">
              {companyLine}{" "}
              <Link href="/legal/risk" className="link">
                Full risk disclosure
              </Link>
            </p>
          </section>
        </div>
      </div>
      </div>
    </>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden className="mt-[0.25rem] text-ink-3">
      <rect x="2.5" y="5.5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.5 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
