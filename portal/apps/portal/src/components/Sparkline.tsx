"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const stroke = up ? "#10B981" : "#EF4444";
  const fill = up ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-9 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} fill={fill} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
