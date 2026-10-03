import Link from "next/link";
import { Backdrop } from "@/components/figures/Backdrop";
import { OutsideTheLine } from "@/components/figures/extra/ShortColumns";
import { FigureNote } from "@/components/figures/Figure";
import { NotedChapter } from "@/components/figures/trust/NotedChapter";
import { PortalGates } from "@/components/figures/trust/PortalGates";
import { SenderLine } from "@/components/figures/trust/SenderLine";
import { JsonLd } from "@/components/seo/JsonLd";
import { LinkChecker } from "@/components/trust/LinkChecker";
import { Chapter, Ext, Rows } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { approvedThirdParties, destinationAddress, officialDomains, portalMeta, portals, socials, type PortalKey } from "@/config/destinations";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "Paste any address and compare it with the registry of official GIO4X domains and approved third-party destinations. The check runs on your device and makes no network request.";

export const metadata = pageMeta({ title: "Official Destination Checker", description, path: "/trust/verify" });

export default function VerifyPage() {
  const portalKeys = Object.keys(portals) as PortalKey[];
  const socialEntries = Object.entries(socials).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0);

  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/verify", name: "Official Destination Checker", description })} />
      <PageHero
        quiet
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "Verify a link", href: "/trust/verify" },
        ]}
        eyebrow="Official Destination Checker"
        title="Is this link really GIO4X?"
        lead="Before you sign in, download or pay anywhere, paste the address here. The answer is one of three, and it is never a guess."
      />

      <section className="section-quiet" aria-labelledby="checker">
        <div className="wrap phi items-start">
          <div>
            <h2 id="checker" className="sr-only">
              Check an address
            </h2>
            <LinkChecker />
          </div>
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">How the check works</p>
            <dl className="mt-21 border-t border-line">
              {[
                { t: "It compares text.", d: "The address you paste is compared, character by character, with the list on this page. That is all it does." },
                { t: "It makes no network request.", d: "The address is never opened, fetched or pinged, so checking a suspicious link cannot expose you to it." },
                { t: "It keeps nothing.", d: "What you type stays in this page. It is not sent to GIO4X and not written to storage." },
                { t: "Unknown is not an accusation.", d: "“Not recognised” means the address is not one GIO4X publishes. It says nothing about whether the site is harmful." },
              ].map((r) => (
                <div key={r.t} className="border-b border-line py-13">
                  <dt className="font-medium text-ink">{r.t}</dt>
                  <dd className="mt-3 text-sm text-ink-2">{r.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Chapter id="official-domains" eyebrow="The registry" title="Official GIO4X domains" lead="An address is official if its host is exactly one of these, or a subdomain of one. Nothing else is." paper>
        <ul className="border-t border-line-strong">
          {officialDomains.map((d) => (
            <li key={d} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 border-b border-line py-21" data-reveal suppressHydrationWarning>
              <span className="font-mono text-lg text-ink">{d}</span>
              <span className="text-sm text-ink-3">
                and any address ending in <span className="font-mono text-ink-2">.{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-21 max-w-measure text-sm text-ink-3">
          Read a host name from right to left. In <span className="break-all font-mono text-ink-2">portal.{site.domain}.example.net</span> the site is <span className="font-mono text-ink-2">example.net</span>, whatever appears before it. Only <span className="font-mono text-ink-2">https</span>{" "}
          addresses are recognised.
        </p>
      </Chapter>

      <NotedChapter
        id="approved-third-parties"
        eyebrow="The registry"
        title="Approved third parties"
        lead="GIO4X links to these organisations on purpose. They are not GIO4X, and each is responsible for its own website."
        note={
          <FigureNote figure={<OutsideTheLine />} label="In the checker">
            An address on one of these domains is answered “Approved third-party destination”, never “Official GIO4X”. The answer names the organisation and gives the reason GIO4X links to it.
          </FigureNote>
        }
      >
        <div className="scroll-x" data-reveal suppressHydrationWarning>
          <table className="table-gx min-w-[34rem]">
            <caption className="sr-only">Approved third-party destinations and the reason each is linked</caption>
            <thead>
              <tr>
                <th scope="col">Organisation</th>
                <th scope="col">Domain</th>
                <th scope="col">Why GIO4X links to it</th>
              </tr>
            </thead>
            <tbody>
              {approvedThirdParties.map((t) => (
                <tr key={t.host}>
                  <th scope="row" className="!whitespace-normal !border-line !py-13 !pr-21 !align-top !text-[0.9375rem] !font-medium !normal-case !tracking-normal !text-ink">
                    {t.label}
                  </th>
                  <td className="!py-13 !pr-21 !align-top font-mono text-[0.8125rem] text-ink-2">{t.host}</td>
                  <td className="!py-13 !align-top text-[0.9375rem] text-ink-2">{t.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-21 max-w-measure text-sm text-ink-3">
          The technology provider’s own site is <Ext href={site.technologyPartner.url}>777raptor.com</Ext>. MetaTrader 5 is a trademark of MetaQuotes Ltd.
        </p>
      </NotedChapter>

      <NotedChapter
        id="portals"
        eyebrow="Sign-in destinations"
        title="Portals"
        lead="The places where a client would sign in or apply. Each is listed here only once its address has been supplied and security-reviewed."
        paper
        note={
          <FigureNote figure={<PortalGates />} label="Worth knowing">
            A sign-in address that is not in this list has not been through those two steps, whoever sent it. Paste it into the{" "}
            <Link href="#checker" className="link">
              checker
            </Link>{" "}
            at the top of this page before you use it.
          </FigureNote>
        }
      >
        <ul className="border-t border-line-strong">
          {portalKeys.map((k) => {
            const d = portals[k];
            return (
              <li key={k} className="grid gap-x-21 gap-y-5 border-b border-line py-21 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline" data-reveal suppressHydrationWarning>
                <span>
                  <span className="h4 block">{portalMeta[k].label}</span>
                  <span className="mt-3 block text-sm text-ink-3">{portalMeta[k].summary}</span>
                </span>
                {d.status === "CONFIGURED" ? (
                  <span className="grid gap-3 sm:justify-items-end">
                    <span className="state state-open">Connected</span>
                    <span className="break-all font-mono text-[0.8125rem] text-ink-2">{destinationAddress(d.url)}</span>
                  </span>
                ) : (
                  <span className="state state-off">Not connected yet</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-21 max-w-measure text-ink-2">
          Until a portal is connected, this website does not link to any external sign-in, registration or download address. If a message sends you to a GIO4X “portal” today, check the address above before you do anything else. On this site, account requests begin at{" "}
          <Link href="/open-account" className="link">
            Open an account
          </Link>{" "}
          and{" "}
          <Link href="/sign-in" className="link">
            Sign in
          </Link>
          .
        </p>
      </NotedChapter>

      <Chapter id="social-accounts" eyebrow="The registry" title="Official social accounts" lead="A profile is official only if it is listed here.">
        {socialEntries.length === 0 ? (
          <div className="border-y border-line-strong py-34" data-reveal suppressHydrationWarning>
            <p className="state state-off">None published yet</p>
            <p className="mt-13 max-w-measure text-ink-2">
              GIO4X has not yet published a verified list of social accounts on this site. Until it does, treat any profile, channel or group using the GIO4X name as unconfirmed, including ones that link back to this website. Do not send money, documents, passwords or codes to anyone who contacts you
              through such a profile.
            </p>
          </div>
        ) : (
          <ul className="border-t border-line-strong">
            {socialEntries.map(([k, url]) => (
              <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-21 gap-y-5 border-b border-line py-13">
                <span className="font-medium capitalize text-ink">{k}</span>
                <span className="break-all font-mono text-[0.8125rem] text-ink-2">{url}</span>
              </li>
            ))}
          </ul>
        )}
      </Chapter>

      <NotedChapter
        id="genuine-communications"
        eyebrow="Messages"
        title="How to recognise a genuine GIO4X message"
        paper
        flip
        note={
          <FigureNote figure={<SenderLine />} label="In practice">
            Apply all four tests, not the first alone. If a message fails any of them, do not act on it: send the address and the message to GIO4X under the Security topic on the{" "}
            <Link href="/contact?topic=security" className="link">
              contact page
            </Link>
            .
          </FigureNote>
        }
      >
        <Rows
          numbered
          items={[
            { t: "It comes from the gio4x.com domain.", d: `Email from GIO4X is sent from an address ending in @${site.domain}. A display name is not an address: open the sender details and read what follows the @ sign.` },
            { t: "It never asks for your password or a one-time code.", d: "GIO4X staff will never ask for your password, a verification code sent to your phone or email, or remote access to your device. Anyone who asks is not acting for GIO4X." },
            { t: "Its links pass the check above.", d: "Copy a link instead of clicking it, paste it into the checker, and follow it only if the answer is “Official GIO4X”." },
            { t: "It does not hurry you.", d: "Deadlines, threats to close an account and offers that expire within the hour are the ordinary tools of fraud. A genuine request can wait while you check it." },
          ]}
        />
      </NotedChapter>

      <section className="section-quiet hairline relative" aria-labelledby="report">
        <Backdrop variant="tape" />
        <div className="wrap flex flex-col gap-21 md:flex-row md:items-end md:justify-between">
          <div data-reveal suppressHydrationWarning>
            <p className="eyebrow">Something does not look right</p>
            <h2 id="report" className="h3 mt-13">
              Report a suspicious message
            </h2>
            <p className="mt-13 max-w-measure text-ink-2">Send the address and, if you can, the full message. Do not forward passwords or codes. Choose the Security topic so it reaches the right people.</p>
          </div>
          <Link href="/contact?topic=security" className="btn btn-primary shrink-0" data-reveal suppressHydrationWarning>
            Report to GIO4X
          </Link>
        </div>
      </section>

      <NextSteps
        items={[
          { label: "Online security", href: "/trust/security", kind: "Protect", note: "Passwords, two-factor codes, phishing" },
          { label: "What we disclose", href: "/trust/transparency", kind: "Disclose", note: "Published and not yet published" },
          { label: "Platforms", href: "/platforms", kind: "Software", note: "777 Raptor and MetaTrader 5" },
          { label: "Trust Centre", href: "/trust", kind: "Trust", note: "All sections" },
        ]}
      />
    </>
  );
}
