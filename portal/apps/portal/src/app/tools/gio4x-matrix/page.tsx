import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";

const matrix = [
  { pair: "EURUSD", h1: "Bullish", h4: "Bullish", d1: "Neutral", w1: "Bullish", trend: "Long" },
  { pair: "GBPUSD", h1: "Bearish", h4: "Neutral", d1: "Bullish", w1: "Bullish", trend: "Mixed" },
  { pair: "USDJPY", h1: "Bullish", h4: "Bullish", d1: "Bullish", w1: "Bullish", trend: "Long" },
  { pair: "XAUUSD", h1: "Bullish", h4: "Bullish", d1: "Bullish", w1: "Bullish", trend: "Long" },
  { pair: "US100", h1: "Neutral", h4: "Bullish", d1: "Bullish", w1: "Bullish", trend: "Long" },
  { pair: "BTCUSD", h1: "Bearish", h4: "Bearish", d1: "Bullish", w1: "Bullish", trend: "Mixed" },
];

const cell = (v: string) =>
  v === "Bullish"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : v === "Bearish"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-steel ring-slate-200";

export default function Gio4xMatrixPage() {
  return (
    <Shell title="GIO4X Matrix Tools">
      <PageHeader
        title="GIO4X Matrix"
        subtitle="Multi-timeframe trend matrix — quickly see what's aligned across H1 / H4 / D1 / W1."
      />

      <Card>
        <CardHeader>
          <CardTitle>Trend matrix — updated 5 min ago</CardTitle>
        </CardHeader>
        <CardBody className="px-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-steel-light">
              <tr>
                <th className="px-4 py-3 font-medium">Instrument</th>
                <th className="px-4 py-3 font-medium">H1</th>
                <th className="px-4 py-3 font-medium">H4</th>
                <th className="px-4 py-3 font-medium">D1</th>
                <th className="px-4 py-3 font-medium">W1</th>
                <th className="px-4 py-3 text-right font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.pair} className="border-t border-slate-50">
                  <td className="px-4 py-3 font-medium text-navy">{row.pair}</td>
                  {(["h1", "h4", "d1", "w1"] as const).map((tf) => (
                    <td key={tf} className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cell(row[tf])}`}>
                        {row[tf]}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold text-navy">{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to read it</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-steel">
          GIO4X Matrix runs trend filters (MA crosses + ADX) on multiple timeframes and shows where
          they agree. A row that's <strong className="text-success">Bullish</strong> across H4, D1 and W1
          is a high-conviction long; mixed rows mean range-bound conditions or a turn in progress.
        </CardBody>
      </Card>
    </Shell>
  );
}
