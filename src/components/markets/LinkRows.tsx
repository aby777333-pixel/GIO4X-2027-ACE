import Link from "next/link";
import type { Resolved } from "./graph";

/**
 * Related items as typographic rows: a hairline, a title, one line of context.
 * Used wherever a page points into the rest of the site (tools, glossary,
 * events, banks). Rows, not cards.
 */
export function LinkRows({ items, showKind = false, className = "" }: { items: Resolved[]; showKind?: boolean; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={`border-t border-line-strong ${className}`}>
      {items.map((r) => (
        <li key={r.id} className="border-b border-line">
          <Link href={r.href} className="group grid min-h-[2.75rem] grid-cols-[1fr_auto] items-baseline gap-x-21 gap-y-2 py-13 transition-colors duration-fast hover:bg-[var(--brand-soft)]">
            <span>
              {showKind && <span className="label mb-2 block">{r.kind}</span>}
              <span className="block font-medium text-ink transition-colors duration-fast group-hover:text-accent">{r.label}</span>
              {r.note && <span className="mt-2 block text-sm text-ink-3">{r.note}</span>}
            </span>
            <span className="go self-center" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The same links, set inline: for dense places such as the Market DNA block. */
export function InlineLinks({ items, empty = "None recorded" }: { items: Resolved[]; empty?: string }) {
  if (!items.length) return <span className="text-ink-3">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-x-13 gap-y-3">
      {items.map((r) => (
        <Link key={r.id} href={r.href} className="link inline-flex min-h-[2.75rem] items-center md:min-h-[1.625rem]" title={r.note}>
          {r.label}
        </Link>
      ))}
    </span>
  );
}

/** A labelled column of related rows, used in three- and four-up "related" bands. */
export function RelatedColumn({ label, items, more }: { label: string; items: Resolved[]; more?: { href: string; label: string } }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="label">{label}</h3>
      <LinkRows items={items} className="mt-13" />
      {more && (
        <Link href={more.href} className="go mt-8 py-13 md:mt-21 md:py-0">
          {more.label}
        </Link>
      )}
    </div>
  );
}
