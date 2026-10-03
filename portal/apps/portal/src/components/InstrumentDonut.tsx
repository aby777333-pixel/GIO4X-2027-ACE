"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const data = [
  { name: "XAUUSD.c", value: 92, color: "#3B82F6" },
  { name: "NZDUSD.c", value: 8, color: "#93C5FD" },
];

export function InstrumentDonut() {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={40} outerRadius={70} stroke="none">
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
