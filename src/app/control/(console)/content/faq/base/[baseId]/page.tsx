import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta, firstParam } from "@/components/control/format";
import { FAQ_CONSOLE_PATH, FAQ_ERRORS, faqPlaces } from "@/components/control/views/content-shared";
import { FaqEditorView } from "@/components/control/views/FaqEditorView";
import { faqCategories, faqs } from "@/data/faqs";
import { faqSlots, isFaqBaseId } from "@/lib/faq";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("FAQ question", "/control/content/faq");

/**
 * A question from the code that nobody has changed yet: its original words,
 * read-only, beside an editor for a replacement. Nothing is stored until the
 * replacement is saved or the question is hidden. If a row already exists for
 * the question, that entry is opened instead.
 */
export default async function FaqBasePage({ params, searchParams }: { params: Promise<{ baseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="FAQ question" />;

  const { baseId } = await params;
  // the id is looked up in the code's own list: anything else is not a page
  const base = isFaqBaseId(baseId) ? faqs.find((f) => f.id === baseId) : undefined;
  if (!base) notFound();

  const existing = await ctx.supabase.from("faq_entries").select("id").eq("base_id", base.id).maybeSingle();
  if (existing.error) {
    return (
      <>
        <ControlHead title="This question could not be opened" />
        <div className="mt-21">
          <Notice title="The database did not answer" tone="error">
            Whether this question has already been changed could not be read, so it is not opened for editing. Reload the page, or go back to{" "}
            <Link href={FAQ_CONSOLE_PATH} className="link">
              every question
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }
  if (existing.data) redirect(`${FAQ_CONSOLE_PATH}/${existing.data.id}`);

  const sp = await searchParams;
  const errorCode = firstParam(sp.error);

  return (
    <FaqEditorView
      entry={null}
      base={base}
      basePlace={faqSlots(faqs).get(base.id) ?? null}
      categories={faqCategories}
      places={faqPlaces(faqs)}
      audit={[]}
      auditFailed={false}
      names={new Map()}
      me={ctx.userId}
      canWrite={can(ctx, "content.write")}
      canPublish={can(ctx, "content.publish")}
      error={Object.hasOwn(FAQ_ERRORS, errorCode) ? FAQ_ERRORS[errorCode as keyof typeof FAQ_ERRORS] : undefined}
    />
  );
}
