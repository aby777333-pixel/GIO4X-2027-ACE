"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { evalCondition } from "@gio4x/pricing-core";
import { Plus, Trash2, Power, Zap, Loader2, FlaskConical, X } from "lucide-react";
import { upsertSmart, toggleSmart, deleteSmart, upsertDynamic, toggleDynamic, deleteDynamic } from "@/lib/pricing-actions";
import type { SmartRuleUi, DynamicRuleUi } from "@/lib/pricing-terminal";

const FIELDS = ["volatility", "liquidity", "session", "exposure", "segment", "win_rate", "profit_factor", "news"];
const OPS = [">", ">=", "<", "<=", "==", "!="];
const ACTIONS = ["widen", "compress", "markup_adjust", "hedge_and_widen", "set_value"];
const UNITS = ["pips", "points", "percent"];

type Pred = { field: string; op: string; value: string };
const coerce = (v: string): number | string => (v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
const buildCondition = (preds: Pred[]) => ({ all: preds.filter((p) => p.field).map((p) => ({ field: p.field, op: p.op, value: coerce(p.value) })) });
function condSummary(c: unknown): string {
  const n = c as { all?: { field: string; op: string; value: unknown }[] };
  if (!n?.all) return JSON.stringify(c);
  return n.all.map((p) => `${p.field} ${p.op} ${p.value}`).join(" AND ");
}

function CondEditor({ preds, setPreds }: { preds: Pred[]; setPreds: (p: Pred[]) => void }) {
  const inp = "rounded border tech-border tech-panel px-2 py-1 text-xs";
  return (
    <div className="space-y-1.5">
      {preds.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] tech-muted">{i === 0 ? "IF" : "AND"}</span>
          <select value={p.field} onChange={(e) => setPreds(preds.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className={inp}><option value="">field…</option>{FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <select value={p.op} onChange={(e) => setPreds(preds.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))} className={inp}>{OPS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <input value={p.value} onChange={(e) => setPreds(preds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="value" className={inp + " w-20"} />
          {preds.length > 1 && <button onClick={() => setPreds(preds.filter((_, j) => j !== i))} className="tech-muted hover:text-rose-400"><X size={12} /></button>}
        </div>
      ))}
      <button onClick={() => setPreds([...preds, { field: "", op: ">", value: "" }])} className="text-[11px] tech-accent hover:underline">+ condition</button>
    </div>
  );
}

export function SmartRulesManager({ smart, dynamic }: { smart: SmartRuleUi[]; dynamic: DynamicRuleUi[] }) {
  // live test market facts
  const [facts, setFacts] = useState({ volatility: "3", liquidity: "20", exposure: "0", segment: "vip", session: "london", news: "false" });
  const setFact = (k: string, v: string) => setFacts((p) => ({ ...p, [k]: v }));
  const testFacts: Record<string, number | string | boolean> = {
    volatility: Number(facts.volatility), liquidity: Number(facts.liquidity), exposure: Number(facts.exposure),
    segment: facts.segment, session: facts.session, news: facts.news === "true",
  };
  const fires = (cond: unknown) => { try { return evalCondition(cond, testFacts); } catch { return false; } };
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";

  return (
    <div className="tech-panel rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><Zap size={16} className="tech-accent" /><h2 className="text-sm font-semibold">Smart &amp; Dynamic Rules</h2><span className="text-[11px] tech-muted">— IF/THEN automation · evaluated in priority order</span></div>

      {/* Live "would fire now?" test against a market state */}
      <div className="tech-panel2 mb-4 rounded-lg border tech-border p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tech-muted"><FlaskConical size={12} /> Test against market</div>
        <div className="flex flex-wrap gap-2">
          {(["volatility", "liquidity", "exposure", "segment", "session"] as const).map((k) => (
            <label key={k} className="text-[10px] uppercase tech-muted">{k}<input value={facts[k]} onChange={(e) => setFact(k, e.target.value)} className={inp + " ml-1 w-20"} /></label>
          ))}
          <label className="text-[10px] uppercase tech-muted">news<select value={facts.news} onChange={(e) => setFact("news", e.target.value)} className={inp + " ml-1"}><option value="false">false</option><option value="true">true</option></select></label>
        </div>
      </div>

      <RuleList title="Smart rules" rows={smart} kind="smart" fires={fires} />
      <div className="mt-4"><RuleList title="Dynamic spread rules" rows={dynamic} kind="dynamic" fires={fires} /></div>
    </div>
  );
}

function RuleList({ title, rows, kind, fires }: { title: string; rows: (SmartRuleUi | DynamicRuleUi)[]; kind: "smart" | "dynamic"; fires: (c: unknown) => boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("100");
  const [preds, setPreds] = useState<Pred[]>([{ field: "volatility", op: ">", value: "2" }]);
  const [actionType, setActionType] = useState("widen");
  const [by, setBy] = useState("1");
  const [unit, setUnit] = useState("pips");
  const inp = "rounded border tech-border tech-panel2 px-2 py-1 text-xs";

  function add() {
    setErr(null);
    start(async () => {
      const condition = buildCondition(preds);
      const base = { name: name || `${kind} rule`, priority: Number(priority), condition, scope_type: "global" };
      const r = kind === "smart"
        ? await upsertSmart({ ...base, action: { type: actionType, by: Number(by) } })
        : await upsertDynamic({ ...base, delta_value: Number(by), unit });
      if (r.ok) { setOpen(false); setName(""); router.refresh(); } else setErr(r.error);
    });
  }
  const toggle = (id: string, en: boolean) => start(async () => { await (kind === "smart" ? toggleSmart : toggleDynamic)(id, en); router.refresh(); });
  const del = (id: string) => { if (confirm("Delete rule?")) start(async () => { await (kind === "smart" ? deleteSmart : deleteDynamic)(id); router.refresh(); }); };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tech-muted">{title}</h3>
        <button onClick={() => { setOpen(!open); setErr(null); }} className="inline-flex items-center gap-1 rounded border tech-border tech-panel2 px-2 py-1 text-[11px] tech-muted hover:tech-accent"><Plus size={12} /> Add</button>
      </div>

      {open && (
        <div className="tech-panel2 mb-3 space-y-2 rounded-lg border tech-border p-3">
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="rule name" className={inp + " flex-1"} />
            <input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="priority" className={inp + " w-20"} />
          </div>
          <CondEditor preds={preds} setPreds={setPreds} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tech-muted">THEN</span>
            {kind === "smart" ? (
              <><select value={actionType} onChange={(e) => setActionType(e.target.value)} className={inp}>{ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="by" className={inp + " w-20"} /></>
            ) : (
              <><span className="text-[11px] tech-muted">spread delta</span><input value={by} onChange={(e) => setBy(e.target.value)} placeholder="delta" className={inp + " w-20"} />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inp}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></>
            )}
            <button onClick={add} disabled={pending} className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Save</button>
          </div>
          {err && <div className="text-[11px] text-rose-400">{err}</div>}
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map((r) => {
          const f = fires(r.condition);
          const action = kind === "smart" ? `${(r as SmartRuleUi).action?.type ?? "?"} ${(r as SmartRuleUi).action?.by ?? ""}` : `spread ${(r as DynamicRuleUi).delta_value} ${(r as DynamicRuleUi).unit}`;
          return (
            <div key={r.id} className={`tech-panel2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${r.enabled ? "" : "opacity-50"}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${f ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>{f ? "fires" : "idle"}</span>
                <span className="shrink-0 font-medium">{r.name}</span>
                <span className="truncate tech-muted">IF {condSummary(r.condition)} → <span className="tech-accent">{action}</span></span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="tech-muted">p{r.priority}</span>
                <button disabled={pending} onClick={() => toggle(r.id, !r.enabled)} className="rounded p-1 tech-muted hover:text-amber-400"><Power size={13} /></button>
                <button disabled={pending} onClick={() => del(r.id)} className="rounded p-1 tech-muted hover:text-rose-400"><Trash2 size={13} /></button>
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="py-3 text-center text-xs tech-muted">No {title.toLowerCase()}.</div>}
      </div>
    </div>
  );
}
