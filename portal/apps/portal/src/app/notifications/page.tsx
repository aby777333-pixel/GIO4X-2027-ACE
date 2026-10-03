import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { Megaphone } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import { NotificationsList, type NotificationRow } from "./notifications-list";

export const dynamic = "force-dynamic";

type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: NotificationRow["kind"];
  starts_at: string;
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Shell title="Notifications">
        <PageHeader title="Notifications" subtitle="Your activity, alerts, and announcements in one place." />
        <Card>
          <CardBody className="!py-12 text-center text-sm text-steel">
            <Link
              href="/auth/login?redirect=/notifications"
              className="font-medium text-sky hover:underline"
            >
              Sign in
            </Link>{" "}
            to view your notifications.
          </CardBody>
        </Card>
      </Shell>
    );
  }

  const supabase = getSupabaseServer();
  const nowIso = new Date().toISOString();

  const [{ data: notes }, { data: anns }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, link, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("announcements")
      .select("id, title, body, kind, starts_at")
      .eq("active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("starts_at", { ascending: false })
      .limit(5),
  ]);

  const rows = (notes ?? []) as NotificationRow[];
  const announcements = (anns ?? []) as Announcement[];

  return (
    <Shell title="Notifications">
      <PageHeader
        title="Notifications"
        subtitle="Your activity, alerts, and announcements in one place."
      />

      {announcements.length > 0 ? (
        <div className="mb-6 space-y-2">
          {announcements.map((a) => (
            <Card key={a.id} className="border-sky/30 bg-sky/5">
              <CardBody className="flex items-start gap-3 !py-3">
                <Megaphone className="mt-0.5 shrink-0 text-sky" size={18} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy">{a.title}</div>
                  <div className="mt-0.5 text-xs text-steel">{a.body}</div>
                </div>
                <span className="shrink-0 text-[11px] text-steel-light">
                  {new Date(a.starts_at).toLocaleDateString()}
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <NotificationsList rows={rows} />
    </Shell>
  );
}
