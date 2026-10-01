/**
 * Deterministic layouts for the Labs graph views. No simulation, no
 * randomness: the same focus always produces the same picture.
 *
 * Market Universe: the focused node at the centre, its neighbours on a first
 * ring ordered by kind (so each kind occupies a sector), and a selection of
 * their neighbours on a second ring whose radius is φ times the first, each
 * placed just outside the neighbour it hangs from.
 */
import { compareNodes, edges, getNode, neighbours, type Connection, type GraphNode } from "@/data/graph";

export const PHI = 1.618;

export type Placed = { id: string; node: GraphNode; ring: 0 | 1 | 2; x: number; y: number; angle: number; parent?: string };
/** tier 0: focus to neighbour · tier 1: neighbour to its second-ring node · tier 2: any other relation between two visible nodes */
export type Wire = { a: string; b: string; tier: 0 | 1 | 2 };

export type Layout = {
  focus: string;
  r1: number;
  r2: number;
  placed: Placed[];
  index: Map<string, Placed>;
  wires: Wire[];
  /** first-ring ids, clockwise from the top */
  ring1: string[];
  /** boundaries between kind sectors on the first ring (radians) */
  ticks: number[];
  ring2Shown: number;
  ring2Total: number;
};

export type LayoutOptions = {
  r1: number;
  /** most second-ring nodes hung from one neighbour */
  perParent: number;
  /** angular slots available in total; the second ring gets what the first leaves */
  budget: number;
  min2: number;
  max2: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SECTOR_GAP = 0.6;
const MAX_CHILD_STEP = (13 * Math.PI) / 180;

export function computeLayout(focusId: string, o: LayoutOptions): Layout {
  const focus = getNode(focusId);
  const r1 = o.r1;
  const r2 = r1 * PHI;
  const placed: Placed[] = [];
  const index = new Map<string, Placed>();
  const empty: Layout = { focus: focusId, r1, r2, placed, index, wires: [], ring1: [], ticks: [], ring2Shown: 0, ring2Total: 0 };
  if (!focus) return empty;

  const put = (p: Placed) => {
    placed.push(p);
    index.set(p.id, p);
  };
  put({ id: focus.id, node: focus, ring: 0, x: 0, y: 0, angle: 0 });

  const first = neighbours(focusId).map((l) => l.node); // already in kind-then-name order
  const firstIds = new Set(first.map((n) => n.id));

  // candidates for the second ring, with the first-ring nodes each one touches
  const cand = new Map<string, { node: GraphNode; parents: string[] }>();
  for (const p of first) {
    for (const l of neighbours(p.id)) {
      const id = l.node.id;
      if (id === focusId || firstIds.has(id)) continue;
      const c = cand.get(id) ?? { node: l.node, parents: [] };
      c.parents.push(p.id);
      cand.set(id, c);
    }
  }
  const ordered = [...cand.values()].sort((a, b) => b.parents.length - a.parents.length || compareNodes(a.node, b.node));
  const max2 = clamp(o.budget - first.length, o.min2, o.max2);
  const children = new Map<string, GraphNode[]>(first.map((n) => [n.id, []]));
  const order = new Map(first.map((n, i) => [n.id, i]));
  let shown = 0;
  for (const c of ordered) {
    if (shown >= max2) break;
    // hang it from the least crowded of its neighbours, so the ring fills evenly
    let best: string | null = null;
    for (const p of c.parents) {
      const n = children.get(p)?.length ?? 0;
      if (n >= o.perParent) continue;
      if (best === null) best = p;
      else {
        const nb = children.get(best)?.length ?? 0;
        if (n < nb || (n === nb && (order.get(p) ?? 0) < (order.get(best) ?? 0))) best = p;
      }
    }
    if (best === null) continue;
    children.get(best)?.push(c.node);
    shown++;
  }

  // angular budget: every first-ring node owns a wedge as wide as what hangs from it
  const weights = first.map((n) => Math.max(1, children.get(n.id)?.length ?? 0));
  let gaps = 0;
  for (let i = 0; i < first.length; i++) {
    const next = first[(i + 1) % first.length];
    if (first.length > 1 && next.kind !== first[i].kind) gaps++;
  }
  const total = weights.reduce((a, b) => a + b, 0) + gaps * SECTOR_GAP;
  const unit = total > 0 ? (Math.PI * 2) / total : 0;
  const ticks: number[] = [];
  let cursor = -Math.PI / 2 - (weights[0] ?? 0) * unit * 0.5;
  first.forEach((n, i) => {
    const w = weights[i] * unit;
    const angle = cursor + w / 2;
    put({ id: n.id, node: n, ring: 1, x: Math.cos(angle) * r1, y: Math.sin(angle) * r1, angle });
    const kids = [...(children.get(n.id) ?? [])].sort(compareNodes);
    const step = Math.min(unit, MAX_CHILD_STEP);
    kids.forEach((k, j) => {
      const a = angle + (j - (kids.length - 1) / 2) * step;
      put({ id: k.id, node: k, ring: 2, x: Math.cos(a) * r2, y: Math.sin(a) * r2, angle: a, parent: n.id });
    });
    cursor += w;
    const next = first[(i + 1) % first.length];
    if (first.length > 1 && next.kind !== n.kind) {
      ticks.push(cursor + (SECTOR_GAP * unit) / 2);
      cursor += SECTOR_GAP * unit;
    }
  });

  const wires: Wire[] = [];
  for (const n of first) wires.push({ a: focusId, b: n.id, tier: 0 });
  for (const p of placed) if (p.ring === 2 && p.parent) wires.push({ a: p.parent, b: p.id, tier: 1 });
  for (const e of edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (!a || !b || a.ring === 0 || b.ring === 0) continue;
    if (a.ring === 2 && b.ring === 2) continue;
    if (a.parent === b.id || b.parent === a.id) continue;
    wires.push({ a: a.id, b: b.id, tier: 2 });
  }

  return { focus: focusId, r1, r2, placed, index, wires, ring1: first.map((n) => n.id), ticks, ring2Shown: shown, ring2Total: cand.size };
}

/* ── transitions ────────────────────────────────────────────────────────── */

/** The site easing, cubic-bezier(.22,.61,.36,1), evaluated in JavaScript. */
export function easeOut(x: number): number {
  const x1 = 0.22, y1 = 0.61, x2 = 0.36, y2 = 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const err = ((ax * t + bx) * t + cx) * t - x;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  return ((ay * t + by) * t + cy) * t;
}

export type XY = { x: number; y: number };
export type Frame = {
  /** where every node of the target layout is drawn right now, and how opaque */
  pos: Map<string, XY & { o: number }>;
  /** nodes that belonged to the previous view and are leaving */
  ghosts: { node: GraphNode; x: number; y: number; o: number }[];
  /** labels fade out and back in around the move */
  labelOpacity: number;
};

/** One frame of the reorganisation: positions interpolated from `from` to the layout at progress t (0–1). */
export function frameAt(layout: Layout, from: Map<string, XY> | null, t: number): Frame {
  const pos = new Map<string, XY & { o: number }>();
  if (!from || t >= 1) {
    for (const p of layout.placed) pos.set(p.id, { x: p.x, y: p.y, o: 1 });
    return { pos, ghosts: [], labelOpacity: 1 };
  }
  const e = easeOut(t);
  for (const p of layout.placed) {
    const f = from.get(p.id);
    if (f) pos.set(p.id, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e, o: 1 });
    else pos.set(p.id, { x: p.x, y: p.y, o: clamp((t - 0.38) / 0.62, 0, 1) });
  }
  const ghosts: Frame["ghosts"] = [];
  const fade = 1 - clamp(t / 0.38, 0, 1);
  if (fade > 0) {
    for (const [id, f] of from) {
      if (layout.index.has(id)) continue;
      const node = getNode(id);
      if (node) ghosts.push({ node, x: f.x, y: f.y, o: fade });
    }
  }
  return { pos, ghosts, labelOpacity: clamp((t - 0.5) / 0.5, 0, 1) };
}

/* ── Connect the Dots ───────────────────────────────────────────────────── */

export type DotsLayout = { placed: { node: GraphNode; x: number; y: number; picked: boolean }[]; index: Map<string, XY>; radius: number };

/**
 * The picks sit evenly on a circle, in the order chosen. A node that only
 * joins them sits part-way along the chord between the picks it connects
 * (averaged when it serves several pairs), then anything too close is eased
 * apart by a fixed rule.
 */
export function layoutDots(c: Connection, radius = 120): DotsLayout {
  const index = new Map<string, XY>();
  const n = c.ids.length;
  c.ids.forEach((id, i) => {
    const a = n === 2 ? (i === 0 ? Math.PI : 0) : -Math.PI / 2 + (i * Math.PI * 2) / n;
    index.set(id, { x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  });
  const sums = new Map<string, { x: number; y: number; k: number }>();
  for (const p of c.paths) {
    const a = index.get(p.nodes[0].id);
    const b = index.get(p.nodes[p.nodes.length - 1].id);
    if (!a || !b) continue;
    p.nodes.forEach((node, i) => {
      if (c.ids.includes(node.id)) return;
      const f = i / (p.nodes.length - 1);
      const s = sums.get(node.id) ?? { x: 0, y: 0, k: 0 };
      // pull joining nodes towards the middle so they read as "between"
      s.x += (a.x + (b.x - a.x) * f) / PHI;
      s.y += (a.y + (b.y - a.y) * f) / PHI;
      s.k++;
      sums.set(node.id, s);
    });
  }
  const inner = [...sums.keys()].sort();
  for (const id of inner) {
    const s = sums.get(id);
    if (s) index.set(id, { x: s.x / s.k, y: s.y / s.k });
  }
  // ease apart: a fixed number of passes over a fixed order
  const min = radius * 0.42;
  const ids = [...index.keys()];
  for (let pass = 0; pass < 24; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = index.get(ids[i]);
        const b = index.get(ids[j]);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          // coincident: separate along a direction fixed by their order
          const ang = ((i * 7 + j * 13) % 12) * (Math.PI / 6);
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        const aPicked = c.ids.includes(ids[i]);
        const bPicked = c.ids.includes(ids[j]);
        // picks stay on their circle; only joining nodes move
        if (!aPicked) index.set(ids[i], { x: a.x - ux * push * (bPicked ? 2 : 1), y: a.y - uy * push * (bPicked ? 2 : 1) });
        if (!bPicked) index.set(ids[j], { x: b.x + ux * push * (aPicked ? 2 : 1), y: b.y + uy * push * (aPicked ? 2 : 1) });
      }
    }
  }
  const placed = c.nodes.map((node) => {
    const p = index.get(node.id) ?? { x: 0, y: 0 };
    return { node, x: p.x, y: p.y, picked: c.ids.includes(node.id) };
  });
  return { placed, index, radius };
}
