import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { HelpCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { NewTicketForm } from "@/app/support/new-ticket-form";

export const dynamic = "force-dynamic";

type TicketRow = {
  id: string;
  ticket_ref: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  updated_at: string;
};

const cols: Column<TicketRow>[] = [
  { key: "ticket_ref", header: "Ref", render: (r) => <span className="font-mono text-[11px] text-steel">{r.ticket_ref}</span> },
  { key: "subject", header: "Subject", render: (r) => <Link href={`/support/${r.id}`} className="text-navy hover:text-sky">{r.subject}</Link> },
  { key: "updated_at", header: "Updated", render: (r) => <span className="text-steel">{new Date(r.updated_at).toLocaleDateString()}</span> },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <StatusBadge tone={r.status === "resolved" || r.status === "closed" ? "success" : r.status === "in_progress" ? "info" : "warning"}>
        {r.status.replace("_", " ")}
      </StatusBadge>
    ),
  },
];

// IB-scoped support: raise IB queries/complaints (category defaults to "ib") and
// track them. Reuses the same support_tickets backend the staff console resolves.
export default async function IbSupportPage() {
  const user = await getCurrentUser();
  const signedIn = !!user;

  let tickets: TicketRow[] = [];
  if (user) {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("support_tickets")
      .select("id, ticket_ref, subject, status, updated_at, category")
      .eq("user_id", user.id)
      .eq("category", "ib")
      .order("updated_at", { ascending: false })
      .limit(50);
    tickets = (data ?? []) as TicketRow[];
  }

  return (
    <Shell title="IB Support">
      <PageHeader
        title="IB Support"
        subtitle="Raise a query or complaint about your IB account, rebates, or downline — our team resolves it from the service console."
        actions={<NewTicketForm signedIn={signedIn} defaultCategory="ib" />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your IB tickets</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pt-2">
          {!signedIn ? (
            <div className="px-5 py-8 text-center text-sm text-steel">
              <Link href="/auth/login?redirect=/ib/support" className="font-medium text-sky hover:underline">Sign in</Link>{" "}
              to raise and track IB tickets.
            </div>
          ) : tickets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-steel">
              No IB tickets yet. Click <span className="font-medium text-navy">New ticket</span> to raise one.
            </div>
          ) : (
            <DataTable columns={cols} rows={tickets} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="flex items-center gap-3">
          <HelpCircle className="text-sky" />
          <div className="min-w-0 flex-1 text-xs text-navy">
            For general account, deposit, or KYC issues, use the main <Link href="/support" className="font-medium text-sky hover:underline">Help &amp; Support</Link> page.
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}
