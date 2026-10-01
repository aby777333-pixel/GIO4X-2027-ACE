import { LegalDocument } from "@/components/trust/LegalDocument";
import { getLegalDoc } from "@/data/legal-docs";
import { pageMeta } from "@/lib/meta";

const doc = getLegalDoc("privacy");

export const metadata = pageMeta({ title: doc.title, description: doc.summary, path: doc.path });

export default function PrivacyPage() {
  return <LegalDocument doc={doc} />;
}
