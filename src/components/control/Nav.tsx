"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/control", label: "Overview", exact: true },
  { href: "/control/leads", label: "Leads", exact: false },
  { href: "/control/subscribers", label: "Subscribers", exact: false },
  { href: "/control/audit", label: "Audit log", exact: false },
] as const;

/**
 * Console navigation. `rail` is the desktop left rail; `bar` is the mobile
 * row under the top bar (it scrolls sideways rather than wrapping).
 * Navigation is a convenience only: every destination checks access itself.
 */
export function ControlNav({ variant }: { variant: "rail" | "bar" }) {
  const pathname = usePathname();
  const isCurrent = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  if (variant === "bar") {
    return (
      <nav aria-label="Control" className="scroll-x">
        <ul className="flex min-w-max gap-5 px-gutter">
          {ITEMS.map((item) => {
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
    <nav aria-label="Control">
      <ul className="grid gap-1">
        {ITEMS.map((item) => {
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
    </nav>
  );
}
