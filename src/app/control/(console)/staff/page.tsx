import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { StaffView } from "@/components/control/views/StaffView";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Staff", "/control/staff");

const NOTICES: Record<string, string> = {
  requested: "Requested. It takes effect when a second administrator approves it.",
  applied: "Applied at once: nobody else was able to approve it. The audit log records that it was not reviewed.",
  approved: "Approved and applied.",
  rejected: "Rejected. Nothing was changed.",
  withdrawn: "Withdrawn. Nothing was changed.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "You cannot decide your own request or a request about yourself, and only administrators manage staff. Nothing was changed.",
  self: "You cannot change your own access. Nothing was changed.",
  "no-account": "No sign-in account has that address. Create it in Supabase Authentication first, then try again.",
  exists: "That person is already on staff, or a request for them is already waiting.",
  pending: "A request for that person is already waiting for approval.",
  gone: "That request or person could not be found; it may already have been decided.",
  nochange: "That is already how the record stands. Nothing was changed.",
  "last-manager": "That would leave nobody able to manage staff. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
};

/**
 * Who is on staff, and the requests to change that. Read with staff.read
 * (admin and compliance); changed only by people holding staff.manage, and
 * only through the staff_* database functions.
 */
export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "staff.read")) return <NoAccess title="Staff" />;

  const [list, changes, params] = await Promise.all([
    ctx.supabase.rpc("staff_list"),
    ctx.supabase.from("staff_changes").select("*").order("created_at", { ascending: false }).limit(40),
    searchParams,
  ]);

  return (
    <StaffView
      staff={list.data ?? []}
      changes={changes.data ?? []}
      failed={!!list.error || !!changes.error}
      me={ctx.userId}
      manage={can(ctx, "staff.manage")}
      notice={NOTICES[firstParam(params.notice)]}
      error={ERRORS[firstParam(params.error)]}
    />
  );
}
