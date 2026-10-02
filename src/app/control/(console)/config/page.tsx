import { NoAccess } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import type { AnnouncementValue } from "@/components/control/views/ConfigAnnouncement";
import { ConfigView, type ConfigViewProps } from "@/components/control/views/ConfigView";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import type { IncidentRow, IncidentUpdateRow, Json, SiteSettingKey } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Configuration", "/control/config");

/** Incidents shown on the screen. The count says when there are more. */
const INCIDENT_LIMIT = 100;

const NOTICES: Record<string, string> = {
  "announcement-on": "Announcement saved. It is showing on the website.",
  "announcement-off": "Announcement saved. It is not showing on the website.",
  "chat-on": "Live chat switched on. The website offers it while someone has the Live Chats screen open.",
  "chat-off": "Live chat switched off. The website no longer offers it.",
  hours: "Support hours saved.",
  "hours-cleared": "Support hours cleared. The website shows none.",
  "incident-published": "Notice published. It is on the public Status page.",
  "incident-draft": "Notice saved as a draft. Only staff can see it.",
  "incident-withdrawn": "Notice withdrawn. It is no longer on the public Status page.",
  "incident-updated": "Update posted.",
  "incident-resolved": "Update posted. The incident is resolved.",
  "incident-edited": "Notice changed.",
};
const ERRORS: Record<string, string> = {
  invalid: "That value was not accepted. Nothing was changed.",
  refused: "The database refused that value. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  gone: "That incident could not be found. Nothing was changed.",
  "announcement-long": "The announcement must be 200 characters or fewer. Nothing was changed.",
  "announcement-link": "The link must be a page on this website, starting with /. Nothing was changed.",
  "announcement-empty": "An announcement cannot be shown without text. Write the line, or untick “Show”. Nothing was changed.",
  "hours-long": "The support hours must be 120 characters or fewer. Nothing was changed.",
  title: "A notice needs a title of 1 to 140 characters. Nothing was saved.",
  "update-text": "An update needs text, up to 2,000 characters. Nothing was posted.",
};

/** The fixed message for a code from the query string; anything else is ignored. */
const message = (table: Record<string, string>, code: string): string | undefined => (Object.prototype.hasOwnProperty.call(table, code) ? table[code] : undefined);

const isObject =(value: Json | undefined): value is { [key: string]: Json | undefined } => typeof value === "object" && value !== null && !Array.isArray(value);

/** The stored values, read defensively: site_setting_set() fixes their shape, but a row edited in SQL might not have it. */
function readAnnouncement(value: Json | undefined): AnnouncementValue {
  const v = isObject(value) ? value : {};
  return { enabled: v.enabled === true, text: typeof v.text === "string" ? v.text : "", href: typeof v.href === "string" ? v.href : "", tone: v.tone === "notice" ? "notice" : "info" };
}

export default async function ConfigPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "config.manage")) return <NoAccess title="Configuration" />;
  const { supabase } = ctx;

  const params = await searchParams;

  const [settings, incidents, names] = await Promise.all([
    supabase.from("site_settings").select("key, value, updated_at, updated_by"),
    // open incidents first (no resolved time), so a cut list never drops one that is still open
    supabase.from("incidents").select("*", { count: "exact" }).order("resolved_at", { ascending: false, nullsFirst: true }).order("started_at", { ascending: false }).limit(INCIDENT_LIMIT),
    staffDirectory(supabase),
  ]);

  const rows = (incidents.data ?? []) as IncidentRow[];
  const updates = rows.length
    ? await supabase
        .from("incident_updates")
        .select("*")
        .in(
          "incident_id",
          rows.map((r) => r.id),
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(2000)
    : null;

  const failed = !!settings.error || !!incidents.error || !!updates?.error;

  const byKey = new Map((settings.data ?? []).map((row) => [row.key, row]));
  const chat = byKey.get("chat")?.value;
  const support = byKey.get("support")?.value;

  const changed: ConfigViewProps["changed"] = {};
  for (const key of ["announcement", "chat", "support"] satisfies SiteSettingKey[]) {
    const row = byKey.get(key);
    // a row nobody has changed yet carries the time the migration seeded it: not a change worth stating
    if (row?.updated_by) changed[key] = { at: row.updated_at, by: row.updated_by === ctx.userId ? "you" : (names.get(row.updated_by) ?? null) };
  }

  return (
    <ConfigView
      failed={failed}
      announcement={readAnnouncement(byKey.get("announcement")?.value)}
      chat={{ enabled: isObject(chat) && chat.enabled === true }}
      support={{ hours: isObject(support) && typeof support.hours === "string" ? support.hours : "" }}
      changed={changed}
      incidents={rows}
      updates={(updates?.data ?? []) as IncidentUpdateRow[]}
      incidentTotal={incidents.count ?? rows.length}
      names={names}
      me={ctx.userId}
      notice={message(NOTICES, firstParam(params.notice))}
      error={message(ERRORS, firstParam(params.error))}
    />
  );
}
