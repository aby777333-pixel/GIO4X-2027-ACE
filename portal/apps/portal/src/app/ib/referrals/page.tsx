import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { MetricGrid } from "@/components/MetricGrid";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { LINKS, RAPTOR_BASE } from "@/lib/constants";
import { Link2, MousePointerClick, QrCode, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ReferralBuilder } from "./referral-builder";

type ReferralRow = {
  id: string;
  code: string;
  name: string | null;
  destination: string;
  sub_id: string | null;
  clicks: number;
  conversions: number;
  created_at: string;
};

const DEST_TO_URL: Record<string, string> = {
  register: `${RAPTOR_BASE}/auth/signup`,
  "register-demo": `${RAPTOR_BASE}/auth/signup?demo=1`,
  home: LINKS.website.home,
  raptor: `${RAPTOR_BASE}/`,
};

function buildUrl(r: ReferralRow): string {
  const base = DEST_TO_URL[r.destination] ?? `${RAPTOR_BASE}/auth/signup`;
  const u = new URL(base);
  u.searchParams.set("ref", r.code);
  if (r.sub_id) u.searchParams.set("sub", r.sub_id);
  return u.toString();
}

export default async function ReferralsPage() {
  const user = await getCurrentUser();

  let referrals: ReferralRow[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("referrals")
      .select("id, code, name, destination, sub_id, clicks, conversions, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    referrals = (data ?? []) as ReferralRow[];
  }

  const totalClicks = referrals.reduce((s, r) => s + r.clicks, 0);
  const totalSignups = referrals.reduce((s, r) => s + r.conversions, 0);
  const conv = totalClicks ? `${((totalSignups / totalClicks) * 100).toFixed(1)}%` : "—";

  return (
    <Shell title="Referral Links">
      <PageHeader title="Referral Links" subtitle="Trackable URLs and QR codes for your IB code." />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/ib/referrals" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to manage your referral links.
        </div>
      ) : null}

      <MetricGrid
        columns={4}
        metrics={[
          {
            label: "Total clicks",
            value: totalClicks.toLocaleString(),
            icon: <MousePointerClick size={14} />,
          },
          { label: "Sign-ups", value: totalSignups.toLocaleString(), icon: <Users size={14} /> },
          { label: "Conversion", value: conv, icon: <Link2 size={14} /> },
          { label: "Active links", value: String(referrals.length), icon: <QrCode size={14} /> },
        ]}
      />

      <div className="mt-6 space-y-3">
        {referrals.length === 0 ? (
          <Card>
            <CardBody className="!py-10 text-center text-sm text-steel">
              No referral links yet — use the builder below to create your first one.
            </CardBody>
          </Card>
        ) : (
          referrals.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-navy">
                      {r.name ?? r.destination}
                      <span className="ml-2 rounded-md bg-sky/10 px-1.5 py-0.5 font-mono text-[10px] text-sky">
                        {r.code}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-steel">
                      <span className="truncate">{buildUrl(r)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-steel">Clicks</div>
                      <div className="font-semibold text-navy">{r.clicks.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-steel">Sign-ups</div>
                      <div className="font-semibold text-navy">{r.conversions}</div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Custom referral builder</CardTitle>
        </CardHeader>
        <CardBody>
          <ReferralBuilder signedIn={!!user} />
        </CardBody>
      </Card>
    </Shell>
  );
}
