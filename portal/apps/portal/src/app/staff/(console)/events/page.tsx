import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { loadRecentEvents } from "@/lib/events-actions";
import { getCurrentUser } from "@/lib/session";
import { DispatchButton } from "./events-tools";
import { Activity, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

// Map a topic to a badge tone for at-a-glance scanning.
function topicTone(topic: string): StatusTone {
  if (topic.endsWith("failed")) return "danger";
  if (topic.startsWith("fee")) return "info";
  if (topic.startsWith("trade")) return "success";
  if (topic.startsWith("rebate")) return "warning";
  return "neutral";
}

export default async function StaffEventsPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.profile?.role === "admin";

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          title="Event Bus"
          subtitle="The platform's append-only event stream — fees, trades, rebates and money-flow alerts."
        />
        <Card>
          <CardBody className="py-10 text-center text-sm text-steel">
            The event bus monitor is restricted to administrators.
          </CardBody>
        </Card>
      </>
    );
  }

  const events = await loadRecentEvents(120);
  const pending = events.filter((e) => !e.processed_at);
  const failed = events.filter((e) => e.topic.endsWith("failed"));
  const processed = events.filter((e) => e.processed_at);

  const tiles = [
    { label: "Total events", value: String(events.length), unit: "recent", icon: <Activity size={16} /> },
    { label: "Awaiting dispatch", value: String(pending.length), unit: "", icon: <Clock size={16} /> },
    { label: "Processed", value: String(processed.length), unit: "", icon: <CheckCircle2 size={16} /> },
    { label: "Failures", value: String(failed.length), unit: "", icon: <AlertTriangle size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Event Bus"
        subtitle="The platform's append-only event stream. Every fee, trade and rebate emits an event here; dispatching fans them out into per-user notifications and admin alerts."
        actions={<DispatchButton />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} unit={t.unit} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {events.length === 0 ? (
            <p className="py-10 text-center text-sm text-steel">
              No events yet. Settle a deposit or book a trade to see the bus light up.
            </p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusBadge tone={topicTone(e.topic)}>{e.topic}</StatusBadge>
                  <code className="min-w-0 truncate rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-steel">
                    {JSON.stringify(e.payload)}
                  </code>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11px] text-steel-light">
                  {e.attempts > 0 ? (
                    <span title="dispatch attempts">×{e.attempts}</span>
                  ) : null}
                  {e.processed_at ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={12} /> processed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Clock size={12} /> pending
                    </span>
                  )}
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
