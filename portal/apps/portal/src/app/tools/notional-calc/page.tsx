"use client";

import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@gio4x/ui";

const contractSize: Record<string, number> = {
  EURUSD: 100000,
  GBPUSD: 100000,
  USDJPY: 100000,
  XAUUSD: 100,
  US30: 1,
  BTCUSD: 1,
};

const price: Record<string, number> = {
  EURUSD: 1.159,
  GBPUSD: 1.267,
  USDJPY: 149.85,
  XAUUSD: 2987.45,
  US30: 41823.5,
  BTCUSD: 84521.3,
};

export default function NotionalCalcPage() {
  const [pair, setPair] = useState("EURUSD");
  const [lots, setLots] = useState(0.1);
  const [leverage, setLeverage] = useState(500);

  const result = useMemo(() => {
    const cs = contractSize[pair];
    const p = price[pair];
    const notional = cs * lots * p;
    const margin = notional / leverage;
    const pip = pair.includes("JPY") ? 0.01 : pair === "XAUUSD" ? 0.1 : 0.0001;
    const pipValue = cs * lots * pip;
    return { notional, margin, pipValue };
  }, [pair, lots, leverage]);

  return (
    <Shell title="Notional Volume Calculator">
      <PageHeader
        title="Notional Volume Calculator"
        subtitle="Quickly size a trade — notional value, required margin, pip value."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-steel">Instrument</label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {Object.keys(contractSize).map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Lot size</label>
              <input
                type="number"
                value={lots}
                step={0.01}
                onChange={(e) => setLots(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Leverage</label>
              <select
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {[1, 50, 100, 200, 400, 500].map((l) => <option key={l} value={l}>1:{l}</option>)}
              </select>
            </div>
            <div className="text-[11px] text-steel">
              Current price: {price[pair].toLocaleString()} · Contract size: {contractSize[pair].toLocaleString()}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Notional value</CardTitle></CardHeader>
            <CardBody>
              <div className="text-3xl font-bold text-navy">
                ${result.notional.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-steel">Total market exposure of this position.</div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Required margin</CardTitle></CardHeader>
            <CardBody>
              <div className="text-3xl font-bold text-sky">
                ${result.margin.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-steel">At 1:{leverage} leverage.</div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pip value</CardTitle></CardHeader>
            <CardBody>
              <div className="text-3xl font-bold text-success">
                ${result.pipValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-xs text-steel">P&L per pip movement on this position.</div>
            </CardBody>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
