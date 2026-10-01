import { Suspense } from "react";
import { SearchResults } from "@/components/company/SearchResults";
import { Breadcrumbs } from "@/components/ui/Page";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Search",
  description: "Search GIO4X: instruments, markets, tools, glossary terms, articles and pages.",
  path: "/search",
  index: false,
});

export default function SearchPage() {
  return (
    <section className="dna-light" aria-labelledby="search-h">
      <div className="wrap pb-89 pt-34 lg:pt-55">
        <Breadcrumbs crumbs={[{ name: "Search", href: "/search" }]} />
        <div className="mt-34 max-w-[62rem]">
          <h1 id="search-h" className="h2">
            Search
          </h1>
          <div className="mt-21">
            <Suspense fallback={<p className="text-sm text-ink-3">Loading search…</p>}>
              <SearchResults />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
