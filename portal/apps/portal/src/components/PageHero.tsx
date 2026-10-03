import type { ReactNode } from "react";
import Image from "next/image";
import { withBase } from "@/lib/base-path";

/**
 * PageHero — compact, image-led hero banner for inner pages.
 *
 * Visually continuous with the home `HeroShowcase` (navy-dark base, gold
 * accent, layered readability gradients) but lighter: a single static photo,
 * no rotation, no client JS. Server-component friendly.
 *
 * Height is the site-standard 240px / sm:280px (min-height, so content with
 * `actions` never clips on small screens). Spacing (`mb-6`) matches the
 * `PageHeader` it replaces, so swapping one for the other is layout-neutral.
 */

type PageHeroProps = {
  title: string;
  subtitle?: string;
  /** Path under /public, e.g. "/hero/hero-accounts.jpg". */
  image: string;
  /** Short gold eyebrow above the title. */
  eyebrow?: string;
  /** Decorative photo → empty alt by default. */
  alt?: string;
  /** Optional CTAs / buttons, rendered below the subtitle. */
  actions?: ReactNode;
};

export function PageHero({ title, subtitle, image, eyebrow, alt = "", actions }: PageHeroProps) {
  return (
    <section className="relative mb-6 min-h-[240px] overflow-hidden rounded-glass border border-slate-200 bg-navy-dark sm:min-h-[280px]">
      {/* Background photo */}
      <Image
        src={withBase(image)}
        alt={alt}
        fill
        priority
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover"
      />

      {/* Readability overlays — mirror the home hero. */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-dark/90 via-navy-dark/65 to-navy-dark/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/80 via-transparent to-navy-dark/20" />

      {/* Thin gold rule, perpendicular to the content. */}
      <div className="absolute left-10 top-6 bottom-6 hidden w-px bg-gradient-to-b from-transparent via-[#E2BE5A]/50 to-transparent sm:block" />

      {/* Content */}
      <div className="relative z-10 flex h-full min-h-[240px] flex-col justify-center px-6 py-7 sm:min-h-[280px] sm:px-12">
        <div className="max-w-2xl">
          {eyebrow ? (
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E2BE5A]/40 bg-[#E2BE5A]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E2BE5A] backdrop-blur">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-2xl font-bold leading-[1.15] tracking-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">{subtitle}</p>
          ) : null}
          {actions ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
