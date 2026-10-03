"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { ChipFilter } from "@/components/ChipFilter";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";

type Event = { id: number; time: string; country: string; flag: string; event: string; impact: "Low" | "Medium" | "High"; forecast: string; previous: string; actual?: string };

const events: Event[] = [
  { id: 1, time: "08:30", country: "US", flag: "🇺🇸", event: "Initial Jobless Claims", impact: "Medium", forecast: "225K", previous: "229K" },
  { id: 2, time: "10:00", country: "EU", flag: "🇪🇺", event: "ECB Lagarde Speech", impact: "High", forecast: "—", previous: "—" },
  { id: 3, time: "12:30", country: "US", flag: "🇺🇸", event: "Core PCE Price Index m/m", impact: "High", forecast: "0.3%", previous: "0.2%" },
  { id: 4, time: "14:00", country: "US", flag: "🇺🇸", event: "Pending Home Sales m/m", impact: "Low", forecast: "0.5%", previous: "-1.6%" },
  { id: 5, time: "16:00", country: "GB", flag: "🇬🇧", event: "BoE MPC Member Speech", impact: "Medium", forecast: "—", previous: "—" },
  { id: 6, time: "23:30", country: "JP", flag: "🇯🇵", event: "Tokyo CPI y/y", impact: "Medium", forecast: "2.0%", previous: "1.9%" },
];

const news = [
  { id: 1, time: "07:42", source: "Reuters", headline: "Fed's Powell signals 'patient' approach as markets weigh June pause", tag: "Macro" },
  { id: 2, time: "06:15", source: "Bloomberg", headline: "Gold tops $2,985 as dollar slides on weak US data", tag: "Gold" },
  { id: 3, time: "05:50", source: "FT", headline: "BoE divides on rate path after sticky services inflation", tag: "GBP" },
  { id: 4, time: "04:30", source: "WSJ", headline: "Nikkei climbs 1.2% on softer yen and tech earnings", tag: "Equities" },
];

const impactTone = { Low: "neutral", Medium: "warning", High: "danger" } as const;
const filters = ["All", "High", "Medium", "Low"] as const;

export default function CalendarPage() {
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const rows = f === "All" ? events : events.filter((e) => e.impact === f);

  return (
    <Shell title="Calendar & News">
      <PageHeader
        title="Economic Calendar & News"
        subtitle="Today's market-moving events and a curated news stream."
        actions={<ChipFilter options={filters} value={f} onChange={setF} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today — 28 May 2026</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Country</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 text-right font-medium">Forecast</th>
                  <th className="px-4 py-2 text-right font-medium">Previous</th>
                  <th className="px-4 py-2 text-right font-medium">Impact</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-mono text-[11px] text-steel">{e.time}</td>
                    <td className="px-4 py-3 text-navy">{e.flag} {e.country}</td>
                    <td className="px-4 py-3 text-navy">{e.event}</td>
                    <td className="px-4 py-3 text-right text-steel">{e.forecast}</td>
                    <td className="px-4 py-3 text-right text-steel">{e.previous}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge tone={impactTone[e.impact]}>{e.impact}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>News stream</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {news.map((n) => (
              <article key={n.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between text-[11px] text-steel-light">
                  <span>{n.source} · {n.tag}</span>
                  <span>{n.time}</span>
                </div>
                <h4 className="mt-1 text-sm font-medium text-navy">{n.headline}</h4>
              </article>
            ))}
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
