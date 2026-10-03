import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";
import { Download, Image as ImageIcon, FileText, Video, Languages } from "lucide-react";
import { SampleDataBanner } from "@/components/SampleDataBanner";

const sections = [
  {
    title: "Banners & creatives",
    icon: ImageIcon,
    items: [
      { name: "Web banners — set of 12 (300x250 → 970x250)", size: "8.4 MB", type: "ZIP" },
      { name: "Story / Reel templates — May 2026", size: "12.2 MB", type: "ZIP" },
      { name: "Static social posts (square)", size: "4.6 MB", type: "ZIP" },
    ],
  },
  {
    title: "Decks & one-pagers",
    icon: FileText,
    items: [
      { name: "IB partnership deck", size: "4.4 MB", type: "PDF" },
      { name: "Trading conditions sheet", size: "640 KB", type: "PDF" },
      { name: "GIO4X Copy explainer", size: "1.1 MB", type: "PDF" },
      { name: "Account types comparison", size: "320 KB", type: "PDF" },
    ],
  },
  {
    title: "Video assets",
    icon: Video,
    items: [
      { name: "60-sec brand spot — multiple languages", size: "84 MB", type: "MP4" },
      { name: "Platform walkthrough (5 min)", size: "120 MB", type: "MP4" },
      { name: "Product testimonial reels", size: "62 MB", type: "ZIP" },
    ],
  },
  {
    title: "Localised copy",
    icon: Languages,
    items: [
      { name: "Headlines library — EN / HI / TA / AR / ZH / ES", size: "180 KB", type: "DOCX" },
      { name: "Email templates (10 sequences)", size: "240 KB", type: "ZIP" },
      { name: "WhatsApp / Telegram pitch decks", size: "1.8 MB", type: "PDF" },
    ],
  },
];

export default function MaterialsPage() {
  return (
    <Shell title="Marketing Materials">
      <PageHeader
        title="Marketing Materials"
        subtitle="Brand-approved creatives, copy, and decks. Co-branded versions available on request."
      />

      <SampleDataBanner>Sample creatives — the live asset library is coming soon.</SampleDataBanner>

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <Icon size={16} className="text-sky" />
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {s.items.map((it) => (
                    <li key={it.name} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-medium text-navy">{it.name}</div>
                        <div className="text-[11px] text-steel">{it.type} · {it.size}</div>
                      </div>
                      <Link href="/ib/referrals" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40">
                        <Download size={12} /> Get
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-sky/20 bg-sky/5">
        <CardBody className="text-xs text-navy">
          Need a co-branded asset (your logo + GIO4X)? Open a Support ticket with your brand kit and
          we'll produce a co-branded version within 2 business days.
        </CardBody>
      </Card>
    </Shell>
  );
}
