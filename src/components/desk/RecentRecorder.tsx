"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { notePage, noteSearch, readRecent } from "./store";

/**
 * Keeps the "recently viewed" list for My desk, and only when the visitor has
 * switched that list on there. While the gx:recent key does not exist this
 * component reads one value from storage per page and writes nothing.
 *
 * A page is noted once it has been open for a moment (a page passed through
 * on the way to another is not), by its path and its title: never a query
 * string. A search is noted from the search page once the same words have
 * stood in the address for two checks in a row, so half-typed text is not kept.
 * Renders nothing.
 */
export function RecentRecorder() {
  const pathname = usePathname();

  useEffect(() => {
    if (!readRecent()) return;
    const page = window.setTimeout(() => {
      const title = document.title.split(" | ")[0];
      notePage(pathname, title);
    }, 1600);

    let poll = 0;
    if (pathname === "/search") {
      let seen = "";
      let noted = "";
      poll = window.setInterval(() => {
        const q = (new URLSearchParams(window.location.search).get("q") ?? "").trim();
        if (q && q === seen && q !== noted) {
          noteSearch(q);
          noted = q;
        }
        seen = q;
      }, 1600);
    }
    return () => {
      window.clearTimeout(page);
      window.clearInterval(poll);
    };
  }, [pathname]);

  return null;
}
