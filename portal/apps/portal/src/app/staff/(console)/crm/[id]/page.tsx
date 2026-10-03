import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/session";
import {
  STAGE_LABEL,
  stageTone,
  ACTIVITY_LABEL,
  type LeadStage,
  type ActivityKind,
} from "@/lib/crm-constants";
import { LeadPanel } from "./lead-panel";
import { LeadTasks, type LeadTask } from "./lead-tasks";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Tag,
  Megaphone,
  Link2,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  const user = await getCurrentUser();

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!lead) notFound();

  const [{ data: activities }, { data: tasks }, { data: staffList }] = await Promise.all([
    supabase
      .from("crm_lead_activities")
      .select("id, kind, body, actor_id, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("crm_tasks")
      .select("id, title, status, priority, due_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["staff", "admin"])
      .limit(200),
  ]);

  const staff = (staffList ?? []).map((s) => ({
    id: s.id,
    name: s.full_name?.trim() || s.email || "Staff",
  }));
  const nameMap = new Map(staff.map((s) => [s.id, s.name]));
  const assignedName = lead.assigned_staff ? nameMap.get(lead.assigned_staff) : null;

  const meta: { icon: React.ReactNode; label: string; value: string | null }[] = [
    { icon: <Mail size={14} />, label: "Email", value: lead.email },
    { icon: <Phone size={14} />, label: "Phone", value: lead.phone },
    { icon: <Globe size={14} />, label: "Country", value: lead.country },
    { icon: <Tag size={14} />, label: "Source", value: lead.source },
    { icon: <Megaphone size={14} />, label: "Campaign", value: lead.campaign },
    { icon: <Link2 size={14} />, label: "Referral", value: lead.referral_code },
  ];

  return (
    <>
      <Link
        href="/staff/crm"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-steel transition hover:text-navy"
      >
        <ArrowLeft size={16} /> Back to leads
      </Link>

      <PageHeader
        title={lead.full_name}
        subtitle={`Lead · created ${new Date(lead.created_at).toLocaleDateString()}`}
        actions={
          <StatusBadge tone={stageTone(lead.stage as LeadStage)}>
            {STAGE_LABEL[lead.stage as LeadStage]}
          </StatusBadge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              {assignedName ? (
                <span className="text-xs font-medium text-sky">Owner: {assignedName}</span>
              ) : (
                <span className="text-xs font-medium text-amber-600">Unassigned</span>
              )}
            </CardHeader>
            <CardBody className="pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {meta
                  .filter((m) => m.value)
                  .map((m) => (
                    <div key={m.label} className="flex items-center gap-2 text-sm">
                      <span className="text-steel-light">{m.icon}</span>
                      <span className="text-steel-light">{m.label}:</span>
                      <span className="truncate font-medium text-navy">{m.value}</span>
                    </div>
                  ))}
              </div>
              {lead.owner_notes ? (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-steel">
                  {lead.owner_notes}
                </div>
              ) : null}
              {lead.lost_reason ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Lost: {lead.lost_reason}
                </div>
              ) : null}
              {lead.converted_profile_id ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Converted → client profile{" "}
                  <span className="font-mono text-[12px]">{lead.converted_profile_id}</span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              {(activities ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-steel">No activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {(activities ?? []).map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-navy">
                            {ACTIVITY_LABEL[a.kind as ActivityKind]}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-steel-light">
                            <Clock size={11} /> {new Date(a.created_at).toLocaleString()}
                          </span>
                          {a.actor_id && nameMap.get(a.actor_id) ? (
                            <span className="text-[11px] text-steel-light">
                              · {nameMap.get(a.actor_id)}
                            </span>
                          ) : null}
                        </div>
                        {a.body ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-steel">{a.body}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <LeadPanel
            leadId={lead.id}
            stage={lead.stage as LeadStage}
            assignedStaff={lead.assigned_staff}
            converted={!!lead.converted_profile_id}
            currentUserId={user?.id ?? ""}
            staff={staff}
          />
          <LeadTasks leadId={lead.id} tasks={(tasks ?? []) as LeadTask[]} />
        </div>
      </div>
    </>
  );
}
