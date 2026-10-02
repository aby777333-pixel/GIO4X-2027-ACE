import Link from "next/link";
import { ContactForm } from "@/components/company/ContactForm";
import { Offices } from "@/components/company/Offices";
import { KeptKey } from "@/components/figures/extra/KeptKey";
import { RegistryMatch } from "@/components/figures/extra/RegistryMatch";
import { SideNote } from "@/components/figures/extra/SideNote";
import { HeroCompanion } from "@/components/figures/markets/HeroCompanion";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Contact",
  description: "One contact form for GIO4X, routed by topic: general, account, 777 Raptor, MetaTrader 5, technical, partnership, press, security, privacy and complaints.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Contact", href: "/contact" }]}
        eyebrow="Contact"
        title="Write to GIO4X."
        lead="Choose a topic and the form will tell you what helps us answer. The topic travels with your message, so it does not have to be explained twice."
        quiet
        aside={
          <div className="border-l border-line-strong pl-21">
            <p className="label">Or by email</p>
            <a href={`mailto:${site.email}`} className="link mt-8 inline-block font-display text-xl">
              {site.email}
            </a>
            <p className="mt-13 text-sm font-medium text-ink">Never share your password or one-time security code in a message.</p>
          </div>
        }
        companion={
          <HeroCompanion layout="beside" figure={<KeptKey ratio={2} />}>
            With an account already, or a problem that needs solving, a{" "}
            <Link href="/support" className="link">
              support request
            </Link>{" "}
            gets a reference and a reply you can read on the website.
          </HeroCompanion>
        }
      />

      <section className="section-quiet" aria-labelledby="form-h">
        <div className="wrap">
          <h2 id="form-h" className="sr-only">
            Contact form
          </h2>
          <p className="mb-21 max-w-measure text-sm text-ink-2">
            Already have an account, or a problem that needs solving? Open a{" "}
            <Link href="/support" className="link">
              support request
            </Link>{" "}
            instead: you get a reference and can read our reply on the website.
          </p>
          <ContactForm email={site.email} />
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="post-h">
        <div className="wrap phi phi-r items-start">
          <div data-reveal>
            <h2 id="post-h" className="h3">
              By post
            </h2>
            <p className="mt-13 max-w-narrow text-ink-2">The two addresses GIO4X has published. For anything time-sensitive, the form or email will reach us sooner than a letter.</p>
          </div>
          <div data-reveal>
            <Offices />
            <p className="mt-21 max-w-measure text-sm text-ink-3">
              No telephone number or support hours are shown because neither has been confirmed for publication. When they are, they will appear here and on the{" "}
              <Link href="/trust/transparency" className="link">
                Transparency
              </Link>{" "}
              page.
            </p>
          </div>
        </div>
      </section>

      <section className="section-quiet hairline" aria-labelledby="safe-h">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Before you write</p>
            <h2 id="safe-h" className="h3 mt-13">
              How to tell a genuine reply from an imitation.
            </h2>
            <SideNote figure={<RegistryMatch />} label="In practice">
              A message that asks for a password or a one-time code is not from GIO4X, whoever it says it is from. How to read a sender’s address is set out on the{" "}
              <Link href="/trust/verify" className="link">
                link verifier
              </Link>{" "}
              page.
            </SideNote>
          </div>
          <ul className="border-t border-line-strong text-ink-2" data-reveal>
            <li className="border-b border-line py-13">GIO4X will never ask for your password or a one-time security code, by email, by message or by telephone.</li>
            <li className="border-b border-line py-13">
              A link that claims to be ours can be checked against the official registry on the{" "}
              <Link href="/trust/verify" className="link">
                link verifier
              </Link>
              .
            </li>
            <li className="border-b border-line py-13">Do not send identity documents or card details through this form. If documents are needed, you will be told how to provide them.</li>
          </ul>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Help", label: "Help & FAQ", note: "The common questions, answered.", href: "/faq" },
          { kind: "Trust", label: "Verify a GIO4X link", note: "Check an address before you trust it.", href: "/trust/verify" },
          { kind: "Help", label: "System status", note: "What is monitored, and what is not.", href: "/status" },
          { kind: "Gateway", label: "Sign in", note: "Client, Trader and IB portals.", href: "/sign-in" },
        ]}
      />
    </>
  );
}
