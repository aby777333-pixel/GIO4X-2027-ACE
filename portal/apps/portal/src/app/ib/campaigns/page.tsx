import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Plus } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

type Campaign = { id: number; name: string; channel: string; created: string; clicks: number; signups: number; ftd: number; commission: number; status: "active" | "paused" };

const rows: Campaign[] = [
  { id: 1, name: "May YouTube — Forex 101", channel: "YouTube", created: "2026-05-01", clicks: 1240, signups: 86, ftd: 54, commission: 540, status: "active" },
  { id: 2, name: "WhatsApp Broadcast — Cashback Pro", channel: "WhatsApp", created: "2026-04-12", clicks: 480, signups: 32, ftd: 18, commission: 180, status: "active" },
  { id: 3, name: "Telegram — Gold Sniper teaser", channel: "Telegram", created: "2026-03-20", clicks: 820, signups: 41, ftd: 22, commission: 220, status: "paused" },
  { id: 4, name: "Facebook — Promo for IN region", channel: "Facebook", created: "2026-05-15", clicks: 2380, signups: 142, ftd: 88, commission: 880, status: "active" },
];

const cols: Column<Campaign>[] = [
  { key: "name", header: "Campaign", render: (r) => <span className="font-medium text-navy">{r.name}</span> },
  { key: "channel", header: "Channel", render: (r) => <span className="text-steel">{r.channel}</span> },
  { key: "created", header: "Created", render: (r) => <span className="text-steel">{r.created}</span> },
  { key: "clicks", header: "Clicks", align: "right", render: (r) => <span className="text-navy">{r.clicks.toLocaleString()}</span> },
  { key: "signups", header: "Sign-ups", align: "right", render: (r) => <span className="text-navy">{r.signups}</span> },
  { key: "ftd", header: "FTDs", align: "right", render: (r) => <span className="text-navy">{r.ftd}</span> },
  { key: "commission", header: "Commission", align: "right", render: (r) => <span className="font-semibold text-success">${r.commission.toLocaleString()}</span> },
  { key: "status", header: "Status", render: (r) => <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</StatusBadge> },
];

export default function CampaignsPage() {
  return (
    <Shell title="Campaign Links">
      <PageHeader
        title="Campaign Links"
        subtitle="UTM-tagged campaign URLs for each promo channel."
        actions={
          <Link href="/ib/referrals">
            <Button variant="primary">
              <Plus size={14} className="mr-1" /> New campaign
            </Button>
          </Link>
        }
      />

      <SampleDataBanner />

      <Card>
        <CardBody className="px-0 pt-2">
          <DataTable columns={cols} rows={rows} />
        </CardBody>
      </Card>
    </Shell>
  );
}
