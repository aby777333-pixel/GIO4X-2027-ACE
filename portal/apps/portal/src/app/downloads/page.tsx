import { Shell } from "@/components/Shell";
import { PageHero } from "@/components/PageHero";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { LINKS } from "@/lib/constants";
import { Apple, Globe, Monitor, Smartphone } from "lucide-react";

type Platform = {
  name: string;
  icon: typeof Globe;
  downloads: string[];
  type: "Web" | "Desktop" | "Mobile";
  external?: string;
};

const platforms: Platform[] = [
  { name: "GIO Raptor Web", icon: Globe, downloads: ["Launch in browser"], type: "Web", external: LINKS.raptor.terminal },
  { name: "GIO Raptor Desktop", icon: Monitor, downloads: ["Windows", "macOS", "Linux"], type: "Desktop" },
  { name: "GIO Raptor for iOS", icon: Apple, downloads: ["App Store"], type: "Mobile" },
  { name: "GIO Raptor for Android", icon: Smartphone, downloads: ["Google Play"], type: "Mobile" },
];

const assets = [
  { name: "Brand kit (logos, colours)", size: "12 MB", type: "ZIP" },
  { name: "Product one-pager", size: "1.2 MB", type: "PDF" },
  { name: "Trading conditions sheet", size: "640 KB", type: "PDF" },
  { name: "IB partnership deck", size: "4.4 MB", type: "PDF" },
];

export default function DownloadsPage() {
  return (
    <Shell title="Downloads">
      <PageHero
        eyebrow="Platforms"
        image="/hero/hero-downloads.jpg"
        title="Downloads"
        subtitle="Get the trading platforms and brand assets."
      />

      <h3 className="mb-3 text-sm font-semibold text-navy">Trading platforms</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {platforms.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.name}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky/10 text-sky">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-navy">{p.name}</div>
                    <div className="text-[11px] text-steel">{p.type}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.downloads.map((d) => (
                    <a
                      key={d}
                      href={p.external ?? "#"}
                      target={p.external ? "_blank" : undefined}
                      rel={p.external ? "noreferrer" : undefined}
                      className="rounded-lg bg-sky px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-light"
                    >
                      {d}
                    </a>
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Brand & marketing assets</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {assets.map((a) => (
              <li key={a.name} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-navy">{a.name}</div>
                  <div className="text-[11px] text-steel">{a.type} · {a.size}</div>
                </div>
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40">
                  Download
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </Shell>
  );
}
