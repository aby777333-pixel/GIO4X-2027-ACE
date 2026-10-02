"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/control/icons";
import { LookSwitch } from "@/components/control/LookSwitch";
import type { NavEntry } from "@/components/control/nav-items";

function useCurrent() {
  const pathname = usePathname();
  return { pathname, isCurrent: (item: NavEntry) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)) };
}

function Items({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const { isCurrent } = useCurrent();
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const current = isCurrent(item);
        return (
          <li key={item.key}>
            <Link href={item.href} aria-current={current ? "page" : undefined} onClick={onNavigate} className={`gxc-nav-item ${current ? "is-current" : ""} ${item.soon ? "is-soon" : ""}`}>
              <Icon name={item.icon} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.soon && <span className="gxc-soon">Soon</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Console navigation: the sidebar's list from `lg` up. Navigation is a
 * convenience only: every destination checks access itself.
 */
export function ControlNav({ items }: { items: NavEntry[] }) {
  return (
    <nav aria-label="Control" className="gxc-scroll mt-13 min-h-0 flex-1 overflow-y-auto px-13 pb-8">
      <Items items={items} />
    </nav>
  );
}

/**
 * Below `lg`: a menu button in the top bar that opens the same list as a
 * sheet, with the look switcher above it. It closes when a destination is
 * chosen, on Escape, and whenever the path changes.
 */
export function ControlMenu({ items }: { items: NavEntry[] }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useCurrent();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="gxc-menu-button" aria-expanded={open} aria-controls="gxc-menu" onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? "close" : "menu"} size={20} />
        <span className="sr-only">{open ? "Close the menu" : "Open the menu"}</span>
      </button>
      {open && (
        <div id="gxc-menu" className="gxc-sheet gxc-scroll">
          {/* above the list, not below it: the list is long, and its foot is a long way down on a phone */}
          <div className="gxc-sheet-look">
            <LookSwitch />
          </div>
          <nav aria-label="Control">
            <Items items={items} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
