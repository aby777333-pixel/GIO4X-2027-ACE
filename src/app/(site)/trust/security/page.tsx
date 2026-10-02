import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { NotedChapter } from "@/components/figures/trust/NotedChapter";
import { TwoFactors } from "@/components/figures/trust/TwoFactors";
import { JsonLd } from "@/components/seo/JsonLd";
import { Chapter, Rows } from "@/components/trust/Parts";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";
import { webPageSchema } from "@/lib/schema";

const description = "What this website does that you can check from your own browser, and practical guidance on passwords, two-factor authentication, phishing and device hygiene.";

export const metadata = pageMeta({ title: "Online security", description, path: "/trust/security" });

/** Each row is a property of this website and the way a visitor can confirm it. */
const siteFacts: { t: string; d: string; check: string }[] = [
  {
    t: "HTTPS only",
    d: "Every page is served over an encrypted connection, and the site instructs browsers to refuse an unencrypted one.",
    check: "The address bar shows https://. In your browser’s developer tools, the response carries a Strict-Transport-Security header.",
  },
  {
    t: "No third-party scripts",
    d: "The Content-Security-Policy allows scripts from this website’s own origin and from nowhere else. Inline scripts are permitted because the framework needs them to start a statically generated page.",
    check: "Read the Content-Security-Policy response header: script-src lists only ‘self’. The Network panel shows no script loaded from another domain.",
  },
  {
    t: "No advertising trackers",
    d: "There are no advertising tags, tracking pixels or analytics scripts on these pages, and no advertising or analytics cookies.",
    check: "Open the Network panel and reload. Open the storage panel and look at the cookies for this site.",
  },
  {
    t: "Forms go to GIO4X only",
    d: "A form on this site submits to this website’s own endpoint. The policy forbids a form from posting anywhere else.",
    check: "The Content-Security-Policy header contains form-action ‘self’. Submit a form with the Network panel open and read the request address.",
  },
  {
    t: "Display preferences stay on your device",
    d: "Theme, density, time zone and similar choices are kept in your browser’s local storage. They are not sent to a server.",
    check: "The Cookie & Storage Notice lists every key. The preferences page shows and clears them.",
  },
  {
    t: "Third-party panels only on request",
    d: "Market charts, the economic calendar, heat maps and quote panels from TradingView are embedded frames. Each loads when you ask for it, or as it scrolls into view if you have switched that on in your preferences. No TradingView script runs on these pages, no other site may be framed, and this site may not be framed by anyone.",
    check: "The header lists TradingView under frame-src and sets frame-ancestors to ‘none’.",
  },
  {
    t: "No access to camera, microphone or location",
    d: "The site’s Permissions-Policy switches these browser features off for every page.",
    check: "Read the Permissions-Policy response header.",
  },
];

const guidance: { t: string; d: string }[] = [
  {
    t: "Use a strong, unique password, and a password manager to hold it.",
    d: "A password used on one site only cannot be turned against you when another site is breached. A password manager makes unique passwords practical, and it will not fill a password into a look-alike address, which is a useful warning in itself.",
  },
  {
    t: "Turn on two-factor authentication wherever it is offered.",
    d: "A second factor means a stolen password is not enough on its own. An authenticator app or a hardware key resists interception better than a text message. Keep the recovery codes somewhere offline.",
  },
  {
    t: "Treat every unexpected message as unverified.",
    d: "Phishing works by borrowing a name you know and adding urgency. Do not follow the link in the message. Go to the site by typing the address or using your own bookmark, and look for the request there.",
  },
  {
    t: "Read the address bar before you type anything.",
    d: "Check the host name from right to left, and check for https. A padlock icon only tells you the connection is encrypted; it does not tell you who is at the other end.",
  },
  {
    t: "Keep your devices current.",
    d: "Install operating-system and browser updates promptly, remove extensions you do not use, and install software only from its publisher or an official app store. Lock your screen, and sign out on any device you share.",
  },
  {
    t: "Be careful on public Wi-Fi.",
    d: "On a network you do not control, avoid signing in to financial accounts if you can wait. If you cannot, use your phone’s mobile data or a connection you trust, and never accept a certificate warning to get past it.",
  },
  {
    t: "Never share a password or a one-time code.",
    d: "Not with a caller, not in a chat, not with someone who says they are from GIO4X. GIO4X staff will never ask for either.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ path: "/trust/security", name: "Online security", description })} />
      <PageHero
        crumbs={[
          { name: "Trust Centre", href: "/trust" },
          { name: "Online security", href: "/trust/security" },
        ]}
        eyebrow="Online security"
        title="Security you can check, and security you can practise."
        lead="This page makes two kinds of statement: what this website does, each with the way to confirm it yourself, and general guidance for looking after your own accounts. It makes no claim that cannot be tested."
      />

      <section className="section-quiet" aria-labelledby="site-facts">
        <div className="wrap">
          <div className="phi items-end">
            <div data-reveal suppressHydrationWarning>
              <p className="eyebrow">This website</p>
              <h2 id="site-facts" className="h2 mt-13 max-w-[18ch]">
                Seven things it does, and how to confirm each.
              </h2>
            </div>
            <p className="text-ink-2" data-reveal suppressHydrationWarning>
              These describe the public website you are reading. They are not statements about trading platforms, client portals or internal systems, which are separate and are not covered here.
            </p>
          </div>

          <div className="mt-34 border-t border-line-strong">
            <div className="hidden border-b border-line py-13 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_minmax(0,1.3fr)] md:gap-x-34" aria-hidden>
              <span className="label">
                Property
              </span>
              <span className="label">
                What it means
              </span>
              <span className="label">
                How to check
              </span>
            </div>
            {siteFacts.map((f, i) => (
              <div key={f.t} className="grid gap-x-34 gap-y-8 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_minmax(0,1.3fr)]" data-reveal suppressHydrationWarning style={{ ["--i" as string]: Math.min(i, 5) }}>
                <h3 className="h4">
                  {f.t}
                </h3>
                <p className="text-ink-2">
                  {f.d}
                </p>
                <p className="text-sm text-ink-3">
                  <span className="label mb-3 block md:sr-only">How to check</span>
                  {f.check}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-21 max-w-measure text-sm text-ink-3">
            Network requests made by these pages are limited to this website’s own origin and, where one is configured, GIO4X’s own hosted database project. The full list of what is stored in your browser is in the{" "}
            <Link href="/legal/cookies" className="link">
              Cookie & Storage Notice
            </Link>
            .
          </p>
        </div>
      </section>

      <NotedChapter
        id="your-side"
        eyebrow="Your side"
        title="Seven habits that do most of the work."
        lead="General guidance, written for anyone with an online financial account. It is not specific to GIO4X and does not depend on it."
        paper
        stretch
        note={
          <FigureNote figure={<TwoFactors />} label="In practice" className="lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)]">
            If a message asks you to sign in, pay or download, paste its address into the{" "}
            <Link href="/trust/verify" className="link">
              Official Destination Checker
            </Link>{" "}
            first. The check runs on your device and makes no network request.
          </FigureNote>
        }
      >
        <Rows numbered items={guidance} />
      </NotedChapter>

      <Chapter id="not-claimed" eyebrow="What is not claimed" title="No grades, no audits, no certificates." flip>
        <div className="grid max-w-measure gap-21 text-ink-2" data-reveal suppressHydrationWarning>
          <p>
            The previous GIO4X websites described encryption strengths, firewalls, fraud-detection systems, audits and insurance. None of those statements came with evidence a visitor could examine, so none of them is repeated here.
          </p>
          <p>
            If GIO4X later publishes an independent assessment, it will appear in the{" "}
            <Link href="/trust/transparency" className="link">
              transparency table
            </Link>{" "}
            with the name of the assessor, the scope and the date. Until then the honest position is the one on this page: here is what the website does, and here is how to see it.
          </p>
        </div>
      </Chapter>

      <Chapter id="reporting" eyebrow="Reporting" title="Found a weakness, or received something suspicious?" paper>
        <div className="grid gap-21" data-reveal suppressHydrationWarning>
          <p className="max-w-measure text-ink-2">
            A <span className="font-mono text-[0.9375rem] text-ink">security.txt</span> file and a dedicated security contact will be published once GIO4X has confirmed them. They are not published yet, and no address is given here that has not been confirmed.
          </p>
          <p className="max-w-measure text-ink-2">
            Until then, use the contact page and choose the Security topic, or write to{" "}
            <a href={`mailto:${site.email}`} className="link">
              {site.email}
            </a>
            . Describe what you found and how to reproduce it. Please do not include passwords, one-time codes or other people’s personal data.
          </p>
          <div className="flex flex-wrap gap-13">
            <Link href="/contact?topic=security" className="btn btn-primary">
              Contact security
            </Link>
            <Link href="/trust/verify" className="btn btn-ghost">
              Check a link first
            </Link>
          </div>
        </div>
      </Chapter>

      <NextSteps
        items={[
          { label: "Check a link", href: "/trust/verify", kind: "Verify", note: "Official Destination Checker" },
          { label: "Cookie & Storage Notice", href: "/legal/cookies", kind: "Privacy", note: "Every key this site stores" },
          { label: "Privacy preferences", href: "/preferences", kind: "Controls", note: "See and clear local data" },
          { label: "Client funds", href: "/trust/client-funds", kind: "Ask", note: "What is published, and what to ask" },
        ]}
      />
    </>
  );
}
