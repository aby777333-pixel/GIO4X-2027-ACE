import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { loadPublishedLegal } from "@/lib/legal-actions";

// §24 Public legal document page — renders a PUBLISHED doc by key. Drafts /
// unknown keys 404 (RLS only returns published rows).
export const dynamic = "force-dynamic";

export default async function LegalPage({ params }: { params: { key: string } }) {
  const doc = await loadPublishedLegal(params.key);
  if (!doc) return notFound();

  return (
    <Shell title={doc.title}>
      <PageHeader
        title={doc.title}
        subtitle={`Version ${doc.version} · last updated ${new Date(doc.updated_at).toLocaleDateString()}`}
      />
      <Card>
        <CardBody>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-navy">{doc.body}</div>
        </CardBody>
      </Card>
      <p className="mt-4 text-xs text-steel">
        <Link href="/support" className="text-sky hover:underline">Questions? Contact support.</Link>
      </p>
    </Shell>
  );
}
