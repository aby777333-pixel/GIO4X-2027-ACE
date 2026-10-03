import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, StatTile } from "@gio4x/ui";
import { Users, ShieldCheck, Clock, Ban, Network } from "lucide-react";
import { loadCustomers } from "@/lib/customer-actions";
import { CustomersList } from "./customers-list";

export const dynamic = "force-dynamic";

export default async function StaffCustomersPage() {
  const customers = await loadCustomers();

  const active = customers.filter((c) => c.status === "active").length;
  const suspended = customers.filter((c) => c.status === "suspended" || c.status === "closed").length;
  const verified = customers.filter((c) => c.kyc_status === "approved").length;
  const pendingKyc = customers.filter(
    (c) => c.kyc_status === "in_review" || c.kyc_status === "in_progress",
  ).length;
  const ibs = customers.filter((c) => c.role === "ib").length;

  const tiles = [
    { label: "Total", value: String(customers.length), icon: <Users size={16} /> },
    { label: "Active", value: String(active), icon: <ShieldCheck size={16} /> },
    { label: "KYC verified", value: String(verified), icon: <ShieldCheck size={16} /> },
    { label: "KYC pending", value: String(pendingKyc), icon: <Clock size={16} /> },
    { label: "Suspended", value: String(suspended), icon: <Ban size={16} /> },
    { label: "IBs", value: String(ibs), icon: <Network size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="All registered users — search, filter, and open a profile to manage."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} unit="" />
        ))}
      </div>

      <Card>
        <CardBody>
          <CustomersList customers={customers} />
        </CardBody>
      </Card>
    </>
  );
}
