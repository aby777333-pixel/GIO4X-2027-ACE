import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { FAQ_CONSOLE_PATH, FAQ_ERRORS, FAQ_NOTICES, faqPlaces } from "@/components/control/views/content-shared";
import { FaqEditorView } from "@/components/control/views/FaqEditorView";
import { faqCategories, faqs } from "@/data/faqs";
import { faqSlots } from "@/lib/faq";
import { can, requireStaff, staffDirectory } from "@/lib/server/staff";
import { isUuid } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("FAQ entry", "/control/content/faq");

/**
 * One saved entry in the editor. Read as the signed-in user: row-level
 * security lets anyone holding content.read see every entry here, whatever
 * its status. What may be changed is decided by the role and by where the
 * entry stands, in the actions and again in the database.
 */
export default async function FaqEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="FAQ entry" />;
  const { supabase } = ctx;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [entryResult, auditResult, names] = await Promise.all([
    supabase.from("faq_entries").select("*").eq("id", id).maybeSingle(),
    supabase.from("audit_log").select("id, at, actor, action").eq("entity", "faq_entry").eq("entity_id", id).order("at", { ascending: false }).limit(50),
    staffDirectory(supabase),
  ]);

  if (entryResult.error) {
    return (
      <>
        <ControlHead title="This entry could not be read" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Reload the page, or go back to{" "}
            <Link href={FAQ_CONSOLE_PATH} className="link">
              every question
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  const entry = entryResult.data;
  // Not found and not permitted look the same on purpose.
  if (!entry) notFound();

  // the question in the code this entry is about, when the code still has it
  const base = entry.base_id !== null ? (faqs.find((f) => f.id === entry.base_id) ?? null) : null;
  const sp = await searchParams;
  const errorCode = firstParam(sp.error);

  return (
    <FaqEditorView
      entry={entry}
      base={base}
      basePlace={base ? (faqSlots(faqs).get(base.id) ?? null) : null}
      categories={faqCategories}
      places={faqPlaces(faqs)}
      audit={auditResult.data ?? []}
      auditFailed={!!auditResult.error}
      names={names}
      me={ctx.userId}
      canWrite={can(ctx, "content.write")}
      canPublish={can(ctx, "content.publish")}
      notice={FAQ_NOTICES[firstParam(sp.notice)]}
      error={Object.hasOwn(FAQ_ERRORS, errorCode) ? FAQ_ERRORS[errorCode as keyof typeof FAQ_ERRORS] : undefined}
    />
  );
}
