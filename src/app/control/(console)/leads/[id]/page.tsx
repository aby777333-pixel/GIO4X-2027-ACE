import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { LeadView } from "@/components/control/views/LeadView";
import { requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Lead", "/control/leads");

const NOTICES: Record<string, string> = {
  status: "Status updated.",
  assigned: "Assignment updated.",
  note: "Note added.",
};
const ERRORS: Record<string, string> = {
  invalid: "That request was not valid. Nothing was changed.",
  forbidden: "Your role does not allow that change. Nothing was changed.",
  save: "The change could not be saved. Nothing was changed; please try again.",
  note: "A note must be between 1 and 4,000 characters.",
};

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  const { supabase } = ctx;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [leadResult, notesResult, auditResult, names] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_notes").select("id, author, body, created_at").eq("lead_id", id).order("created_at", { ascending: true }).limit(200),
    supabase.from("audit_log").select("id, at, actor, action, detail").eq("entity", "lead").eq("entity_id", id).order("at", { ascending: false }).limit(50),
    staffDirectory(supabase),
  ]);

  if (leadResult.error) {
    return (
      <>
        <ControlHead eyebrow="Lead" title="This lead could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href="/control/leads" className="link">
              all leads
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  const lead = leadResult.data;
  // Not found and not permitted look the same on purpose.
  if (!lead) notFound();

  const sp = await searchParams;
  const notice = NOTICES[firstParam(sp.notice)];
  const error = ERRORS[firstParam(sp.error)];

  return (
    <LeadView
      lead={lead}
      notes={notesResult.data ?? []}
      notesFailed={!!notesResult.error}
      audit={auditResult.data ?? []}
      names={names}
      me={ctx.userId}
      role={ctx.role}
      notice={notice}
      error={error}
    />
  );
}
