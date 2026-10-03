"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, KeyRound, Boxes, TerminalSquare, Cable, Waves, CandlestickChart,
  Radio, UserCog, Building2, FileBarChart, Server, Activity, Database, Bot,
  ShieldCheck, Cpu, Sun, Moon, LogOut, Gauge, Scale, type LucideIcon,
} from "lucide-react";
import { techSignOut } from "@/lib/tech-hub-actions";
import type { TechModule } from "@/lib/tech-hub-console";
import { TechSearch } from "@/components/tech/TechSearch";
import { withBase } from "@/lib/base-path";

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, KeyRound, Boxes, TerminalSquare, Cable, Waves, CandlestickChart,
  Radio, UserCog, Building2, FileBarChart, Server, Activity, Database, Bot, ShieldCheck, Scale,
};

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-400", beta: "bg-amber-400", roadmap: "bg-slate-500",
};

export function TechShell({
  email, modules, children,
}: {
  email: string; modules: TechModule[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("tech-theme")) as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("tech-theme", theme);
  }, [theme]);

  // Group modules by category, preserving sort order.
  const groups: { name: string; items: TechModule[] }[] = [];
  for (const m of modules) {
    let g = groups.find((x) => x.name === m.category);
    if (!g) { g = { name: m.category, items: [] }; groups.push(g); }
    g.items.push(m);
  }

  return (
    <div className="tech-root" data-theme={theme}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="tech-panel2 flex w-64 shrink-0 flex-col border-r">
          <div className="px-4 py-4">
            <div className="py-1">
              <Image src={withBase("/logo.png")} alt="GIO4X" width={2924} height={976} priority className="h-12 w-auto" />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Cpu size={13} className="tech-accent" />
              <span className="text-[11px] font-semibold">Technology Hub</span>
              <span className="text-[9px] uppercase tracking-[0.18em] tech-muted">Super Admin</span>
            </div>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
            <Link
              href="/tech"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${pathname === "/tech" ? "bg-sky-500/15 tech-accent font-semibold" : "tech-muted hover:bg-white/5"}`}
            >
              <Gauge size={16} /> Command Center
            </Link>
            {groups.map((g) => (
              <div key={g.name}>
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider tech-muted">{g.name}</div>
                <div className="space-y-0.5">
                  {g.items.map((m) => {
                    const Icon = ICONS[m.icon ?? ""] ?? LayoutGrid;
                    const active = pathname === `/tech/${m.key}`;
                    return (
                      <Link
                        key={m.key}
                        href={`/tech/${m.key}`}
                        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active ? "bg-sky-500/15 tech-accent font-semibold" : "tech-muted hover:bg-white/5"} ${!m.enabled ? "opacity-50" : ""}`}
                      >
                        <Icon size={15} />
                        <span className="flex-1 truncate">{m.name}</span>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[m.status] ?? "bg-slate-500"}`} title={m.status} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="tech-panel flex items-center justify-between gap-4 border-b px-5 py-3">
            <TechSearch modules={modules} />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                className="rounded-lg p-2 tech-panel2 tech-border border hover:opacity-80"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium">{email}</div>
                <div className="text-[10px] uppercase tracking-wide tech-muted">Super Admin</div>
              </div>
              <form action={techSignOut}>
                <button type="submit" className="rounded-lg p-2 tech-panel2 tech-border border hover:text-rose-400" title="Sign out">
                  <LogOut size={15} />
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
