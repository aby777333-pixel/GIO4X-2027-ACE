import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { DiscoverGrid } from "../copy-tools";
import { loadProviders } from "@/lib/copy-actions";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [providers, user] = await Promise.all([loadProviders(), getCurrentUser()]);

  return (
    <Shell title="GIO4X Copy · Discover">
      <PageHero
        eyebrow="Copy Trading"
        image="/hero/hero-copy.jpg"
        title="Discover Strategies"
        subtitle="Browse staff-vetted signal providers and mirror their trades to your account. Performance fees apply only on new high-water-mark profit."
      />
      <DiscoverGrid providers={providers} signedIn={!!user} />
    </Shell>
  );
}
