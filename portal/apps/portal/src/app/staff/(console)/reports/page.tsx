import { Card, CardBody } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { ReportsClient } from "./reports-client";

// §29 Reporting Centre — filterable, exportable reports over the real platform data.
export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Reporting Centre"
        subtitle="Filterable, exportable reports over live platform data — trades, revenue, IB commissions, cashier and clients. Pick a window and download CSV."
      />
      <Card>
        <CardBody>
          <ReportsClient />
        </CardBody>
      </Card>
    </div>
  );
}
