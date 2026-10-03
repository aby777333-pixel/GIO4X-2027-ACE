import type { ScopeType } from "../types/enums";
import type { BookConfigRow } from "../types/rows";

const key = (st: ScopeType, ref: string | null) => `${st}:${ref ?? "*"}`;

// Invalidatable in-memory cache the hot-path resolver reads (never the DB).
// Keeps the lowest-priority ENABLED row per (scopeType, scopeRef).
export class ConfigCache {
  private map = new Map<string, BookConfigRow>();

  constructor(rows: BookConfigRow[] = []) {
    this.load(rows);
  }

  load(rows: BookConfigRow[]): void {
    this.map.clear();
    for (const r of rows) {
      if (!r.enabled) continue;
      const k = key(r.scopeType, r.scopeRef);
      const cur = this.map.get(k);
      if (!cur || r.priority < cur.priority) this.map.set(k, r);
    }
  }

  get(st: ScopeType, ref: string | null): BookConfigRow | null {
    return this.map.get(key(st, ref)) ?? null;
  }

  size(): number {
    return this.map.size;
  }
}
