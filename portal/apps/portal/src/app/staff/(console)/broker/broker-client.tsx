"use client";

// Broker Control Center UI (§16 increment 1). Every control writes the LIVE
// terminal instruments table through the audited server action. Honesty
// labels state exactly where each field is enforced.

import { Fragment, useState, useTransition } from "react";
import { Card, CardBody } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ShieldAlert, Layers } from "lucide-react";
import {
  updateBrokerInstrument, updateBrokerGroup, createTradingBlock, deleteTradingBlock,
  type BrokerInstrument, type BrokerAuditRow, type TradingBlock,
} from "@/lib/broker-actions";

// Fields that can be applied to a whole group at once (mirrors EDITABLE server-side).
type GroupFieldKind = "number" | "bool" | "routing";
const GROUP_FIELDS: { field: string; label: string; kind: GroupFieldKind; step?: string }[] = [
  { field: "commission_per_lot", label: "Commission /lot", kind: "number", step: "0.5" },
  { field: "swap_long", label: "Swap long /lot/day", kind: "number", step: "0.1" },
  { field: "swap_short", label: "Swap short /lot/day", kind: "number", step: "0.1" },
  { field: "min_lot", label: "Min lot", kind: "number", step: "0.01" },
  { field: "max_lot", label: "Max lot", kind: "number", step: "1" },
  { field: "spread_markup", label: "Spread markup (pts)", kind: "number", step: "0.1" },
  { field: "is_active", label: "Trading enabled", kind: "bool" },
  { field: "enforce_sessions", label: "Session enforcement", kind: "bool" },
  { field: "routing_mode", label: "Routing", kind: "routing" },
];

// Coerce a group-apply value the same way the server does, for optimistic state.
function coerceForState(kind: GroupFieldKind, raw: string): string | number | boolean {
  if (kind === "number") return Number(raw);
  if (kind === "bool") return raw === "true";
  return raw;
}

function TradingBlocksCard({
  blocks, onSaved, onError,
}: {
  blocks: TradingBlock[] | null;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const r = await createTradingBlock({ symbol: symbol.trim().toUpperCase() || null, reason, startsAt, endsAt });
      if (r.ok) { onSaved(`trading block ${symbol.trim().toUpperCase() || "ALL"} — ${reason.trim()}`); setReason(""); setStartsAt(""); setEndsAt(""); setSymbol(""); }
      else onError(r.error ?? "Could not create the block");
    });

  const remove = (b: TradingBlock) =>
    startTransition(async () => {
      const r = await deleteTradingBlock(b.id);
      if (r.ok) onSaved(`trading block removed (${b.symbol ?? "ALL"})`);
      else onError(r.error ?? "Could not remove the block");
    });

  const fmt = (s: string) => new Date(s).toISOString().slice(0, 16).replace("T", " ") + " UTC";

  return (
    <Card>
      <CardBody>
        <div className="mb-2 text-sm font-semibold text-navy">Trading blocks (news / maintenance windows)</div>
        <p className="mb-3 text-[11px] text-steel">
          New orders for the symbol (or all symbols) are rejected while a block is active — traders see your reason and the end time. Closing existing positions stays allowed.
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-[10px] uppercase tracking-wide text-steel">Symbol
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="blank = ALL"
              className="mt-0.5 block w-24 rounded border border-steel/25 px-2 py-1 font-mono text-[11px] uppercase text-navy outline-none focus:border-sky" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-steel">Reason (shown to traders)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. NFP release"
              className="mt-0.5 block w-52 rounded border border-steel/25 px-2 py-1 text-[11px] text-navy outline-none focus:border-sky" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-steel">Starts
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
              className="mt-0.5 block rounded border border-steel/25 px-2 py-1 text-[11px] text-navy outline-none focus:border-sky" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-steel">Ends
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="mt-0.5 block rounded border border-steel/25 px-2 py-1 text-[11px] text-navy outline-none focus:border-sky" />
          </label>
          <button onClick={create} disabled={pending || !reason.trim() || !startsAt || !endsAt}
            className="rounded bg-sky px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
            Add block
          </button>
        </div>
        {(blocks ?? []).length === 0 ? (
          <p className="text-[11px] text-steel">No current or upcoming blocks.</p>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
                <th className="px-2 py-1.5">Symbol</th>
                <th className="px-2 py-1.5">Reason</th>
                <th className="px-2 py-1.5">Window (UTC)</th>
                <th className="px-2 py-1.5">By</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {(blocks ?? []).map((b) => {
                const active = new Date(b.starts_at) <= new Date() && new Date() <= new Date(b.ends_at);
                return (
                  <tr key={b.id} className="border-b border-steel/10">
                    <td className="px-2 py-1.5 font-mono text-navy">{b.symbol ?? "ALL"}</td>
                    <td className="px-2 py-1.5 text-navy">{b.reason} {active && <StatusBadge tone="danger">active</StatusBadge>}</td>
                    <td className="px-2 py-1.5 font-mono text-steel">{fmt(b.starts_at)} → {fmt(b.ends_at)}</td>
                    <td className="px-2 py-1.5 text-steel">{b.created_by}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => remove(b)} disabled={pending} className="text-[11px] font-semibold text-danger disabled:opacity-40">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

function NumberCell({
  symbol, field, value, step, onSaved, onError,
}: {
  symbol: string; field: string; value: number; step?: string;
  onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [pending, startTransition] = useTransition();
  const dirty = draft !== String(value) && draft.trim() !== "";
  const save = () =>
    startTransition(async () => {
      const r = await updateBrokerInstrument(symbol, field, draft);
      if (r.ok) onSaved(`${symbol} ${field} → ${draft}`);
      else { onError(r.error ?? "Update failed"); setDraft(String(value)); }
    });
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && dirty) save(); }}
        disabled={pending}
        className="w-16 rounded border border-steel/25 bg-white px-1.5 py-0.5 text-right font-mono text-[11px] text-navy outline-none focus:border-sky disabled:opacity-50"
      />
      {dirty && (
        <button onClick={save} disabled={pending} className="rounded bg-sky px-1.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-50">
          ✓
        </button>
      )}
    </span>
  );
}

function GroupStandardsCard({
  groups, onApply, pending,
}: {
  groups: { type: string; count: number }[];
  onApply: (group: string, field: string, kind: GroupFieldKind, value: string) => void;
  pending: boolean;
}) {
  const [group, setGroup] = useState(groups[0]?.type ?? "");
  const [field, setField] = useState(GROUP_FIELDS[0].field);
  const [num, setNum] = useState("");
  const [bool, setBool] = useState("true");
  const [routing, setRouting] = useState("a_book");

  const meta = GROUP_FIELDS.find((f) => f.field === field)!;
  const count = groups.find((g) => g.type === group)?.count ?? 0;
  const valueFor = () => (meta.kind === "number" ? num : meta.kind === "bool" ? bool : routing);
  const readable = () =>
    meta.kind === "number" ? num
    : meta.kind === "bool" ? (bool === "true" ? "ON" : "OFF")
    : routing === "a_book" ? "A-Book" : routing === "b_book" ? "B-Book" : "Hybrid";

  const apply = () => {
    if (!group) return;
    if (meta.kind === "number" && !(num.trim() !== "" && Number.isFinite(Number(num)))) return;
    if (!window.confirm(`Apply ${meta.label} = ${readable()} to all ${count} "${group}" symbol(s)? Every change is audited.`)) return;
    onApply(group, field, meta.kind, valueFor());
  };
  const canApply = !pending && !!group && (meta.kind !== "number" || (num.trim() !== "" && Number.isFinite(Number(num))));

  return (
    <Card>
      <CardBody>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy">
          <Layers className="h-4 w-4 text-sky" /> Group standards — apply to a whole group
        </div>
        <p className="mb-3 text-[11px] text-steel">
          Set one field for every symbol in a group at once (e.g. commission for all metals, or routing for all forex).
          This is a bulk shortcut over the per-symbol table below — each symbol is written and audited individually, and
          you can still override any single symbol afterwards.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] uppercase tracking-wide text-steel">Group
            <select value={group} onChange={(e) => setGroup(e.target.value)}
              className="mt-0.5 block rounded border border-steel/25 bg-white px-2 py-1 text-[11px] capitalize text-navy outline-none focus:border-sky">
              {groups.map((g) => <option key={g.type} value={g.type}>{g.type} ({g.count})</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-steel">Field
            <select value={field} onChange={(e) => setField(e.target.value)}
              className="mt-0.5 block rounded border border-steel/25 bg-white px-2 py-1 text-[11px] text-navy outline-none focus:border-sky">
              {GROUP_FIELDS.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-steel">Value
            {meta.kind === "number" ? (
              <input value={num} step={meta.step} inputMode="decimal" onChange={(e) => setNum(e.target.value)} placeholder="0"
                className="mt-0.5 block w-24 rounded border border-steel/25 px-2 py-1 text-right font-mono text-[11px] text-navy outline-none focus:border-sky" />
            ) : meta.kind === "bool" ? (
              <select value={bool} onChange={(e) => setBool(e.target.value)}
                className="mt-0.5 block rounded border border-steel/25 bg-white px-2 py-1 text-[11px] text-navy outline-none focus:border-sky">
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : (
              <select value={routing} onChange={(e) => setRouting(e.target.value)}
                className="mt-0.5 block rounded border border-steel/25 bg-white px-2 py-1 text-[11px] text-navy outline-none focus:border-sky">
                <option value="a_book">A-Book</option>
                <option value="b_book">B-Book</option>
                <option value="hybrid">Hybrid</option>
              </select>
            )}
          </label>
          <button onClick={apply} disabled={!canApply}
            className="rounded bg-sky px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
            Apply to {count} symbol{count === 1 ? "" : "s"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

export function BrokerControls({
  instruments, audit, blocks,
}: {
  instruments: BrokerInstrument[] | null;
  audit: BrokerAuditRow[] | null;
  blocks: TradingBlock[] | null;
}) {
  const [rows, setRows] = useState<BrokerInstrument[]>(instruments ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saved = (msg: string) => { setNotice(`Saved: ${msg} (audited)`); setError(null); };
  const failed = (msg: string) => { setError(msg); setNotice(null); };

  const toggleSessions = (r: BrokerInstrument) =>
    startTransition(async () => {
      const next = !r.enforce_sessions;
      const res = await updateBrokerInstrument(r.symbol, "enforce_sessions", next);
      if (res.ok) {
        setRows((prev) => prev.map((x) => (x.symbol === r.symbol ? { ...x, enforce_sessions: next } : x)));
        saved(`${r.symbol} session enforcement ${next ? "ON" : "OFF"}`);
      } else failed(res.error ?? "Update failed");
    });

  const toggleActive = (r: BrokerInstrument) =>
    startTransition(async () => {
      const next = !r.is_active;
      const res = await updateBrokerInstrument(r.symbol, "is_active", next);
      if (res.ok) {
        setRows((prev) => prev.map((x) => (x.symbol === r.symbol ? { ...x, is_active: next } : x)));
        saved(`${r.symbol} trading ${next ? "ENABLED" : "DISABLED"}`);
      } else failed(res.error ?? "Update failed");
    });

  const setRouting = (r: BrokerInstrument, mode: string) =>
    startTransition(async () => {
      const res = await updateBrokerInstrument(r.symbol, "routing_mode", mode);
      if (res.ok) {
        setRows((prev) => prev.map((x) => (x.symbol === r.symbol ? { ...x, routing_mode: mode } : x)));
        saved(`${r.symbol} routing → ${mode}`);
      } else failed(res.error ?? "Update failed");
    });

  // Distinct groups (instrument type) with counts, for the bulk-apply card + headers.
  const groups = (() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => a.type.localeCompare(b.type));
  })();
  // Rows sorted by group then symbol so group header rows can be injected.
  const sortedRows = [...rows].sort((a, b) => (a.type === b.type ? a.symbol.localeCompare(b.symbol) : a.type.localeCompare(b.type)));

  const applyGroup = (group: string, field: string, kind: GroupFieldKind, value: string) =>
    startTransition(async () => {
      const res = await updateBrokerGroup(group, field, value);
      if (res.ok) {
        const next = coerceForState(kind, value);
        setRows((prev) => prev.map((x) => (x.type === group ? { ...x, [field]: next } : x)));
        saved(`${res.updated} ${group} symbol(s) · ${field} → ${value}${res.failed ? ` (${res.failed} failed)` : ""}`);
      } else failed(res.error ?? "Group update failed");
    });

  if (instruments == null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Broker Controls" subtitle="Per-symbol trading controls on the live Raptor terminal" />
        <Card><CardBody>
          <p className="text-sm text-steel">
            Terminal connection unavailable or you are not granted the Broker Controls section.
            The bridge reads the terminal URL and service key from bridge_secrets — check Tech Hub → Bridge.
          </p>
        </CardBody></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Broker Controls"
        subtitle="Per-symbol trading rules enforced on the live Raptor terminal — every change is audited"
      />

      {(notice || error) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"}`}>
          {error ?? notice}
        </div>
      )}

      <GroupStandardsCard groups={groups} onApply={applyGroup} pending={pending} />

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <div className="px-3 pt-3 text-[11px] font-semibold text-navy">Per-symbol overrides</div>
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Trading</th>
                <th className="px-3 py-2 text-right">Commission /lot</th>
                <th className="px-3 py-2 text-right">Swap long /lot/day</th>
                <th className="px-3 py-2 text-right">Swap short /lot/day</th>
                <th className="px-3 py-2 text-right">Min lot</th>
                <th className="px-3 py-2 text-right">Max lot</th>
                <th className="px-3 py-2 text-right">Spread markup</th>
                <th className="px-3 py-2">Sessions</th>
                <th className="px-3 py-2">Routing</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const showHeader = i === 0 || sortedRows[i - 1].type !== r.type;
                const groupCount = groups.find((g) => g.type === r.type)?.count ?? 0;
                return (
                <Fragment key={r.symbol}>
                {showHeader && (
                  <tr className="bg-steel/5">
                    <td colSpan={10} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-steel">
                      {r.type} <span className="font-normal text-steel/70">· {groupCount} symbol{groupCount === 1 ? "" : "s"}</span>
                    </td>
                  </tr>
                )}
                <tr className="border-b border-steel/10 hover:bg-sky/5">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-navy">{r.symbol}</div>
                    <div className="text-[10px] capitalize text-steel">{r.type}{r.session_hours ? ` · ${r.session_hours}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleActive(r)} disabled={pending} className="disabled:opacity-50">
                      <StatusBadge tone={r.is_active ? "success" : "danger"}>
                        {r.is_active ? "Enabled" : "Disabled"}
                      </StatusBadge>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="commission_per_lot" value={r.commission_per_lot} step="0.5" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="swap_long" value={r.swap_long} step="0.1" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="swap_short" value={r.swap_short} step="0.1" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="min_lot" value={r.min_lot} step="0.01" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="max_lot" value={r.max_lot} step="1" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <NumberCell symbol={r.symbol} field="spread_markup" value={r.spread_markup} step="0.1" onSaved={saved} onError={failed} />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleSessions(r)} disabled={pending}
                      title={r.session_hours === "24x7" ? "24x7 symbol — never closes" : "Toggle weekend-close enforcement (Fri 21:00 → Sun 21:00 UTC)"}
                      className="disabled:opacity-50">
                      <StatusBadge tone={r.session_hours === "24x7" ? "neutral" : r.enforce_sessions ? "success" : "warning"}>
                        {r.session_hours === "24x7" ? "24×7" : r.enforce_sessions ? "Enforced" : "Off"}
                      </StatusBadge>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.routing_mode}
                      onChange={(e) => setRouting(r, e.target.value)}
                      disabled={pending}
                      className="rounded border border-steel/25 bg-white px-1.5 py-0.5 text-[11px] text-navy outline-none disabled:opacity-50"
                    >
                      <option value="a_book">A-Book</option>
                      <option value="b_book">B-Book</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </td>
                </tr>
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <TradingBlocksCard blocks={blocks} onSaved={saved} onError={failed} />

      <Card>
        <CardBody>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
            <ShieldAlert className="h-4 w-4 text-sky" /> Where each control is enforced
          </div>
          <ul className="space-y-1 text-[12px] text-steel">
            <li>• <b>Trading Enabled/Disabled, Min/Max lot, Commission</b> — enforced by the terminal&apos;s <code>place_market_order</code>: disabled symbols reject new orders; lots outside bounds reject; commission is charged per lot at open.</li>
            <li>• <b>Swap long/short</b> — applied by <code>close_position</code>: whole calendar days held × rate × lots, added to realized P&amp;L (negative = cost). <b>Wednesday counts triple</b> (standard rollover convention, simplified to calendar days).</li>
            <li>• <b>Sessions</b> — when Enforced, <code>place_market_order</code> rejects new orders from Fri 21:00 to Sun 21:00 UTC. Default is Off so the 24/7 demo feed keeps trading until you flip it; 24×7 symbols (crypto) never close.</li>
            <li>• <b>Trading blocks</b> — active windows below make <code>place_market_order</code> reject new orders for the symbol (or all symbols) with your reason and the end time. Existing positions can still be closed.</li>
            <li>• <b>Routing</b> — consumed by the Dealer Desk bridge (A/B-book assignment sync).</li>
            <li>• <b>Spread markup</b> — stored broker config read by the pricing layer; the terminal&apos;s demo feed does not add it to displayed quotes yet.</li>
            <li>• Traders have no access to any of this: writes go through the staff-only service-role bridge and are recorded in the audit trail below.</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-2 text-sm font-semibold text-navy">Recent changes (broker_config_audit)</div>
          {(audit ?? []).length === 0 ? (
            <p className="text-[12px] text-steel">No configuration changes recorded yet.</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-steel/25 text-[10px] uppercase tracking-wide text-steel">
                  <th className="px-2 py-1.5">When (UTC)</th>
                  <th className="px-2 py-1.5">Actor</th>
                  <th className="px-2 py-1.5">Symbol</th>
                  <th className="px-2 py-1.5">Field</th>
                  <th className="px-2 py-1.5">Old → New</th>
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).map((a, i) => (
                  <tr key={i} className="border-b border-steel/10">
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-steel">{new Date(a.changed_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="px-2 py-1.5 text-navy">{a.actor}</td>
                    <td className="px-2 py-1.5 font-mono text-navy">{a.symbol}</td>
                    <td className="px-2 py-1.5 text-steel">{a.field}</td>
                    <td className="px-2 py-1.5 font-mono text-steel">{a.old_value ?? "—"} → <span className="text-navy">{a.new_value ?? "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
