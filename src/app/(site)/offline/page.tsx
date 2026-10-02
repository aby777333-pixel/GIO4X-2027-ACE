import Link from "next/link";
import { OfflineList } from "@/components/desk/OfflineList";
import { Breadcrumbs } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Offline",
  description: "Shown when there is no connection: the GIO4X tools and pages that are kept in your browser and still open, and what needs a connection.",
  path: "/offline",
  index: false,
});

/**
 * The page the offline worker (public/sw.js) shows when a page is asked for
 * with no connection and no copy of it is kept. It is itself kept in the
 * browser when the worker installs, so it is deliberately plain: no data, no
 * canvas, nothing that needs the network.
 */
const NEEDS_CONNECTION = [
  { t: "Pages you have not opened before", d: "Only the tools, and pages you have already opened with a connection, are kept in this browser." },
  { t: "Charts, calendars and quote panels", d: "They are TradingView’s own pages and load from TradingView." },
  { t: "Reference rates newer than the copy", d: "A kept tool converts with the ECB fixing it was saved with, and shows that fixing’s date. It is not refreshed until you are connected." },
  { t: "Search, the command bar and the Lens", d: "They load the site’s index when first used." },
  { t: "Contact forms, support requests and live chat", d: "They are sent to GIO4X, which needs a connection. Nothing is queued for later." },
  { t: "System status and your support requests", d: "Both are read from GIO4X at the time you open them, so they are never shown from a copy." },
];

export default function OfflinePage() {
  return (
    <section className="dna-light" aria-labelledby="offline-h">
      <div className="wrap pb-89 pt-34 lg:pt-55">
        <Breadcrumbs crumbs={[{ name: "Offline", href: "/offline" }]} />
        <div className="mt-34 max-w-[62rem]">
          <h1 id="offline-h" className="h2">
            You are offline.
          </h1>
          <p className="lead mt-13 max-w-[58ch]">This page is kept in your browser so that something useful is here when there is no connection. The calculators work without one: their arithmetic runs on this device.</p>

          <div className="mt-34">
            <h2 className="h3">Available now</h2>
            <div className="mt-21">
              <OfflineList />
            </div>
          </div>

          <div className="mt-55">
            <h2 className="h3">Needs a connection</h2>
            <dl className="mt-21 border-t border-line-strong">
              {NEEDS_CONNECTION.map((n) => (
                <div key={n.t} className="grid gap-x-21 gap-y-3 border-b border-line py-13 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]">
                  <dt className="text-[0.9375rem] font-medium text-ink">{n.t}</dt>
                  <dd className="text-sm text-ink-2">{n.d}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-21 max-w-measure text-sm text-ink-3">
              The copy lives in this browser’s cache storage and is sent nowhere. It can be removed, or switched off, under{" "}
              <Link href="/preferences#offline" className="link">
                Display &amp; privacy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
