"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

// Inline help answers — no external FAQ page needed; clicking expands the answer.
const TOPICS: { q: string; a: string }[] = [
  {
    q: "How long do withdrawals take?",
    a: "Withdrawal requests are reviewed within a few hours on business days. Once approved, e-wallets usually arrive within minutes to a few hours, while card refunds and bank transfers typically take 1–3 business days. Your first withdrawal may need an extra verification check, and funds are always returned to the original deposit method first.",
  },
  {
    q: "Why is my deposit pending?",
    a: "A deposit stays “pending” until the payment provider confirms the transaction. Card and e-wallet deposits normally clear within minutes; bank transfers can take 1–2 business days. If it has been longer, make sure the name on the payment matches your GIO4X account, then contact support with the transaction reference and we’ll trace it.",
  },
  {
    q: "Reset my GIO Raptor account password",
    a: "Use “Forgot password” on the GIO Raptor terminal login screen, or change it from Security in your client area. A reset link is sent to your registered email — check spam if it doesn’t arrive within a few minutes. Note your client-area password and your trading password are managed separately, both under Security.",
  },
  {
    q: "How does the rebate calculation work?",
    a: "IB rebates are calculated per closed lot on the trades of clients in your network, at the rate set for your IB tier. Rates vary by instrument and account type. Rebates accrue in real time and are shown in the IB area, then paid to your account on the scheduled payout cycle.",
  },
  {
    q: "What documents are accepted for KYC?",
    a: "You need a valid government photo ID (passport, national ID, or driver’s licence) plus a recent proof of address (utility bill or bank statement, usually within the last 3 months). Documents must be clear, in colour, and show all four corners. Upload them under Verification — review is typically completed within a few hours.",
  },
  {
    q: "Switching account currency / leverage",
    a: "An account’s base currency is fixed when the account is opened and generally can’t be changed afterwards — open a new account in the currency you want instead. Leverage can be adjusted from Settings (subject to your jurisdiction’s limits and any open positions); reductions apply immediately, while increases may require a quick eligibility check.",
  },
];

export function HelpTopics() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="gap-3 md:columns-2">
      {TOPICS.map((t, i) => {
        const isOpen = open === i;
        return (
          <div key={t.q} className="mb-3 break-inside-avoid rounded-lg border border-slate-100">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-2 p-3 text-left text-sm text-navy transition hover:bg-sky/5"
            >
              <HelpCircle size={14} className="mt-0.5 shrink-0 text-sky" />
              <span className="flex-1">{t.q}</span>
              <ChevronDown size={15} className={`mt-0.5 shrink-0 text-steel transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 px-3 py-3 pl-9 text-[13px] leading-relaxed text-steel">
                {t.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
