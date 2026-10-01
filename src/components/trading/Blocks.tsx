import Link from "next/link";
import type { ReactNode } from "react";
import { NotPublished } from "@/components/platforms/FactState";
import { site } from "@/config/site";

/** Numbered typographic rows with hairlines: the house alternative to a card grid. */
/** Pass `reveal={false}` when the list sits in the first viewport, where the scroll reveal can run before hydration. */
export function NumberedRows({ items, as = "ol", reveal = true }: { items: { title: string; body?: string }[]; as?: "ol" | "ul"; reveal?: boolean }) {
  const List = as;
  return (
    <List className="border-t border-line-strong">
      {items.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[2.75rem_1fr] gap-x-13 border-b border-line py-21 sm:grid-cols-[3.4375rem_1fr]" {...(reveal ? { "data-reveal": true, style: { ["--i" as string]: Math.min(i, 6) } } : {})}>
          <span className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h3 className="h4">{s.title}</h3>
            {s.body && <p className="mt-5 max-w-measure text-sm text-ink-2">{s.body}</p>}
          </div>
        </li>
      ))}
    </List>
  );
}

/** Risks set as a two-column ledger: the name of the risk, then what it means. */
export function RiskLedger({ items }: { items: { title: string; body: string }[] }) {
  return (
    <dl className="border-t border-line-strong">
      {items.map((r, i) => (
        <div key={r.title} className="grid gap-x-34 gap-y-5 border-b border-line py-21 md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]" data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
          <dt className="h4 flex items-baseline gap-13">
            <span aria-hidden className="mt-[0.55em] h-px w-13 shrink-0 bg-neg" />
            {r.title}
          </dt>
          <dd className="text-ink-2">{r.body}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Questions to ask before participating, set large enough to be read slowly. */
export function Questions({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-x-55 md:grid-cols-2">
      {items.map((q, i) => (
        <li key={q} className="grid grid-cols-[2.125rem_1fr] gap-x-8 border-t border-line py-21" data-reveal style={{ ["--i" as string]: Math.min(i, 6) }}>
          <span className="num pt-[0.3rem] text-xs font-semibold text-ink-3">{i + 1}</span>
          <p className="font-display text-lg leading-snug text-ink">{q}</p>
        </li>
      ))}
    </ol>
  );
}

/** Facts the owner has not confirmed: listed by name, each in the "Not yet published" state. */
export function PendingList({ items, className = "" }: { items: (string | { label: string; why?: string })[]; className?: string }) {
  return (
    <ul className={`border-t border-line-strong ${className}`}>
      {items.map((it) => {
        const label = typeof it === "string" ? it : it.label;
        const why = typeof it === "string" ? undefined : it.why;
        return (
          <li key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-21 border-b border-line py-13">
            <span>
              <span className="block text-[0.9375rem] font-medium text-ink">{label}</span>
              {why && <span className="block text-sm text-ink-3">{why}</span>}
            </span>
            <NotPublished />
          </li>
        );
      })}
    </ul>
  );
}

/** Statements GIO4X has published consistently, each marked as such. */
export function AgreedList({ items }: { items: string[] }) {
  return (
    <ul className="border-t border-line-strong">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[1.3125rem_1fr] gap-x-8 border-b border-line py-13 text-[0.9375rem] text-ink">
          <span aria-hidden className="font-semibold text-pos">
            ✓
          </span>
          <span>
            <span className="sr-only">Published: </span>
            {t}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Where to ask for anything not yet published. */
export function AskLine({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-ink-2 ${className}`}>
      {children ?? "Confirmed in your client area, or ask support:"}{" "}
      <a href={`mailto:${site.email}`} className="link">
        {site.email}
      </a>{" "}
      or the{" "}
      <Link href="/contact" className="link">
        contact page
      </Link>
      .
    </p>
  );
}

/** The verbatim risk warning with a way to the full disclosure. */
export function RiskNote({ text }: { text: string }) {
  return (
    <section className="section-quiet hairline" aria-label="Risk warning">
      <div className="wrap grid gap-13 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-55">
        <h2 className="label pt-3">Risk warning</h2>
        <div>
          <p className="max-w-measure text-sm text-ink-2">{text}</p>
          <Link href="/legal/risk" className="go mt-13 min-h-[2.75rem] md:min-h-0">
            Risk disclosure
          </Link>
        </div>
      </div>
    </section>
  );
}
