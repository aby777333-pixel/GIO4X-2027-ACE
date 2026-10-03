"use client";

import { useState } from "react";
import { Sparkline } from "./Sparkline";
import { cn } from "@gio4x/ui";

type Row = {
  symbol: string;
  flag: string;
  bid: number;
  change: number;
  spark: number[];
};

const tabs = ["Forex", "Crypto", "Shares", "Indices", "Metals", "Energy", "ETFs"] as const;
type Tab = (typeof tabs)[number];

const data: Record<Tab, Row[]> = {
  Forex: [
    { symbol: "EURUSD", flag: "🇪🇺🇺🇸", bid: 1.159, change: -0.003, spark: [1.16, 1.158, 1.161, 1.159, 1.157, 1.159] },
    { symbol: "EURAUD", flag: "🇪🇺🇦🇺", bid: 1.632, change: 0.004, spark: [1.628, 1.63, 1.629, 1.631, 1.633, 1.632] },
    { symbol: "EURJPY", flag: "🇪🇺🇯🇵", bid: 184.937, change: -0.462, spark: [185.4, 185.2, 185.0, 184.9, 184.8, 184.937] },
    { symbol: "AUDNZD", flag: "🇦🇺🇳🇿", bid: 1.21, change: 0.0, spark: [1.209, 1.21, 1.21, 1.211, 1.21, 1.21] },
    { symbol: "AUDUSD", flag: "🇦🇺🇺🇸", bid: 0.71, change: -0.003, spark: [0.713, 0.712, 0.711, 0.71, 0.71, 0.71] },
    { symbol: "GBPUSD", flag: "🇬🇧🇺🇸", bid: 1.267, change: 0.002, spark: [1.264, 1.265, 1.266, 1.267, 1.267, 1.267] },
    { symbol: "USDJPY", flag: "🇺🇸🇯🇵", bid: 149.85, change: 0.34, spark: [149.4, 149.5, 149.6, 149.7, 149.8, 149.85] },
  ],
  Crypto: [
    { symbol: "BTCUSD", flag: "₿", bid: 84521.3, change: 1.42, spark: [83800, 84000, 84200, 84300, 84450, 84521] },
    { symbol: "ETHUSD", flag: "Ξ", bid: 3120.5, change: 0.85, spark: [3090, 3100, 3105, 3110, 3115, 3120] },
    { symbol: "SOLUSD", flag: "◎", bid: 168.2, change: -0.43, spark: [170, 169.5, 169, 168.5, 168.3, 168.2] },
    { symbol: "XRPUSD", flag: "✕", bid: 0.612, change: 0.012, spark: [0.6, 0.605, 0.608, 0.61, 0.612, 0.612] },
    { symbol: "LTCUSD", flag: "Ł", bid: 92.4, change: -0.21, spark: [93, 92.8, 92.6, 92.5, 92.4, 92.4] },
  ],
  Shares: [
    { symbol: "AAPL", flag: "🇺🇸", bid: 232.5, change: 1.2, spark: [230, 231, 231.5, 232, 232.3, 232.5] },
    { symbol: "MSFT", flag: "🇺🇸", bid: 421.8, change: 2.1, spark: [418, 419, 420, 420.5, 421, 421.8] },
    { symbol: "TSLA", flag: "🇺🇸", bid: 245.6, change: -3.4, spark: [250, 248, 247, 246, 245.8, 245.6] },
    { symbol: "AMZN", flag: "🇺🇸", bid: 198.2, change: 0.5, spark: [197, 197.5, 197.8, 198, 198.1, 198.2] },
  ],
  Indices: [
    { symbol: "US30", flag: "🇺🇸", bid: 41823.5, change: -0.34, spark: [42000, 41950, 41900, 41850, 41830, 41823] },
    { symbol: "US500", flag: "🇺🇸", bid: 5712.3, change: 0.42, spark: [5690, 5695, 5700, 5705, 5710, 5712] },
    { symbol: "UK100", flag: "🇬🇧", bid: 8124.6, change: -0.18, spark: [8140, 8135, 8130, 8128, 8125, 8124] },
    { symbol: "DE40", flag: "🇩🇪", bid: 18632.4, change: 0.55, spark: [18550, 18580, 18600, 18620, 18630, 18632] },
    { symbol: "JP225", flag: "🇯🇵", bid: 38420.0, change: -0.12, spark: [38470, 38450, 38440, 38430, 38425, 38420] },
  ],
  Metals: [
    { symbol: "XAUUSD", flag: "🥇", bid: 2987.45, change: 0.67, spark: [2970, 2975, 2980, 2983, 2985, 2987] },
    { symbol: "XAGUSD", flag: "🥈", bid: 34.21, change: -0.05, spark: [34.4, 34.35, 34.3, 34.25, 34.22, 34.21] },
    { symbol: "XPTUSD", flag: "⚪", bid: 942.5, change: 0.15, spark: [940, 941, 941.5, 942, 942.3, 942.5] },
  ],
  Energy: [
    { symbol: "XBRUSD", flag: "🛢️", bid: 78.42, change: 0.31, spark: [77.8, 78.0, 78.1, 78.3, 78.4, 78.42] },
    { symbol: "XTIUSD", flag: "🛢️", bid: 74.18, change: -0.22, spark: [74.6, 74.5, 74.4, 74.3, 74.2, 74.18] },
    { symbol: "XNGUSD", flag: "🔥", bid: 2.84, change: 0.04, spark: [2.78, 2.8, 2.82, 2.83, 2.84, 2.84] },
  ],
  ETFs: [
    { symbol: "SPY", flag: "🇺🇸", bid: 568.2, change: 0.4, spark: [566, 566.5, 567, 567.5, 568, 568.2] },
    { symbol: "QQQ", flag: "🇺🇸", bid: 482.5, change: 0.85, spark: [478, 479, 480, 481, 482, 482.5] },
    { symbol: "DIA", flag: "🇺🇸", bid: 418.3, change: -0.25, spark: [419.5, 419, 418.7, 418.5, 418.4, 418.3] },
  ],
};

export function MarketsTable() {
  const [tab, setTab] = useState<Tab>("Forex");
  const rows = data[tab];

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-1">
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-4 py-2 text-sm transition",
                active ? "font-semibold text-navy" : "text-steel hover:text-navy",
              )}
            >
              {t}
              {active ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky" />
              ) : null}
            </button>
          );
        })}
      </div>
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-xs text-steel">
          <tr>
            <th className="px-4 py-2 font-medium">Symbol</th>
            <th className="px-4 py-2 font-medium">Bid</th>
            <th className="px-4 py-2 font-medium">Change</th>
            <th className="px-4 py-2 font-medium">Markets</th>
            <th className="px-4 py-2 text-right font-medium">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const up = row.change >= 0;
            const pct = (row.change / row.bid) * 100;
            return (
              <tr key={row.symbol} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{row.flag}</span>
                    <span className="font-medium text-navy">{row.symbol}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-navy">{row.bid.toLocaleString()}</td>
                <td className={cn("px-4 py-3", up ? "text-success" : "text-danger")}>
                  {up ? "+" : ""}
                  {row.change.toFixed(3)}
                </td>
                <td className="px-4 py-3">
                  <Sparkline data={row.spark} up={up} />
                </td>
                <td className={cn("px-4 py-3 text-right", up ? "text-success" : "text-danger")}>
                  {up ? "▲" : "▼"} {Math.abs(pct).toFixed(3)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
