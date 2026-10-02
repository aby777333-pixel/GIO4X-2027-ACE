import { NoAccess } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { LeadImportView } from "@/components/control/views/LeadImportView";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Import enquiries", "/control/leads/import");

/**
 * Enquiries from a CSV file. Offered to people who may change leads AND hold
 * leads.import (an administrator); the action (actions-import.ts) checks both
 * again and leads_import() (0017) has the final say. The page reads nothing:
 * the file is opened in the browser and only rows the person has checked are
 * sent.
 */
export default async function LeadImportPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.write") || !can(ctx, "leads.import")) return <NoAccess title="Import enquiries" />;

  return <LeadImportView />;
}
