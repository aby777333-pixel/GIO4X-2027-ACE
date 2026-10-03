import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Coins, Sparkles, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

const rewards = [
  { id: 1, name: "Trading credit — $25", cost: 2500, category: "Cash" },
  { id: 2, name: "Trading credit — $100", cost: 9500, category: "Cash" },
  { id: 3, name: "AirPods Pro", cost: 22000, category: "Gear" },
  { id: 4, name: "iPad Air (M3)", cost: 78000, category: "Gear" },
  { id: 5, name: "Spread discount — 30 days", cost: 4000, category: "Trading perk" },
  { id: 6, name: "Priority support — 30 days", cost: 1500, category: "Service" },
  { id: 7, name: "GIO4X Hoodie", cost: 1800, category: "Swag" },
  { id: 8, name: "MacBook Air M4", cost: 145000, category: "Gear" },
];

// 100 points per traded lot, earned on every closed trade.
const POINTS_PER_LOT = 100;
const TIERS = [
  { name: "Platinum", min: 50000 },
  { name: "Gold", min: 20000 },
  { name: "Silver", min: 5000 },
  { name: "Bronze", min: 0 },
];

export default async function PointsMallPage() {
  const user = await getCurrentUser();
  let points = 0;

  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("trades")
      .select("lots")
      .eq("status", "closed")
      .limit(1000);
    const lots = (data ?? []).reduce((s, t) => s + Number(t.lots), 0);
    points = Math.floor(lots * POINTS_PER_LOT);
  }

  const tier = TIERS.find((t) => points >= t.min) ?? TIERS[TIERS.length - 1];
  const nextTier = [...TIERS].reverse().find((t) => t.min > points);

  return (
    <Shell title="POINTS MALL">
      <PageHero
        eyebrow="Rewards"
        image="/hero/gio4x7.png"
        title="POINTS MALL"
        subtitle="Earn 100 points per traded lot. Redeem for credit, gear, and trading perks."
      />

      <Card className="mb-6 overflow-hidden">
        <div className="relative bg-gradient-to-r from-white via-sky/5 to-sky/15 px-8 py-7">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sky/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-sky">Available Points</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-bold text-navy">{points.toLocaleString()}</span>
                <span className="pb-2 text-sm text-steel">pts</span>
              </div>
              <div className="mt-1 text-xs text-steel-light">
                {user ? "Earned from your closed trades." : "Sign in to see your points."}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
                <div className="text-[10px] uppercase text-steel">Tier</div>
                <div className="mt-1 flex items-center gap-1 text-sm font-bold text-navy">
                  <Trophy size={14} className="text-amber-500" /> {tier.name}
                </div>
              </div>
              {nextTier ? (
                <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
                  <div className="text-[10px] uppercase text-steel">Next tier</div>
                  <div className="mt-1 text-sm font-bold text-navy">
                    {(nextTier.min - points).toLocaleString()} pts → {nextTier.name}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rewards catalogue</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rewards.map((r) => {
              const affordable = points >= r.cost;
              return (
                <div key={r.id} className="flex flex-col rounded-xl border border-slate-100 p-4 transition hover:border-sky/30">
                  <div className="flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 text-3xl">
                    {r.category === "Cash" ? "💵" : r.category === "Gear" ? "🎧" : r.category === "Swag" ? "👕" : r.category === "Service" ? "🎧" : "⚡"}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-navy">{r.name}</div>
                  <div className="mt-0.5 text-[11px] text-steel">{r.category}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-bold text-navy">
                      <Coins size={12} className="text-sky" /> {r.cost.toLocaleString()}
                    </span>
                    {affordable ? (
                      <Link href={`/support?topic=${encodeURIComponent(`Redeem reward: ${r.name}`)}`}>
                        <Button variant="primary" className="!py-1.5 !text-xs">Redeem</Button>
                      </Link>
                    ) : (
                      <StatusBadge tone="neutral">{(r.cost - points).toLocaleString()} more</StatusBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="flex items-center gap-3">
          <Sparkles className="text-sky" />
          <div className="text-xs text-navy">
            Points accrue automatically as you trade. Redemptions are processed by our team — pick a reward to raise a request.
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}
