import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { Users, ChartLine, ShieldCheck } from "lucide-react";

export default function CopyTradePage() {
  return (
    <Shell title="CopyTrade">
      <PageHeader
        title="CopyTrade"
        subtitle="The lightweight standalone copier — copy a master account into multiple slaves with one-tick latency."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <h3 className="text-sm font-semibold text-navy">How it works</h3>
            <ol className="mt-3 space-y-3 text-sm text-steel">
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky/10 text-xs font-bold text-sky">1</span> Pick a master account (your own, or another trader who's granted you access).</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky/10 text-xs font-bold text-sky">2</span> Add one or more slave accounts. Set lot multiplier and SL/TP overrides.</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky/10 text-xs font-bold text-sky">3</span> Trades replicate in &lt;50 ms over our colocated relay.</li>
            </ol>
            <div className="mt-5 flex gap-2">
              <Link href="/copy/copier">
                <Button variant="primary">Set up CopyTrade</Button>
              </Link>
              <Link href="/copy/discover" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-navy hover:border-sky/40">
                Browse strategies instead
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Why use it</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-xs text-steel">
            <div className="flex items-start gap-2"><Users size={14} className="mt-0.5 text-sky" /><span><strong className="text-navy">Manage many accounts</strong> from one master — perfect for prop teams and family offices.</span></div>
            <div className="flex items-start gap-2"><ChartLine size={14} className="mt-0.5 text-sky" /><span><strong className="text-navy">No subscription fees.</strong> Pay only by traded volume on each slave.</span></div>
            <div className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 text-sky" /><span><strong className="text-navy">Risk filters built in</strong> — daily loss limit and per-trade max lot.</span></div>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
