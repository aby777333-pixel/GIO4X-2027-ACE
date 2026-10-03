import Link from "next/link";
import { LINKS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white px-8 py-5">
      <div className="grid gap-6 lg:grid-cols-4">
        <div>
          <div className="text-sm font-bold text-navy">GIO4X — The Gentleman's Forex Broker</div>
          <div className="mt-1 text-[11px] text-steel">{LINKS.legal.license}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-steel-light">Company</div>
          <ul className="mt-2 space-y-1 text-xs text-navy">
            <li><Link href={LINKS.website.about} target="_blank" rel="noreferrer" className="hover:text-sky">About GIO4X</Link></li>
            <li><Link href={LINKS.website.careers} target="_blank" rel="noreferrer" className="hover:text-sky">Careers</Link></li>
            <li><Link href={LINKS.website.contact} target="_blank" rel="noreferrer" className="hover:text-sky">Contact</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-steel-light">Trade</div>
          <ul className="mt-2 space-y-1 text-xs text-navy">
            <li><Link href={LINKS.website.markets} target="_blank" rel="noreferrer" className="hover:text-sky">Markets</Link></li>
            <li><Link href={LINKS.website.accountTypes} target="_blank" rel="noreferrer" className="hover:text-sky">Account types</Link></li>
            <li><Link href={LINKS.raptor.terminal} target="_blank" rel="noreferrer" className="hover:text-sky">Raptor terminal</Link></li>
            <li><Link href={LINKS.website.education} target="_blank" rel="noreferrer" className="hover:text-sky">Education</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-steel-light">Legal</div>
          <ul className="mt-2 space-y-1 text-xs text-navy">
            <li><Link href={LINKS.website.legal} target="_blank" rel="noreferrer" className="hover:text-sky">Terms & policies</Link></li>
            <li><Link href={LINKS.website.risk} target="_blank" rel="noreferrer" className="hover:text-sky">Risk disclosure</Link></li>
            <li><Link href="/security" className="hover:text-sky">Data security</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] text-steel">
        <strong className="text-navy">Risk warning:</strong> Trading Forex and CFDs involves significant
        risk and can result in the loss of your invested capital. Trading leveraged products may not
        be suitable for all investors. © {new Date().getFullYear()} GIO4X. All rights reserved.
      </div>
    </footer>
  );
}
