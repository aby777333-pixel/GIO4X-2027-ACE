"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/components/control/nav-items";

/**
 * Console navigation. `rail` is the desktop left rail, grouped by section;
 * `bar` is the mobile row under the top bar (it scrolls sideways rather than
 * wrapping). Navigation is a convenience only: every destination checks access
 * itself.
 */
export function ControlNav({ variant, sections }: { variant: "rail" | "bar"; sections: NavSection[] }) {
  const pathname = usePathname();
  const isCurrent = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  if (variant === "bar") {
    return (
      <nav aria-label="Control" className="scroll-x">
        <ul className="flex min-w-max gap-5 px-gutter">
          {sections
            .flatMap((section) => section.items)
            .map((item) => {
              const current = isCurrent(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex h-[2.75rem] items-center border-b-2 px-8 text-sm transition-colors duration-fast ${
                      current ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Control" className="min-h-0 flex-1 overflow-y-auto pb-13">
      {sections.map((section, i) => (
        <div key={section.label} className={i > 0 ? "mt-13" : ""}>
          <p className="label px-21 pb-5">{section.label}</p>
          <ul className="grid gap-1">
            {section.items.map((item) => {
              const current = isCurrent(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex h-[2.75rem] items-center border-l-2 px-21 text-sm transition-colors duration-fast ${
                      current ? "border-accent bg-brand-soft font-medium text-ink" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
