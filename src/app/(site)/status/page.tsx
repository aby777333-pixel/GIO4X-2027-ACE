import Link from "next/link";
import { Rosette } from "@/components/brand/Rosette";
import { NextSteps, PageHero } from "@/components/ui/Page";
import { site } from "@/config/site";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "System status",
  description: "GIO4X system status: the services that would be monitored, each shown honestly as not monitored until monitoring is connected. No uptime figure is published.",
  path: "/status",
});

type Service = { name: string; what: string; state: "reading" | "none"; note: string };

const services: Service[] = [
  { name: "Website", what: "gio4x.com: the pages, tools and search you are using now.", state: "reading", note: "You are reading it" },
  { name: "Client Portal", what: "Profile, verification, funding and account documents.", state: "none", note: "Not monitored" },
  { name: "Trader Portal", what: "Trading accounts and platform access.", state: "none", note: "Not monitored" },
  { name: "IB Portal", what: "For introducing brokers and partners.", state: "none", note: "Not monitored" },
  { name: "777 Raptor", what: "The Raptor trading workspace.", state: "none", note: "Not monitored" },
  { name: "MetaTrader 5 connectivity", what: "Connection between MetaTrader 5 terminals and GIO4X trading servers.", state: "none", note: "Not monitored" },
  { name: "Market data", what: "Reference rates and schedules shown on this site.", state: "none", note: "Not monitored" },
  { name: "Support", what: "The contact form and email.", state: "none", note: "Not monitored" },
];

export default function StatusPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: "System status", href: "/status" }]}
        eyebrow="GIO4X System Status"
        title="Status, without a number we cannot stand behind."
        lead="A status page is only worth reading if a monitor is behind it. None is connected to this page yet, so it shows the architecture and says so."
        quiet
        aside={
          <div className="panel-quiet p-21" role="status">
            <p className="state state-off">Monitoring not connected</p>
            <p className="mt-8 text-sm text-ink-2">
              None of the <span className="num font-medium text-ink">{services.length}</span> services listed below has an automated check reporting to this page. No uptime percentage is published.
            </p>
          </div>
        }
      />

      <section className="section-quiet" aria-labelledby="services-h">
        <div className="wrap">
          <h2 id="services-h" className="sr-only">
            Services
          </h2>
          <ul className="border-t border-line-strong">
            {services.map((s) => (
              <li key={s.name} className="grid gap-x-21 gap-y-5 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)_11rem] md:items-baseline">
                <div className="flex flex-wrap items-baseline justify-between gap-x-13 gap-y-3 md:contents">
                  <h3 className="h4">{s.name}</h3>
                  <p className={`state md:order-3 md:justify-self-end ${s.state === "reading" ? "state-open" : "state-off"}`}>{s.note}</p>
                </div>
                <p className="text-sm text-ink-2 md:order-2">{s.what}</p>
              </li>
            ))}
          </ul>
          <p className="mt-13 flex flex-wrap items-center gap-x-13 gap-y-3 text-xs text-ink-3">
            <span className="chip">Data unavailable</span>
            <span>“Not monitored” means no automated check reports to this page. It is not a statement that a service is up or down.</span>
          </p>
        </div>
      </section>

      <section className="section-quiet hairline bg-paper" aria-labelledby="why-h">
        <div className="wrap phi items-start">
          <div data-reveal>
            <Rosette size={34} blades={5} className="text-ink-3" />
            <h2 id="why-h" className="h3 mt-13">
              Why there is no uptime figure.
            </h2>
            <div className="mt-13 max-w-measure text-ink-2">
              <p>An uptime percentage is a measurement. It needs an independent monitor, a defined period and a record of every interruption. Without those it is only a number chosen to look reassuring, and this page does not print numbers of that kind.</p>
              <p className="mt-13">The “Website” row is the one honest exception: this page reached you, so the website answered at the moment you asked. That is an observation about one request, not a record of availability.</p>
            </div>
          </div>
          <div data-reveal>
            <h2 className="label border-b border-line-strong pb-13">Where an incident would be announced</h2>
            <ul className="text-ink-2">
              <li className="border-b border-line py-13">
                <span className="font-medium text-ink">On this page.</span> A dated notice at the top, stating what is affected and what is not, updated until it is resolved.
              </li>
              <li className="border-b border-line py-13">
                <span className="font-medium text-ink">In What’s new</span>, afterwards, if the incident changed anything on the site.{" "}
                <Link href="/whats-new" className="link">
                  Changelog
                </Link>
              </li>
              <li className="border-b border-line py-13">
                <span className="font-medium text-ink">By email</span>, if you ask. Write to{" "}
                <a href={`mailto:${site.email}`} className="link">
                  {site.email}
                </a>{" "}
                or use the{" "}
                <Link href="/contact?topic=technical" className="link">
                  contact form
                </Link>{" "}
                and say what you are seeing.
              </li>
            </ul>
            <p className="mt-13 text-sm text-ink-3">No incident notices are published at present.</p>
          </div>
        </div>
      </section>

      <NextSteps
        items={[
          { kind: "Help", label: "Contact", note: "Report a problem, topic: Technical.", href: "/contact?topic=technical" },
          { kind: "Trust", label: "Data methodology", note: "What each data label means.", href: "/trust/data-methodology" },
          { kind: "Trust", label: "Transparency", note: "What is published, and what is open.", href: "/trust/transparency" },
          { kind: "Gateway", label: "Sign in", note: "Client, Trader and IB portals.", href: "/sign-in" },
        ]}
      />
    </>
  );
}
