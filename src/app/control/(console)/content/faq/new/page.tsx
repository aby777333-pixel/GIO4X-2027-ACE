import Link from "next/link";
import { ControlHead, NoAccess, Notice } from "@/components/control/bits";
import { controlMeta } from "@/components/control/format";
import { FAQ_CONSOLE_PATH, faqPlaces } from "@/components/control/views/content-shared";
import { FaqEditorView } from "@/components/control/views/FaqEditorView";
import { faqCategories, faqs } from "@/data/faqs";
import { can, requireStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("New question", "/control/content/faq/new");

/**
 * The editor with nothing in it. Reads nothing: a question exists only once
 * the save action has stored it, and the action then opens it at its own
 * address.
 */
export default async function NewFaqPage() {
  const ctx = await requireStaff();
  if (!ctx) return null;
  if (!can(ctx, "content.read")) return <NoAccess title="New question" />;

  const canWrite = can(ctx, "content.write");
  const canPublish = can(ctx, "content.publish");
  // reading the content is not writing it: the database refuses an insert without content.write
  if (!canWrite && !canPublish) {
    return (
      <>
        <ControlHead title="New question" />
        <div className="mt-21">
          <Notice title="Your role can read the website’s content here but cannot add to it">
            If you need to, ask an administrator to change your role on the Staff page. You can still read{" "}
            <Link href={FAQ_CONSOLE_PATH} className="link">
              every question
            </Link>
            .
          </Notice>
        </div>
      </>
    );
  }

  return (
    <FaqEditorView entry={null} base={null} basePlace={null} categories={faqCategories} places={faqPlaces(faqs)} audit={[]} auditFailed={false} names={new Map()} me={ctx.userId} canWrite={canWrite} canPublish={canPublish} />
  );
}
