"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { TERMINAL_URL } from "@/lib/constants";
import { withBase } from "@/lib/base-path";

/**
 * HeroShowcase — image-led hero for the portal home page.
 *
 * - Cycles through the brand photo set in a RANDOM (client-shuffled) order as a
 *   full-bleed background, crossfading between frames.
 * - Inspiring headlines + captions + CTAs rotate alongside the imagery.
 * - A gold caption runs vertically down the left edge, perpendicular to the
 *   horizontal GIO4X logo, in a contrasting colour over the photography.
 *
 * Hydration-safe: the first server + client render use the deterministic
 * default order/slide (index 0). Shuffling and rotation only start in an
 * effect AFTER hydration, so the SSR HTML and first client render match.
 */

// Files live in /public/hero. Keep this list in sync with that folder.
const HERO_IMAGES = [
  "gio4x6.png",
  "gio4x7.png",
  "gio4x8.png",
  "gio4x9.png",
  "gio4x10.png",
  "gio4x11.png",
  "gio4x12.png",
  "gio13.png",
  "gio4x14.png",
  "gio4x15.png",
  "gio4x17.png",
  "gio4x18.png",
  "gio4x19.png",
  "gio4x20.png",
  "gio4x21.png",
  "gio4x22.png",
  "gio4x23.png",
];

type Cta = { label: string; href: string; external?: boolean };

type Slide = {
  eyebrow: string; // vertical caption, perpendicular to the logo
  title: string;
  subtitle: string;
  primary: Cta;
  secondary: Cta;
};

const SLIDES: Slide[] = [
  {
    eyebrow: "Precision Trading",
    title: "Trade the world with institutional precision.",
    subtitle:
      "FX, metals, indices, crypto and CFDs — one Trader Area, powered by the GIO Raptor execution engine.",
    primary: { label: "Open an Account", href: "/auth/signup" },
    secondary: { label: "Launch Terminal", href: TERMINAL_URL, external: true },
  },
  {
    eyebrow: "Built for Serious Traders",
    title: "Where ambition meets execution.",
    subtitle:
      "Sub-millisecond order routing, deep liquidity, and spreads from 0.0 pips — the edge serious traders demand.",
    primary: { label: "Fund Your Account", href: "/deposits" },
    secondary: { label: "Explore Accounts", href: "/accounts" },
  },
  {
    eyebrow: "Your Edge, Amplified",
    title: "Markets never sleep. Neither does your edge.",
    subtitle:
      "RAPTOR AI insight, live charts, and 500+ instruments — every opportunity, right at your fingertips.",
    primary: { label: "Start Copy Trading", href: "/copy" },
    secondary: { label: "Launch Terminal", href: TERMINAL_URL, external: true },
  },
  {
    eyebrow: "The Gentleman's Broker",
    title: "Refined trading. Relentless performance.",
    subtitle:
      "Swap-free accounts, instant funding, and 24/7 human support — trading the way it should be.",
    primary: { label: "Open an Account", href: "/auth/signup" },
    secondary: { label: "View Promotions", href: "/promotions" },
  },
  {
    eyebrow: "Start in Minutes",
    title: "Open. Fund. Trade.",
    subtitle:
      "From sign-up to your first position in under five minutes. Your journey to the markets starts here.",
    primary: { label: "Deposit Now", href: "/deposits" },
    secondary: { label: "Become an IB", href: "/ib" },
  },
];

const ROTATE_MS = 6000;

function CtaButton({ cta, primary }: { cta: Cta; primary: boolean }) {
  const className = primary
    ? "inline-flex items-center gap-1.5 rounded-lg bg-sky px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky/20 transition hover:bg-sky-light"
    : "inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:border-white/60 hover:bg-white/20";
  const icon = primary ? <ArrowRight size={14} /> : cta.external ? <ExternalLink size={13} /> : null;

  if (cta.external) {
    return (
      <Link href={cta.href} target="_blank" rel="noreferrer" className={className}>
        {cta.label}
        {icon}
      </Link>
    );
  }
  return (
    <Link href={cta.href} className={className}>
      {cta.label}
      {icon}
    </Link>
  );
}

export function HeroShowcase() {
  // `order` is the (eventually shuffled) sequence of image indices.
  // `pos` is our position within that order. Both start deterministic for SSR.
  const [order, setOrder] = useState<number[]>(() => HERO_IMAGES.map((_, i) => i));
  const [pos, setPos] = useState(0);
  // Track which positions have been shown so we only mount images on demand.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fisher–Yates shuffle — runs only on the client, after hydration.
    const shuffled = HERO_IMAGES.map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);

    timer.current = setInterval(() => {
      setPos((p) => {
        const next = (p + 1) % shuffled.length;
        setMounted((seen) => {
          if (seen.has(next)) return seen;
          const copy = new Set(seen);
          copy.add(next);
          return copy;
        });
        return next;
      });
    }, ROTATE_MS);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const slide = SLIDES[pos % SLIDES.length];

  return (
    <section className="relative mb-6 min-h-[240px] overflow-hidden rounded-glass border border-slate-200 bg-navy-dark sm:min-h-[280px]">
      {/* ─── Rotating photography (crossfade) ─── */}
      {order.map((imgIdx, i) =>
        mounted.has(i) ? (
          <Image
            key={HERO_IMAGES[imgIdx]}
            src={withBase(`/hero/${HERO_IMAGES[imgIdx]}`)}
            alt=""
            fill
            priority={i === 0}
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === pos ? 1 : 0 }}
          />
        ) : null
      )}

      {/* ─── Readability overlays ─── */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-dark/90 via-navy-dark/65 to-navy-dark/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/80 via-transparent to-navy-dark/30" />

      {/* ─── Vertical caption — perpendicular to the logo, contrasting gold ─── */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 hidden w-12 items-center justify-center sm:flex">
        <span
          className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.35em] text-[#E2BE5A] drop-shadow"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {slide.eyebrow}
        </span>
      </div>
      <div className="absolute left-12 top-6 bottom-6 hidden w-px bg-gradient-to-b from-transparent via-[#E2BE5A]/50 to-transparent sm:block" />

      {/* ─── Content ─── */}
      <div className="relative z-10 flex h-full min-h-[240px] flex-col justify-center px-6 py-8 sm:min-h-[280px] sm:pl-20 sm:pr-10">
        <div className="max-w-2xl">
          <Image
            src={withBase("/logo.png")}
            alt="GIO4X"
            width={2924}
            height={976}
            priority
            className="mb-6 h-8 w-auto drop-shadow-lg"
          />
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E2BE5A]/40 bg-[#E2BE5A]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E2BE5A] backdrop-blur sm:hidden">
            {slide.eyebrow}
          </div>
          <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-md sm:text-4xl lg:text-5xl">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            {slide.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <CtaButton cta={slide.primary} primary />
            <CtaButton cta={slide.secondary} primary={false} />
          </div>
        </div>
      </div>

      {/* ─── Slide indicator ─── */}
      <div className="absolute bottom-5 right-6 z-10 flex items-center gap-1.5">
        {SLIDES.map((s, i) => (
          <span
            key={s.eyebrow}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === pos % SLIDES.length ? 20 : 8,
              backgroundColor: i === pos % SLIDES.length ? "#E2BE5A" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
