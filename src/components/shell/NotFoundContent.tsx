import Link from "next/link";
import { Rosette } from "@/components/brand/Rosette";
import { NotFoundSuggestions } from "@/components/shell/NotFoundSuggestions";

const routes = [
  { href: "/markets", label: "Markets" },
  { href: "/platforms/raptor", label: "777 Raptor" },
  { href: "/platforms/metatrader-5", label: "MetaTrader 5" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/academy", label: "Academy" },
  { href: "/", label: "Home" },
];

/**
 * 404. A constellation with a blade missing: the coordinate that was asked
 * for is not on the grid. Suggestions come from the site's own index by
 * matching the words in the requested path; nothing from the URL is ever
 * echoed into the page as HTML.
 */
export function NotFoundContent() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="grid-field pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
      <div className="wrap relative grid min-h-[70svh] items-center gap-34 py-55 lg:grid-cols-phi lg:py-89">
        <div>
          <p className="eyebrow">Error 404</p>
          <h1 className="h1 mt-21">This market doesn&rsquo;t exist.</h1>
          <p className="lead mt-21 max-w-[46ch]">The page may have moved, expired, or never traded here. Every market has another route.</p>
          <NotFoundSuggestions />
          <ul className="mt-34 flex flex-wrap gap-x-21 gap-y-8">
            {routes.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="go">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="justify-self-center text-ink-3 lg:justify-self-end">
          <Rosette size={233} blades={7} strokeWidth={1} />
        </div>
      </div>
    </section>
  );
}
