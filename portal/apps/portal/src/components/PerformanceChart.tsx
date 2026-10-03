"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { d: "05/01", v: 0.3 },
  { d: "05/04", v: 0.6 },
  { d: "05/07", v: 0.45 },
  { d: "05/10", v: 0.9 },
  { d: "05/13", v: 0.7 },
  { d: "05/16", v: 1.1 },
  { d: "05/19", v: 0.95 },
  { d: "05/22", v: 1.8 },
  { d: "05/25", v: 1.4 },
  { d: "05/28", v: 0.5 },
];

export function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#29ABE2" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#29ABE2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#6D6E71" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#6D6E71" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="v" stroke="#29ABE2" strokeWidth={2} fill="url(#perfFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
