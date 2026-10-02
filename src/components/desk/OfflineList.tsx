"use client";

import { useEffect, useState } from "react";
import { keptPages, type KeptPage } from "./offline";

/**
 * The /offline page's live part: whether the browser reports a connection,
 * the page that was asked for, and the pages that are kept in this browser
 * and will open without one. Read from cache storage after mount.
 *
 * Plain <a> links, not the router's: a full navigation is what the offline
 * worker answers from its copy.
 */
const SITE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/%]{0,300}$/;

function Group({ title, items, empty }: { title: string; items: KeptPage[]; empty: string }) {
  return (
    <div>
      <h3 className="label">
        {title} {items.length > 0 && <span className="num font-normal">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-8 border-t border-line-strong">
          {items.map((p) => (
            <li key={p.h} className="border-b border-line">
              <a href={p.h} className="flex min-h-[2.75rem] items-center py-8 text-[0.9375rem] font-medium text-ink transition-colors duration-fast [overflow-wrap:anywhere] hover:text-accent">
                {p.t}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OfflineList() {
  const [pages, setPages] = useState<KeptPage[] | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [wanted, setWanted] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    keptPages().then((p) => alive && setPages(p));
    const sync = () => setOnline(navigator.onLine);
    sync();
    // the worker sends the visitor here with the path they asked for in the fragment
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (SITE_PATH.test(hash) && hash !== "/offline") setWanted(hash);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const list = (pages ?? []).filter((p) => p.h !== "/offline");
  const tools = list.filter((p) => p.h.startsWith("/tools/"));
  const terms = list.filter((p) => p.h.startsWith("/glossary/"));
  const others = list.filter((p) => !p.h.startsWith("/tools/") && !p.h.startsWith("/glossary/"));

  return (
    <div className="grid gap-34">
      <div className="panel-quiet p-21" role="status" aria-live="polite">
        <p className="label">Connection</p>
        <p className="mt-5 text-ink">{online === null ? "…" : online ? "Your browser reports a connection." : "Your browser reports no connection."}</p>
        {wanted && (
          <p className="mt-13 text-sm text-ink-2">
            You asked for <span className="font-medium text-ink [overflow-wrap:anywhere]">{wanted}</span>, which is not kept in this browser.{" "}
            <a href={wanted} className="link">
              Try again
            </a>
          </p>
        )}
      </div>

      {pages === null ? (
        <p className="text-sm text-ink-3">Reading what is kept in this browser…</p>
      ) : list.length === 0 ? (
        <p className="max-w-measure text-sm text-ink-2">No offline copy is kept in this browser at the moment, so no page will open without a connection. A copy is made a few seconds after a page loads, unless it has been switched off in the preferences.</p>
      ) : (
        <div className="grid gap-34 md:grid-cols-2">
          <Group title="Tools" items={tools} empty="No tools are kept." />
          <div className="grid content-start gap-34">
            <Group title="Glossary terms you have opened" items={terms} empty="None yet. A term is kept once you have opened it with a connection." />
            <Group title="Other pages you have opened" items={others} empty="None yet." />
          </div>
        </div>
      )}
    </div>
  );
}
