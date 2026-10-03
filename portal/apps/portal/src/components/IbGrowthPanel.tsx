"use client";

// IB Growth Panel — sits under the Rebate chart on /ib so the right column
// of the Performance card stops looking half-empty. Two useful, IB-specific
// micro-cards stacked:
//
//   1. Tier progress: where the IB is on the rebate ladder and what they
//      need to clear to bump up to the next tier.
//   2. Quick share: one-click outbound for the affiliate link — WhatsApp,
//      Telegram, X, Email, plus copy. The clipboard copy is real; the
//      social buttons open the standard share-intent URLs in a new tab.
//
// All numbers below are placeholder/illustrative and match the rest of the
// /ib page (which is currently fully static). When the page is wired to the
// real ib_relationships + commission_ledger data, swap LADDER values for a
// computed view and pass `referralUrl` / `currentLots` / `currentClients`
// in as props.

import { useState } from "react";
import {
  Copy,
  Check,
  MessageCircle,
  Send,
  Mail,
  Trophy,
  ArrowUpRight,
  Megaphone,
} from "lucide-react";

const REFERRAL_URL = "https://www.gio4x.com/live-account/?affid=MzQ0OTY1";

// Rebate ladder. Each rung lists the floor (lots/month + active clients)
// required to unlock that tier's rate. Real config will live in DB
// (`commission_plans`) — keep this shape compatible with what we'd select.
const LADDER = [
  { name: "Bronze IB",  ratePerLot: 1.00, requiredLots: 0,   requiredClients: 0  },
  { name: "Silver IB",  ratePerLot: 1.50, requiredLots: 250, requiredClients: 25 },
  { name: "Gold IB",    ratePerLot: 2.00, requiredLots: 500, requiredClients: 50 },
  { name: "Platinum IB", ratePerLot: 2.75, requiredLots: 1000, requiredClients: 100 },
];

// Placeholder current standing — wire to live data later.
const CURRENT_LOTS = 432;
const CURRENT_CLIENTS = 38;

function currentTier() {
  // Highest tier whose requirements are already met.
  let tier = LADDER[0];
  for (const r of LADDER) {
    if (CURRENT_LOTS >= r.requiredLots && CURRENT_CLIENTS >= r.requiredClients) tier = r;
  }
  return tier;
}

function nextTier(now: typeof LADDER[number]) {
  const idx = LADDER.indexOf(now);
  return idx < LADDER.length - 1 ? LADDER[idx + 1] : null;
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 100;
  return Math.min(100, Math.round((part / whole) * 100));
}

export function IbGrowthPanel() {
  const now = currentTier();
  const next = nextTier(now);
  const [copied, setCopied] = useState(false);

  const lotsPct = next ? pct(CURRENT_LOTS, next.requiredLots) : 100;
  const clientsPct = next ? pct(CURRENT_CLIENTS, next.requiredClients) : 100;
  const lotsToGo = next ? Math.max(0, next.requiredLots - CURRENT_LOTS) : 0;
  const clientsToGo = next ? Math.max(0, next.requiredClients - CURRENT_CLIENTS) : 0;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(REFERRAL_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // browser blocked clipboard — the input below is still selectable
    }
  }

  const shareText = "Trade with GIO4X — institutional-grade access, premium support.";
  const shareLinks = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${REFERRAL_URL}`)}`,
      hint: "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
    },
    {
      label: "Telegram",
      icon: Send,
      href: `https://t.me/share/url?url=${encodeURIComponent(REFERRAL_URL)}&text=${encodeURIComponent(shareText)}`,
      hint: "bg-sky/10 text-sky hover:bg-sky/20",
    },
    {
      label: "X",
      icon: ArrowUpRight,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(REFERRAL_URL)}`,
      hint: "bg-slate-900/5 text-navy hover:bg-slate-900/10",
    },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("Join GIO4X")}&body=${encodeURIComponent(`${shareText}\n\n${REFERRAL_URL}`)}`,
      hint: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ---- Tier progress ---- */}
      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-steel">IB Tier</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
                <Trophy size={14} className="text-amber-500" />
                {now.name}
              </span>
              <span className="text-xs text-steel">
                ${now.ratePerLot.toFixed(2)} / lot
              </span>
            </div>
          </div>
          {next ? (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-steel">Next</div>
              <div className="mt-0.5 text-xs font-medium text-navy">
                {next.name} · ${next.ratePerLot.toFixed(2)}/lot
              </div>
            </div>
          ) : (
            <div className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              Top tier
            </div>
          )}
        </div>

        {next ? (
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-steel">
                <span>
                  Lots this month · <span className="font-semibold text-navy">{CURRENT_LOTS}</span> /{" "}
                  {next.requiredLots}
                </span>
                <span>{lotsToGo === 0 ? "Cleared" : `${lotsToGo} to go`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky to-emerald-400 transition-all"
                  style={{ width: `${lotsPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-steel">
                <span>
                  Active clients ·{" "}
                  <span className="font-semibold text-navy">{CURRENT_CLIENTS}</span> /{" "}
                  {next.requiredClients}
                </span>
                <span>{clientsToGo === 0 ? "Cleared" : `${clientsToGo} to go`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky to-emerald-400 transition-all"
                  style={{ width: `${clientsPct}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-sky/5 px-3 py-2 text-[11px] text-navy">
          <Megaphone size={14} className="text-sky" />
          <span>
            Hitting <span className="font-semibold">{next?.name ?? "the top tier"}</span> lifts every
            future lot by{" "}
            <span className="font-semibold">
              ${(next ? next.ratePerLot - now.ratePerLot : 0).toFixed(2)}
            </span>
            .
          </span>
        </div>
      </div>

      {/* ---- Quick share ---- */}
      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-steel">Share your link</div>
            <div className="mt-0.5 text-sm font-semibold text-navy">Quick share</div>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              copied ? "bg-emerald-100 text-emerald-700" : "bg-sky/10 text-sky hover:bg-sky/20"
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <input
          readOnly
          value={REFERRAL_URL}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-navy outline-none focus:border-sky/60"
        />

        <div className="mt-3 grid grid-cols-4 gap-2">
          {shareLinks.map(({ label, icon: Icon, href, hint }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium transition ${hint}`}
            >
              <Icon size={16} />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
