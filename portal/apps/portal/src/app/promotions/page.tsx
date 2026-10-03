import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Gift, Sparkles, Trophy, Zap } from "lucide-react";

const offers = [
  {
    name: "Welcome Bonus",
    blurb: "Get 30% deposit credit on your first deposit (up to $300).",
    badge: "New users",
    badgeTone: "info" as const,
    ends: "Ongoing",
    icon: Gift,
    cta: "Claim",
    href: "/deposits",
    eligible: true,
  },
  {
    name: "Trade & Win — May Edition",
    blurb: "Trade 50+ lots in May, win an iPad Pro. Top 10 traders rewarded.",
    badge: "8 days left",
    badgeTone: "warning" as const,
    ends: "2026-05-31",
    icon: Trophy,
    cta: "View leaderboard",
    href: "/copy/discover",
    eligible: true,
  },
  {
    name: "Cashback Pro",
    blurb: "Get $5 cashback per standard lot on ECN accounts. Auto-credited.",
    badge: "ECN only",
    badgeTone: "neutral" as const,
    ends: "Ongoing",
    icon: Zap,
    cta: "Open ECN account",
    href: "/accounts",
    eligible: false,
  },
  {
    name: "Refer & Earn",
    blurb: "Earn $100 for every referred client who deposits and trades 1 lot.",
    badge: "Unlimited",
    badgeTone: "success" as const,
    ends: "Ongoing",
    icon: Sparkles,
    cta: "Get referral link",
    href: "/ib/referrals",
    eligible: true,
  },
];

export default function PromotionsPage() {
  return (
    <Shell title="Promotions">
      <PageHero
        eyebrow="Offers & Bonuses"
        image="/hero/hero-promotions.jpg"
        title="Promotions & Bonuses"
        subtitle="Active offers from GIO4X. Some are one-time, some are stackable."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((o) => {
          const Icon = o.icon;
          return (
            <Card key={o.name}>
              <CardBody>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy text-white">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-navy">{o.name}</span>
                      <StatusBadge tone={o.badgeTone}>{o.badge}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-steel">{o.blurb}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-steel-light">Ends: {o.ends}</span>
                      {o.eligible ? (
                        <Link href={o.href}>
                          <Button variant="primary">{o.cta}</Button>
                        </Link>
                      ) : (
                        <Link href={o.href}>
                          <Button variant="ghost" className="border border-slate-200">{o.cta}</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-amber-200 bg-amber-50">
        <CardBody className="text-xs text-amber-900">
          <strong>Terms apply.</strong> Bonuses are non-withdrawable until you complete the required trading
          volume. See full terms on{" "}
          <a href="https://lustrous-youtiao-52c8ea.netlify.app/legal/risk" className="underline" target="_blank" rel="noreferrer">
            gio4x.com/legal/risk
          </a>.
        </CardBody>
      </Card>
    </Shell>
  );
}
