import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Download, Image as ImageIcon, FileText, Video, Languages, Link2, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";

// The asset library. Rows of public.marketing_materials, added and retired by staff in
// GIO4X Control (IB Marketing). Each is a title and the https address of the file; a
// signed-in partner reads the active ones (row-level security). Nothing here is sample
// data: with no rows the page says so.
type Material = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  url: string;
  language: string;
};

const KINDS: { kind: string; title: string; icon: LucideIcon }[] = [
  { kind: "banner", title: "Banners & creatives", icon: ImageIcon },
  { kind: "logo", title: "Logos & brand", icon: ImageIcon },
  { kind: "document", title: "Decks & one-pagers", icon: FileText },
  { kind: "video", title: "Video", icon: Video },
  { kind: "copy", title: "Copy & templates", icon: Languages },
  { kind: "landing_page", title: "Landing pages", icon: Link2 },
  { kind: "other", title: "Other", icon: FileText },
];

export default async function MaterialsPage() {
  const user = await getCurrentUser();

  let rows: Material[] = [];
  if (user) {
    // marketing_materials is newer than the generated database types
    const supabase = getSupabaseServer() as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, v: boolean) => {
            order: (col: string, o: { ascending: boolean }) => { order: (col: string, o: { ascending: boolean }) => Promise<{ data: Material[] | null }> };
          };
        };
      };
    };
    const { data } = await supabase
      .from("marketing_materials")
      .select("id, title, kind, description, url, language")
      .eq("active", true)
      .order("sort", { ascending: true })
      .order("title", { ascending: true });
    rows = data ?? [];
  }

  const sections = KINDS.map((k) => ({ ...k, items: rows.filter((r) => r.kind === k.kind) })).filter((s) => s.items.length > 0);

  return (
    <Shell title="Marketing Materials">
      <PageHeader title="Marketing Materials" subtitle="Brand-approved creatives, copy, and decks. Co-branded versions available on request." />

      {!user ? (
        <div className="mb-4 rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-steel">
          <Link href="/auth/login?redirect=/ib/materials" className="font-medium text-sky hover:underline">
            Sign in
          </Link>{" "}
          to see the materials.
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardBody className="!py-10 text-center text-sm text-steel">No materials have been published yet. They appear here as soon as the team adds them.</CardBody>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.kind}>
                <CardHeader>
                  <CardTitle>{s.title}</CardTitle>
                  <Icon size={16} className="text-sky" />
                </CardHeader>
                <CardBody>
                  <ul className="divide-y divide-slate-100">
                    {s.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-navy">{it.title}</div>
                          <div className="text-[11px] text-steel">
                            {it.language.toUpperCase()}
                            {it.description ? ` · ${it.description}` : ""}
                          </div>
                        </div>
                        {/* an outside address chosen by staff: opened in its own tab, with no referrer */}
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy hover:border-sky hover:text-sky"
                        >
                          <Download size={12} /> Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="text-xs text-navy">
          Need a co-branded asset (your logo + GIO4X)? Open a Support ticket with your brand kit and we&apos;ll produce a co-branded version.
        </CardBody>
      </Card>
    </Shell>
  );
}
