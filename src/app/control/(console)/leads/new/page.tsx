import type { AddLeadError } from "@/app/control/actions-leads";
import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { LeadNewView } from "@/components/control/views/LeadNewView";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Add an enquiry", "/control/leads/new");

const ERROR_CODES: readonly AddLeadError[] = ["invalid", "forbidden", "throttled", "save"];

/**
 * The form for an enquiry entered by hand. Offered to people who may change
 * leads; the action (actions-leads.ts) checks again and the database has the
 * final say. A refusal normally comes back from the action itself; a fixed
 * `?error=` code is accepted as well and carries nothing that was typed.
 */
export default async function LeadNewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "leads.write")) return <NoAccess title="Add an enquiry" />;

  const code = firstParam((await searchParams).error);
  const error = ERROR_CODES.find((c) => c === code);

  return <LeadNewView initial={error ? { error } : undefined} />;
}
