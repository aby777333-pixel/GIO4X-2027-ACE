"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import type { TechModule } from "@/lib/tech-hub-console";

type Entry = { label: string; sub: string; href: string; type: string };

export function TechSearch({ modules }: { modules: TechModule[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const index = useMemo<Entry[]>(() => {
    const e: Entry[] = [
      { label: "Command Center", sub: "Executive dashboard", href: "/tech", type: "Page" },
      { label: "Audit Center", sub: "Logs, search & rollback", href: "/tech/security", type: "Page" },
    ];
    for (const m of modules) {
      e.push({ label: m.name, sub: m.category, href: `/tech/${m.key}`, type: "Module" });
      for (const f of m.features ?? []) e.push({ label: f, sub: m.name, href: `/tech/${m.key}`, type: "Capability" });
    }
    return e;
  }, [modules]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return index
      .filter((x) => x.label.toLowerCase().includes(s) || x.sub.toLowerCase().includes(s) || x.type.toLowerCase().includes(s))
      .slice(0, 12);
  }, [q, index]);

  function go(href: string) { setQ(""); setOpen(false); router.push(href); }

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border tech-border tech-panel2 px-3 py-1.5 text-xs">
        <Search size={14} className="tech-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].href); if (e.key === "Escape") setOpen(false); }}
          placeholder="Search modules, settings, logs…"
          className="w-full bg-transparent outline-none"
        />
      </div>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border tech-border tech-panel shadow-xl">
          {results.length === 0 ? (
            <div className="px-3 py-2.5 text-xs tech-muted">No modules or capabilities match “{q.trim()}”.</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.href}-${r.label}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); go(r.href); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-white/5"
              >
                <span className="min-w-0 truncate"><span className="font-medium">{r.label}</span> <span className="tech-muted">· {r.sub}</span></span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[9px] uppercase tech-muted">{r.type}</span>
                  <ArrowRight size={11} className="tech-muted" />
                </span>
              </button>
            ))
          )}
          <button
            onMouseDown={(e) => { e.preventDefault(); go("/tech/security"); }}
            className="flex w-full items-center gap-2 border-t tech-border px-3 py-2 text-left text-[11px] tech-muted hover:bg-white/5"
          >
            <Search size={11} /> Search audit logs for “{q.trim()}” in the Audit Center
          </button>
        </div>
      )}
    </div>
  );
}
