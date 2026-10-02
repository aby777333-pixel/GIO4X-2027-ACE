"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { nav } from "@/config/nav";
import { Logo } from "@/components/brand/Logo";
import { AppearanceButton } from "@/components/shell/Appearance";
import { openCommandBar } from "@/components/shell/CommandBar";
import { LensButton } from "@/components/shell/Lens";
import { NavGlyph, panelLight, rowFx } from "@/components/shell/nav-glyphs";

/** Which URL prefixes belong to which primary section (a page is "in" exactly one). */
const SECTION_PREFIXES: Record<string, string[]> = {
  markets: ["/markets"],
  trading: ["/trading", "/partners", "/tools"],
  platforms: ["/platforms"],
  intelligence: ["/intelligence", "/morning-room", "/labs"],
  academy: ["/academy", "/glossary", "/faq"],
  company: ["/about", "/careers", "/media", "/contact", "/trust", "/legal", "/design", "/status"],
};

/**
 * Institutional navigation.
 * - lightweight over the hero, becomes glass with a hairline once the page moves
 * - mega-menu opens on hover intent, click, or keyboard; Escape closes and restores focus
 * - below `lg` the same structure becomes a full-height drawer with disclosure groups
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [drawerGroup, setDrawerGroup] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const openTimer = useRef<number | undefined>(undefined);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close everything on navigation
  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) {
          const btn = headerRef.current?.querySelector<HTMLButtonElement>(`[data-nav="${open}"]`);
          setOpen(null);
          btn?.focus();
        }
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawer]);

  const intentOpen = useCallback((key: string) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(key), 100);
  }, []);
  const intentClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  }, []);

  const active = nav.find((s) => s.key === open);
  const solid = scrolled || !!open || drawer;
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <>
    <header
      ref={headerRef}
      data-site-header
      className={`fixed inset-x-0 top-0 z-header transition-[background-color,border-color,box-shadow] duration-slow ${
        solid ? "glass border-b border-line" : "border-b border-transparent"
      }`}
      onMouseLeave={intentClose}
    >
      <a
        href="#main"
        className="sr-only-focusable absolute left-gutter top-8 z-toast rounded-sm bg-ink px-13 py-8 text-sm font-semibold text-bg"
      >
        Skip to content
      </a>

      <div className={`wrap flex items-center gap-21 transition-[height] duration-slow ${scrolled ? "h-[3.4375rem]" : "h-[4.25rem]"}`}>
        <Logo height={scrolled ? 28 : 34} className="shrink-0 transition-opacity duration-fast hover:opacity-80" />

        <nav aria-label="Primary" className="ml-13 hidden lg:block">
          <ul className="flex items-center">
            {nav.map((s) => {
              const current = (SECTION_PREFIXES[s.key] ?? [s.href]).some((p) => isCurrent(p));
              return (
                <li key={s.key} onMouseEnter={() => intentOpen(s.key)}>
                  <button
                    type="button"
                    data-nav={s.key}
                    aria-expanded={open === s.key}
                    aria-controls={`mega-${s.key}`}
                    onClick={() => setOpen(open === s.key ? null : s.key)}
                    className={`relative flex h-[2.75rem] items-center px-13 text-[0.8125rem] font-medium tracking-[0.04em] transition-colors duration-fast ${
                      open === s.key || current ? "text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {s.label}
                    <span
                      aria-hidden
                      className={`absolute inset-x-13 bottom-[0.4rem] h-px origin-left bg-accent transition-transform duration-[260ms] ${
                        open === s.key ? "scale-x-100" : current ? "scale-x-[0.382]" : "scale-x-0"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <button
            type="button"
            onClick={() => openCommandBar()}
            className="btn btn-quiet hidden h-[2.125rem] gap-8 normal-case tracking-normal sm:inline-flex"
            aria-label="Search GIO4X (Control K)"
          >
            <SearchIcon />
            <span className="hidden text-[0.8125rem] font-medium xl:inline">Search</span>
            <kbd className="hidden rounded-xs border border-line px-5 text-[0.6875rem] font-medium text-ink-3 xl:inline">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => openCommandBar()} className="btn btn-quiet h-[2.125rem] px-8 sm:hidden" aria-label="Search GIO4X">
            <SearchIcon />
          </button>
          <LensButton />
          <AppearanceButton />
          <Link href="/sign-in" className="btn btn-quiet btn-sm hidden md:inline-flex">
            Sign in
          </Link>
          <Link href="/open-account" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Open account
          </Link>
          <button
            type="button"
            className="btn btn-quiet h-[2.125rem] px-8 lg:hidden"
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            aria-controls="site-drawer"
            onClick={() => setDrawer((d) => !d)}
          >
            <span aria-hidden className="relative block h-[13px] w-[21px]">
              <span className={`absolute left-0 top-0 h-px w-full bg-current transition-transform duration-[260ms] ${drawer ? "translate-y-[6px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[6px] h-px w-[61.8%] bg-current transition-opacity duration-fast ${drawer ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-[12px] h-px w-full bg-current transition-transform duration-[260ms] ${drawer ? "-translate-y-[6px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {/* mega-menu (desktop) */}
      <div
        className={`mg-panel absolute inset-x-0 top-full hidden overflow-hidden border-b border-line bg-paper shadow-2 transition-[opacity,visibility,transform] duration-[260ms] lg:block ${
          active ? "visible translate-y-0 opacity-100" : "invisible -translate-y-5 opacity-0"
        }`}
        onMouseEnter={() => window.clearTimeout(closeTimer.current)}
        onPointerMove={panelLight}
      >
        {nav.map((s, si) => (
          <div key={s.key} id={`mega-${s.key}`} hidden={open !== s.key} className="wrap grid grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] gap-55 py-34">
            <div className="border-r border-line pr-55">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-13 max-w-narrow font-display text-xl font-light leading-snug text-ink">{s.blurb}</p>
              <Link href={s.href} className="go mt-21">
                {s.label} overview
              </Link>
            </div>
            <div className="grid gap-34" style={{ gridTemplateColumns: `repeat(${s.groups.length}, minmax(0, 1fr))` }}>
              {s.groups.map((g, gi) => (
                <div key={g.title} data-mg-fx={rowFx(si, gi)}>
                  <p className="label">{g.title}</p>
                  <ul className="mt-13 grid gap-2">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        {/* the row's glyph and its hover treatment live in nav-glyphs.tsx and styles/menu.css */}
                        <Link
                          href={i.href}
                          className="mg-row group -mx-8 flex items-start gap-8 rounded-sm px-8 py-[0.4rem]"
                          aria-current={pathname === i.href ? "page" : undefined}
                        >
                          <NavGlyph href={i.href} section={s.key} />
                          <span className="mg-text">
                            <span className="mg-label text-[0.9375rem] font-medium text-ink">{i.label}</span>
                            {i.note && <span className="mg-note block text-xs text-ink-3">{i.note}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </header>

      {/* drawer (mobile / tablet). A sibling of the header, not a child: the header's
          backdrop-filter would otherwise become the containing block of this fixed panel. */}
      <div
        id="site-drawer"
        hidden={!drawer}
        className="fixed inset-x-0 bottom-0 top-[3.4375rem] z-header overflow-y-auto overscroll-contain border-t border-line bg-bg lg:hidden"
      >
        <nav aria-label="Primary mobile" className="wrap pb-55 pt-13">
          <ul>
            {nav.map((s) => {
              const expanded = drawerGroup === s.key;
              return (
                <li key={s.key} className="border-b border-line">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-[1.05rem] text-left"
                    aria-expanded={expanded}
                    onClick={() => setDrawerGroup(expanded ? null : s.key)}
                  >
                    <span className="font-display text-xl font-light">{s.label}</span>
                    <span aria-hidden className={`relative h-[13px] w-[13px] transition-transform duration-[260ms] ${expanded ? "rotate-45" : ""}`}>
                      <span className="absolute left-0 top-1/2 h-px w-full bg-ink-2" />
                      <span className="absolute left-1/2 top-0 h-full w-px bg-ink-2" />
                    </span>
                  </button>
                  {expanded && (
                    <div className="grid gap-21 pb-21">
                      <Link href={s.href} className="go">
                        {s.label} overview
                      </Link>
                      {s.groups.map((g) => (
                        <div key={g.title}>
                          <p className="label">{g.title}</p>
                          <ul className="mt-8">
                            {g.items.map((i, ii) => (
                              <li key={i.href}>
                                <Link href={i.href} className="flex items-center gap-8 py-[0.45rem] text-base text-ink-2">
                                  <NavGlyph href={i.href} section={s.key} once={ii} />
                                  {i.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-34 grid grid-cols-2 gap-13">
            <Link href="/sign-in" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/open-account" className="btn btn-primary">
              Open account
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.25" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
