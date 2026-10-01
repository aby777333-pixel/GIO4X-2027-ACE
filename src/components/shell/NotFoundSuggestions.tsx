"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSearchIndex, openCommandBar } from "@/components/shell/CommandBar";
import { search, type SearchHit } from "@/lib/search";

/**
 * "Were you looking for…?" Words from the requested path are matched against
 * the site index. Only internal, existing destinations are ever suggested and
 * the path itself is never rendered.
 */
export function NotFoundSuggestions() {
  const pathname = usePathname();
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    const words = pathname
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length >= 3)
      .slice(0, 6);
    if (!words.length) return;
    let alive = true;
    loadSearchIndex()
      .then((index) => {
        if (!alive) return;
        const seen = new Set<string>();
        const out: SearchHit[] = [];
        for (const w of words.reverse()) {
          for (const h of search(index, w, { limit: 3 })) {
            if (!seen.has(h.h)) {
              seen.add(h.h);
              out.push(h);
            }
          }
        }
        setHits(out.sort((a, b) => b.score - a.score).slice(0, 4));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <div className="mt-34">
      {hits.length > 0 && (
        <div className="mb-21">
          <p className="label">Were you looking for</p>
          <ul className="mt-8 grid gap-2">
            {hits.map((h) => (
              <li key={h.h}>
                <Link href={h.h} className="link text-md">
                  {h.t}
                </Link>
                <span className="ml-8 text-xs text-ink-3">{h.g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => openCommandBar()}>
        Search GIO4X
      </button>
    </div>
  );
}
