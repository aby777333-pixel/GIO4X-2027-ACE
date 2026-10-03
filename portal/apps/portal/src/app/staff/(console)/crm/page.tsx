import Link from "next/link";
import { Card, CardBody, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getSupabaseServer } from "@/lib/supabase-server";
import { LEAD_STAGES, STAGE_LABEL, stageTone, type LeadStage } from "@/lib/crm-constants";
import { NewLeadButton } from "./new-lead-form";
import { Users, Flame, CheckCircle2, KanbanSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  ...LEAD_STAGES.map((s) => ({ key: s, label: STAGE_LABEL[s] })),
];

export default async function StaffCrmPage({
  searchParams,
}: {
  searchParams: { stage?: string; q?: string };
}) {
  const active = searchParams.stage ?? "all";
  const search = (searchParams.q ?? "").trim();
  const supabase = getSupabaseServer();

  let query = supabase
    .from("crm_leads")
    .select(
      "id, full_name, email, phone, country, source, stage, status, score, assigned_staff, last_activity_at, created_at",
    )
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (active !== "all") query = query.eq("stage", active as LeadStage);
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  }

  const [{ data: leads }, totalRes, openRes, wonRes] = await Promise.all([
    query,
    supabase.from("crm_leads").select("id", { count: "exact", head: true }),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("stage", "won"),
  ]);

  const rows = leads ?? [];

  // Resolve assigned staff names.
  const staffIds = Array.from(
    new Set(rows.map((l) => l.assigned_staff).filter((x): x is string => !!x)),
  );
  const staffMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", staffIds);
    for (const s of staff ?? []) staffMap.set(s.id, s.full_name?.trim() || s.email || "Staff");
  }

  const tiles = [
    { label: "Total leads", value: String(totalRes.count ?? 0), icon: <Users size={16} /> },
    { label: "Open pipeline", value: String(openRes.count ?? 0), icon: <Flame size={16} /> },
    { label: "Won", value: String(wonRes.count ?? 0), icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Leads & CRM"
        subtitle="Prospects from the website, ads, referrals and manual entry."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/staff/crm/pipeline"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-steel transition hover:border-sky/30 hover:text-navy"
            >
              <KanbanSquare size={16} /> Pipeline
            </Link>
            <NewLeadButton />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} />
        ))}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {active !== "all" ? <input type="hidden" name="stage" value={active} /> : null}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name, email or phone…"
          className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white transition hover:bg-navy-dark"
        >
          Search
        </button>
        {search ? (
          <Link
            href={active === "all" ? "/staff/crm" : `/staff/crm?stage=${active}`}
            className="text-xs font-medium text-steel hover:text-navy"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {STAGE_FILTERS.map((f) => {
          const href =
            f.key === "all"
              ? `/staff/crm${search ? `?q=${encodeURIComponent(search)}` : ""}`
              : `/staff/crm?stage=${f.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                active === f.key
                  ? "rounded-full bg-navy px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-steel transition hover:border-sky/30 hover:text-navy"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardBody className="space-y-2">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-steel">No leads match this filter.</p>
          ) : (
            rows.map((l) => (
              <Link
                key={l.id}
                href={`/staff/crm/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 transition hover:border-sky/30 hover:bg-sky/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-navy">{l.full_name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-steel-light">
                    {l.email ? <span>{l.email}</span> : null}
                    {l.phone ? (
                      <>
                        {l.email ? <span>·</span> : null}
                        <span>{l.phone}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{l.source}</span>
                    {l.country ? (
                      <>
                        <span>·</span>
                        <span>{l.country}</span>
                      </>
                    ) : null}
                    {l.assigned_staff ? (
                      <>
                        <span>·</span>
                        <span className="font-medium text-sky">
                          {staffMap.get(l.assigned_staff) ?? "Assigned"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span className="font-medium text-amber-600">unassigned</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {typeof l.score === "number" && l.score > 0 ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-steel">
                      {l.score}
                    </span>
                  ) : null}
                  <StatusBadge tone={stageTone(l.stage as LeadStage)}>
                    {STAGE_LABEL[l.stage as LeadStage]}
                  </StatusBadge>
                </div>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
