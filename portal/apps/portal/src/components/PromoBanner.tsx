import Image from "next/image";
import Link from "next/link";
import { LINKS } from "@/lib/constants";
import { ArrowRight, ExternalLink } from "lucide-react";
import { withBase } from "@/lib/base-path";

export function PromoBanner() {
  return (
    <div className="relative mb-6 overflow-hidden rounded-glass border border-slate-200 bg-white">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-sky/5 to-sky/15" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-sky/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-12 h-40 w-40 rounded-full bg-navy/10 blur-3xl" />
      <div className="relative flex flex-col items-start gap-6 px-8 py-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky/20 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sky" />
            The Gentleman's Forex Broker
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-navy sm:text-3xl">
            Institutional execution. Global markets. One account.
          </h2>
          <p className="mt-2 max-w-md text-sm text-steel">
            Trade FX, metals, indices, crypto and CFDs from one Trader Area —
            powered by the GIO Raptor execution engine.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={LINKS.raptor.terminal}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-light"
            >
              Launch GIO Raptor <ArrowRight size={12} />
            </Link>
            <Link
              href={LINKS.website.home}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy transition hover:border-sky/40"
            >
              Visit gio4x.com <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
          <Image
            src={withBase("/logo.png")}
            alt="GIO4X"
            width={2924}
            height={976}
            className="h-9 w-auto"
          />
          <div className="border-l border-slate-200 pl-4 text-[10px] uppercase tracking-wider text-steel">
            Official
            <br />
            Trading Portal
          </div>
        </div>
      </div>
    </div>
  );
}
