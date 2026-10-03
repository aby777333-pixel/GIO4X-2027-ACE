import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

// Campaign links are the IB's own referral links that carry a campaign name or a
// channel tag (sub_id). Clicks and sign-ups are the counters on public.referrals;
// nothing on this page is sample data. Staff can also create a link for an IB from
// GIO4X Control (IB Network → the partner's page).
type Campaign = {
  id: string;
  code: string;
  name: string | null;
  destination: string;
  sub_id: string | null;
  clicks: number;
  conversions: number;
  created_at: string;
};

const DEST: Record<string, string> = {
  register: "Live sign-up",
  "register-demo": "Demo sign-up",
  home: "Website",
  raptor: "Trading terminal",
};

const cols: Column<Campaign>[] = [
  { key: "name", header: "Campaign", render: (r) => <span className="font-medium text-navy">{r.name ?? "Untitled link"}</span> },
  { key: "channel", header: "Channel", render: (r) => <span className="text-steel">{r.sub_id ?? "—"}</span> },
  { key: "code", header: "Code", render: (r) => <span className="font-mono text-[11px] text-sky">{r.code}</span> },
  { key: "destination", header: "Goes to", render: (r) => <span className="text-steel">{DEST[r.destination] ?? r.destination}</span> },
  { key: "created", header: "Created", render: (r) => <span className="text-steel">{r.created_at.slice(0, 10)}</span> },
  { key: "clicks", header: "Clicks", align: "right", render: (r) => <span className="text-navy">{r.clicks.toLocaleString()}</span> },
  { key: "signups", header: "Sign-ups", align: "right", render: (r) => <span className="text-navy">{r.conversions.toLocaleString()}</span> },
  {
    key: "rate",
    header: "Conversion",
    align: "right",
    render: (r) => <span className="text-steel">{r.clicks ? `${((r.conversions / r.clicks) * 100).toFixed(1)}%` : "—"}</span>,
  },
];

export default async function CampaignsPage() {
  const user = await getCurrentUser();

  let rows: Campaign[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("referrals")
      .select("id, code, name, destination, sub_id, clicks, conversions, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    rows = ((data ?? []) as Campaign[]).filter((r) => r.name || r.sub_id);
  }

  return (
    <Shell title="Campaign Links">
      <PageHeader
        title="Campaign Links"
        subtitle="Your referral links that carry a campaign name or a channel tag, with the clicks and sign-ups each has brought."
        actions={
          <Link href="/ib/referrals">
            <Button variant="primary">
              <Plus size={14} className="mr-1" /> New campaign link
            </Button>
          </Link>
        }
      />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/ib/campaigns" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to see your campaign links.
        </div>
      ) : null}

      <Card>
        <CardBody className="px-0 pt-2">
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-steel">
              No campaign links yet. Create a referral link with a name or a channel tag and it appears here with its clicks and sign-ups.
            </div>
          ) : (
            <DataTable columns={cols} rows={rows} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}
