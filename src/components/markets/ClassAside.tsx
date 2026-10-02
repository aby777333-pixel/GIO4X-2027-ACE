import Link from "next/link";
import type { ReactNode } from "react";
import { instrumentHref, type AssetClass, type Instrument } from "@/data/instruments";
import { FxNow, VenueNow } from "./Now";

/**
 * The hero aside of an asset-class hub. Each class gets a different, factual
 * composition under the same frame: a tone rule, a label, then whatever best
 * describes that market's structure. No class shows a price.
 */
export function ClassAside({ cls, list }: { cls: AssetClass; list: Instrument[] }) {
  let label: string;
  let body: ReactNode;

  switch (cls.key) {
    case "forex":
      label = "Sessions now";
      body = <FxNow />;
      break;
    case "equities":
      label = "The listing market’s day";
      body = <VenueNow centreKey="new-york" />;
      break;
    case "metals":
    case "energy":
      label = cls.key === "metals" ? "How each is quoted" : "The contracts";
      body = (
        <ul className="border-t border-line">
          {list.map((i) => (
            <li key={i.slug} className="border-b border-line">
              <Link href={instrumentHref(i)} className="group grid grid-cols-[5.5rem_1fr] items-baseline gap-13 py-8">
                <span className="num text-sm font-semibold tracking-[0.02em] transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
                <span className="text-sm text-ink-2">{i.contract}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    case "indices":
      label = "The benchmarks";
      body = (
        <ul className="border-t border-line">
          {list.map((i) => (
            <li key={i.slug} className="border-b border-line">
              <Link href={instrumentHref(i)} className="group flex items-baseline justify-between gap-13 py-8">
                <span className="text-sm text-ink-2 transition-colors duration-fast group-hover:text-ink">{i.name}</span>
                <span className="num text-sm font-semibold tracking-[0.02em] transition-colors duration-fast group-hover:text-accent">{i.symbol}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
      break;
    default: {
      // crypto: the one class whose underlying market has no weekend
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      label = "The underlying week";
      body = (
        <div>
          <ol className="flat grid grid-cols-7 border-l border-t border-line" aria-label="Days on which the underlying markets trade: every day of the week">
            {days.map((d) => (
              <li key={d} className="border-b border-r border-line py-8 text-center">
                <span className="label block">{d}</span>
                <span aria-hidden className="mx-auto mt-8 block h-[0.3125rem] w-[0.3125rem] rounded-full bg-[var(--tone)]" />
              </li>
            ))}
          </ol>
          <p className="mt-13 text-sm text-ink-2">{cls.hours}</p>
        </div>
      );
    }
  }

  return (
    <aside aria-label={label} className="border-t-2 border-[var(--tone)] pt-13">
      <p className="label">{label}</p>
      <div className="mt-13">{body}</div>
    </aside>
  );
}

/** Wayfinding between the six classes. The current one is marked, not just coloured. */
export function ClassNav({ classes, current }: { classes: AssetClass[]; current: string }) {
  return (
    <nav aria-label="Asset classes" className="hairline-b bg-paper">
      <ul className="wrap scroll-x flex gap-21 sm:gap-34">
        {classes.map((a) => {
          const on = a.key === current;
          return (
            <li key={a.key} className="shrink-0">
              <Link
                href={`/markets/${a.key}`}
                aria-current={on ? "page" : undefined}
                prefetch={on ? false : undefined}
                className={`relative flex h-[2.75rem] items-center text-[0.8125rem] font-semibold uppercase tracking-[0.08em] transition-colors duration-fast ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {a.name}
                {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--tone,var(--accent))]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
