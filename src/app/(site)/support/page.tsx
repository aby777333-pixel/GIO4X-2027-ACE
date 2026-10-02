import Link from "next/link";
import { CheckRequest } from "@/components/support/CheckRequest";
import { OpenRequest } from "@/components/support/OpenRequest";
import { SupportDesk } from "@/components/support/SupportDesk";
import { NextSteps, PageHero, SectionHead } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL } from "@/lib/server/constants";

export const metadata = pageMeta({
  title: "Support",
  description: "Open a support request with GIO4X and follow it on the same page. You are given a reference; with it and your email address you can read our reply and answer it.",
  path: "/support",
});

const categories = TICKET_CATEGORIES.map((key) => ({ key, label: TICKET_CATEGORY_LABEL[key] }));

export default function SupportPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "Support", href: "/support" }]}
        eyebrow="Support"
        title="Ask for help, and follow it here."
        lead="Open a request and you are given a reference. Come back with that reference and your email address to read our reply and answer it. Nothing is sent to your inbox: the conversation stays on this page."
        quiet
      >
        <a href="#open" className="btn btn-primary">
          Open a request
        </a>
        <a href="#check" className="btn btn-ghost">
          Check a request
        </a>
      </PageHero>

      <noscript>
        <div className="wrap py-21">
          <p className="max-w-measure text-sm text-ink-2">
            The two forms on this page need JavaScript. Without it, you can write to{" "}
            <a href={`mailto:${site.email}`} className="link">
              {site.email}
            </a>
            .
          </p>
        </div>
      </noscript>

      <SupportDesk>
        <section id="open" className="section-quiet scroll-mt-89" aria-labelledby="open-h">
          <div className="wrap">
            <SectionHead
              eyebrow="New"
              title={<span id="open-h">Open a request</span>}
              lead={
                <>
                  For a problem to solve on an account you already hold, or anything that needs following up. For a general question, the{" "}
                  <Link href="/contact" className="link">
                    contact form
                  </Link>{" "}
                  is the right place.
                </>
              }
            />
            <div className="mt-34">
              <OpenRequest categories={categories} email={site.email} />
            </div>
          </div>
        </section>

        <section id="check" className="section-quiet hairline scroll-mt-89 bg-paper" aria-labelledby="check-h">
          <div className="wrap">
            <SectionHead eyebrow="Existing" title={<span id="check-h">Check a request</span>} lead="Enter the reference you were shown and the email address you gave. You will see the request, our replies, and a box to answer." />
            <div className="mt-34">
              <CheckRequest categories={categories} />
            </div>
          </div>
        </section>
      </SupportDesk>

      <section className="section-quiet hairline" aria-labelledby="safe-h">
        <div className="wrap phi items-start">
          <div data-reveal>
            <p className="eyebrow">Before you write</p>
            <h2 id="safe-h" className="h3 mt-13">
              What to leave out, and what to keep.
            </h2>
          </div>
          <ul className="border-t border-line-strong text-ink-2" data-reveal>
            <li className="border-b border-line py-13">GIO4X will never ask for your password or a one-time security code, here or anywhere else. Do not put either in a request.</li>
            <li className="border-b border-line py-13">Do not send identity documents or card details through this page. If documents are needed, you will be told how to provide them.</li>
            <li className="border-b border-line py-13">Keep your reference. It is the only way back to your request: this website cannot email it to you, and a request cannot be found by email address alone.</li>
          </ul>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Help", label: "Help & FAQ", note: "The common questions, answered.", href: "/faq" },
          { kind: "Help", label: "System status", note: "What is monitored, and what is not.", href: "/status" },
          { kind: "Company", label: "Contact", note: "General questions, routed by topic.", href: "/contact" },
          { kind: "Trust", label: "Verify a GIO4X link", note: "Check an address before you trust it.", href: "/trust/verify" },
        ]}
      />
    </>
  );
}
