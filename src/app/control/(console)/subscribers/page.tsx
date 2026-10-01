import { controlMeta, firstParam } from "@/components/control/format";
import { SubscribersView } from "@/components/control/views/SubscribersView";
import { requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Subscribers", "/control/subscribers");

const PER_PAGE = 50;

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;

  const params = await searchParams;
  const pageParam = Number.parseInt(firstParam(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 && pageParam <= 100000 ? pageParam : 1;

  const result = await ctx.supabase
    .from("newsletter_subscribers")
    .select("id, email, created_at, source, consent_at, consent_version, unsubscribed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const pastEnd = result.error?.code === "PGRST103";
  const failed = !!result.error && !pastEnd;
  const rows = result.data ?? [];
  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return <SubscribersView rows={rows} total={total} page={page} pageCount={pageCount} failed={failed} pastEnd={pastEnd} isAdmin={ctx.role === "admin"} />;
}
