import Link from "next/link";
import type { ReactNode } from "react";
import type { AssetClass, Instrument } from "@/data/instruments";
import { getCurrency } from "@/data/knowledge";
import { bankHref, classHref, homeSessions, ofKind, resolveAll } from "./graph";
import { InlineLinks } from "./LinkRows";

function Leg({ role, code, name, href }: { role: string; code: string; name: string; href?: string }) {
  const inner = (
    <>
      <span className="label block">{role}</span>
      <span className="num mt-5 block font-display text-2xl font-light tracking-[-0.01em]">{code}</span>
      <span className="mt-2 block text-sm text-ink-2">{name}</span>
    </>
  );
  return href ? (
    <Link href={href} className="group block p-13 transition-colors duration-fast hover:bg-surface sm:p-21">
      {inner}
    </Link>
  ) : (
    <div className="p-13 sm:p-21">{inner}</div>
  );
}

/**
 * MARKET DNA
 *
 * What an instrument is made of and what it is connected to: its class, its
 * two legs, its contract, the sessions it lives in and the institutions,
 * releases and concepts its data names. Every value is a link into the site.
 * It describes structure. It is not a score and it is not a signal.
 */
export function MarketDna({ instrument: i, cls }: { instrument: Instrument; cls: AssetClass }) {
  const related = resolveAll(i.related);
  const banks = ofKind(related, "Central bank");
  const events = ofKind(related, "Economic event");
  const concepts = ofKind(related, "Concept");
  const markets = [...ofKind(related, "Asset class"), ...ofKind(related, "Instrument")];
  const sessions = cls.key === "forex" ? homeSessions(i) : [];

  const base = i.base ? getCurrency(i.base) : undefined;
  const quote = i.quote ? getCurrency(i.quote) : undefined;
  const [baseName, quoteName] = i.name.includes(" / ") ? i.name.split(" / ") : [i.name, ""];

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Asset class",
      value: (
        <Link href={classHref(cls.key)} className="link inline-flex min-h-[2.75rem] items-center md:min-h-0">
          {cls.name}
        </Link>
      ),
    },
    { label: "Contract", value: <span className="text-ink">{i.contract}</span> },
    {
      label: "Platform symbol",
      value: <span className="num font-medium tracking-[0.04em] text-ink">{i.code}</span>,
    },
    {
      label: "Typical sessions",
      value: (
        <span>
          {sessions.length > 0 && (
            <span className="block text-ink">
              Home {sessions.length > 1 ? "sessions" : "session"}: {sessions.join(" and ")}.
            </span>
          )}
          <span className="block text-ink-2">{cls.hours}</span>
          <Link href="/markets/clock" className="link mt-3 inline-flex min-h-[2.75rem] items-center text-sm md:min-h-0">
            See the sessions on the World Market Clock
          </Link>
        </span>
      ),
    },
    ...(banks.length ? [{ label: banks.length > 1 ? "Central banks" : "Central bank", value: <InlineLinks items={banks} /> }] : []),
    ...(events.length ? [{ label: "Economic events", value: <InlineLinks items={events} /> }] : []),
    ...(concepts.length ? [{ label: "Concepts", value: <InlineLinks items={concepts} /> }] : []),
    ...(markets.length ? [{ label: "Linked markets", value: <InlineLinks items={markets} /> }] : []),
  ];

  return (
    <div>
      {i.base && i.quote && (
        <div className="mb-21">
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch border border-line">
            <Leg role="Base" code={i.base} name={base?.name ?? baseName} href={base ? `${bankHref(base.bank)}#currency` : undefined} />
            <span aria-hidden className="flex items-center border-x border-line px-13 font-display text-2xl font-light text-[var(--tone,var(--accent))]">
              /
            </span>
            <Leg role="Quote" code={i.quote} name={quote?.name ?? quoteName} href={quote ? `${bankHref(quote.bank)}#currency` : undefined} />
          </div>
          <p className="mt-8 text-sm text-ink-3">
            The price of {i.symbol} is the amount of {i.quote} ({quote?.name ?? quoteName}) needed for {cls.key === "metals" ? `one troy ounce of ${baseName.toLowerCase()}` : `1 ${i.base}`}.
          </p>
        </div>
      )}
      <dl className="border-t border-line-strong">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-x-21 gap-y-3 border-b border-line py-13 sm:grid-cols-[9.5rem_1fr]">
            <dt className="text-sm text-ink-3">{r.label}</dt>
            <dd className="text-[0.9375rem] text-ink-2">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
