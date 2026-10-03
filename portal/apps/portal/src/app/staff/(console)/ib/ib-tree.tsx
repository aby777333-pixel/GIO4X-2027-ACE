"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { setIbRole, unlinkIb, reparentIb, type IbNode } from "@/lib/ib-actions";
import type { ProfileOption } from "@/lib/ib-actions";
import { ProfilePicker } from "./ib-tools";

type TreeNode = IbNode & { children: TreeNode[]; depth: number };

function tier(depth: number, role: string): { label: string; cls: string } {
  if (role !== "ib") return { label: "Client", cls: "bg-slate-100 text-slate-600" };
  if (depth === 0) return { label: "Master IB", cls: "bg-amber-100 text-amber-700" };
  if (depth === 1) return { label: "Sub-IB", cls: "bg-sky-100 text-sky-700" };
  if (depth === 2) return { label: "Sub-sub IB", cls: "bg-indigo-100 text-indigo-700" };
  return { label: `L${depth + 1} IB`, cls: "bg-violet-100 text-violet-700" };
}

function buildTree(nodes: IbNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    nodes.map((n) => [n.id, { ...n, children: [], depth: 0 }]),
  );
  const roots: TreeNode[] = [];
  for (const n of byId.values()) {
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const walk = (n: TreeNode, d: number) => {
    n.depth = d;
    n.children.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    n.children.forEach((c) => walk(c, d + 1));
  };
  roots.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  roots.forEach((r) => walk(r, 0));
  return roots;
}

export function IbTree({ nodes }: { nodes: IbNode[] }) {
  const roots = useMemo(() => buildTree(nodes), [nodes]);
  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-steel">
        No IBs in the network yet. Register / promote a client to IB below to start building the tree.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {roots.map((n) => (
        <NodeRow key={n.id} node={n} />
      ))}
    </div>
  );
}

function NodeRow({ node }: { node: TreeNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [moving, setMoving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const t = tier(node.depth, node.role);
  const isIb = node.role === "ib";
  const hasChildren = node.children.length > 0;

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    startTransition(async () => {
      const r = await run();
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Action failed.");
    });
  }

  const btn =
    "rounded-md border border-slate-200 px-2 py-1 text-[11px] text-navy transition hover:bg-slate-50 disabled:opacity-50";

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2"
        style={{ marginLeft: node.depth * 22 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-steel-light"
          aria-label="Toggle"
        >
          {hasChildren ? (
            open ? <ChevronDown size={15} /> : <ChevronRight size={15} />
          ) : (
            <span className="inline-block w-[15px]" />
          )}
        </button>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.cls}`}>
          {t.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-navy">
            {node.full_name?.trim() || node.email || node.id.slice(0, 8)}
          </div>
          <div className="truncate text-[11px] text-steel-light">
            {node.email}
            {node.referral_code ? ` · ${node.referral_code}` : ""}
            {hasChildren ? ` · ${node.children.length} direct` : ""}
          </div>
        </div>
        {node.accrued > 0 ? (
          <span className="shrink-0 text-[11px] font-semibold text-emerald-600">
            ${node.accrued.toFixed(2)}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={pending} className={btn} onClick={() => act(() => setIbRole(node.id, !isIb))}>
            {isIb ? "Demote" : "Make IB"}
          </button>
          <button type="button" disabled={pending} className={btn} onClick={() => setMoving((m) => !m)}>
            Move
          </button>
          {node.parent_id ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              onClick={() => act(() => unlinkIb(node.id))}
            >
              Detach
            </button>
          ) : null}
        </div>
      </div>

      {err ? (
        <p className="text-[11px] text-rose-600" style={{ marginLeft: node.depth * 22 + 26 }}>
          {err}
        </p>
      ) : null}

      {moving ? (
        <div
          className="mt-1 rounded-lg border border-sky/30 bg-sky/5 p-2"
          style={{ marginLeft: node.depth * 22 + 26 }}
        >
          <MovePicker
            onMove={(parentId) => {
              setMoving(false);
              act(() => reparentIb(node.id, parentId));
            }}
            onCancel={() => setMoving(false)}
          />
        </div>
      ) : null}

      {open ? node.children.map((c) => <NodeRow key={c.id} node={c} />) : null}
    </div>
  );
}

function MovePicker({
  onMove,
  onCancel,
}: {
  onMove: (parentId: string) => void;
  onCancel: () => void;
}) {
  const [pick, setPick] = useState<ProfileOption | null>(null);
  return (
    <div className="space-y-2">
      <ProfilePicker label="New parent IB" value={pick} onPick={setPick} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!pick}
          onClick={() => pick && onMove(pick.id)}
          className="rounded-md bg-sky px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          Move here
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px]">
          Cancel
        </button>
      </div>
    </div>
  );
}
