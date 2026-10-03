import { loadEmailerStats } from "@/lib/emailer-actions";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import { EmailerTools } from "./emailer-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bulk Emailer · GIO4X Service Console" };

// Staff Bulk Emailer — compose + send to many recipients via Resend, with a
// template library, CSV import, attachments, and real send stats.
export default async function StaffEmailerPage() {
  const stats = await loadEmailerStats();
  const configured = Boolean(process.env.RESEND_API_KEY);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Bulk Emailer</h1>
        <p className="text-sm text-steel">
          Compose and send to many recipients via Resend — templates, CSV import, and attachments. Each recipient gets their own copy.
        </p>
      </div>
      <EmailerTools templates={EMAIL_TEMPLATES} stats={stats} configured={configured} />
    </div>
  );
}
