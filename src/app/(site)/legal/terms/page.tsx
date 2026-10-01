import { LegalDocument } from "@/components/trust/LegalDocument";
import { getLegalDoc } from "@/data/legal-docs";
import { pageMeta } from "@/lib/meta";

const doc = getLegalDoc("terms");

export const metadata = pageMeta({ title: doc.title, description: doc.summary, path: doc.path });

export default function TermsPage() {
  return <LegalDocument doc={doc} />;
}
