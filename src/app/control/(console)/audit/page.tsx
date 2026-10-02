import { controlMeta, firstParam } from "@/components/control/format";
import { AuditView } from "@/components/control/views/AuditView";
import { NoAccess } from "@/components/control/bits";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Audit log", "/control/audit");

const PER_PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "audit.read")) return <NoAccess title="Audit log" />;

  const params = await searchParams;
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  const [result, names] = await Promise.all([
    ctx.supabase
      .from("audit_log")
      .select("id, at, actor, action, entity, entity_id, detail", { count: "exact" })
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
    staffDirectory(ctx.supabase),
  ]);

  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const rows = result.data ?? [];
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return <AuditView rows={rows} names={names} me={ctx.userId} total={total} page={page} pageCount={pageCount} failed={failed} pastEnd={pastEnd} />;
}
