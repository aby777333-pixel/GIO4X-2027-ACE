"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Siren, Snowflake, Play, Maximize2, Loader2 } from "lucide-react";
import { emergencyControl, type EmergencyInput } from "@/lib/pricing-actions";
import type { EmergencyRow } from "@/lib/pricing-terminal";

const ACTIONS: { key: EmergencyInput["action"]; label: string; icon: typeof Snowflake; danger?: boolean }[] = [
  { key: "freeze", label: "Freeze symbol", icon: Snowflake, danger: true },
  { key: "unfreeze", label: "Enable symbol", icon: Play },
  { key: "expand_spread", label: "Expand spread", icon: Maximize2, danger: true },
];

export function EmergencyPanel({ recent }: { recent: EmergencyRow[] }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("EURUSD");
  const [amount, setAmount] = useState("2");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const inp = "rounded-lg border tech-border tech-panel2 px-2.5 py-1.5 text-xs";

  function fire(action: EmergencyInput["action"], danger?: boolean) {
    setMsg(null);
    if (!symbol.trim()) { setMsg("Symbol required."); return; }
    if (!reason.trim()) { setMsg("A reason is required for emergency actions."); return; }
    if (danger && !confirm(`${action} ${symbol}? This applies live to the trading engine + alerts the dealer desk.`)) return;
    start(async () => {
      const r = await emergencyControl({ symbol: symbol.trim().toUpperCase(), action, amount: Number(amount), reason: reason.trim() });
      if (r.ok) { setMsg(r.message ?? "Applied."); setReason(""); router.refresh(); } else setMsg(r.error);
    });
  }

  return (
    <div className="tech-panel rounded-xl border border-rose-500/30 p-5">
      <div className="mb-3 flex items-center gap-2"><Siren size={16} className="text-rose-400" /><h2 className="text-sm font-semibold">Dealer Override &amp; Emergency</h2><span className="text-[11px] tech-muted">— guarded · live to the engine · alerts the dealer desk</span></div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-[10px] uppercase tech-muted">Symbol<input value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inp + " ml-1 w-28"} /></label>
        <label className="text-[10px] uppercase tech-muted">Expand by (markup)<input value={amount} onChange={(e) => setAmount(e.target.value)} className={inp + " ml-1 w-20"} /></label>
        <label className="flex-1 text-[10px] uppercase tech-muted">Reason (required)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="why" className={inp + " ml-1 w-full min-w-40"} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => { const Icon = a.icon; return (
          <button key={a.key} disabled={pending} onClick={() => fire(a.key, a.danger)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${a.danger ? "bg-rose-600 text-white hover:bg-rose-500" : "border tech-border tech-panel2 hover:opacity-80"}`}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />} {a.label}
          </button>
        ); })}
      </div>
      {msg && <div className="mt-2 text-[11px] tech-accent">{msg}</div>}

      {recent.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tech-muted">Recent emergency actions</h3>
          <div className="space-y-1 text-xs">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b tech-border py-1.5 last:border-0">
                <span><b className="text-rose-300">{r.action}</b> {r.symbol ?? ""} — <span className="tech-muted">{r.reason}</span></span>
                <span className="tech-muted">{new Date(r.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
