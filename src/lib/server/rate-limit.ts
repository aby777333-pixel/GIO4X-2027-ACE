/**
 * Best-effort, in-memory, sliding-window rate limiter.
 *
 * READ THIS BEFORE RELYING ON IT. The site runs on serverless functions. This
 * state lives in the memory of one function instance: it is not shared between
 * instances and it disappears whenever an instance is recycled. It slows down a
 * casual script hitting one warm instance; it does not stop a determined or
 * distributed sender. The durable limits are in the database
 * (supabase/migrations/0003_triggers.sql), which every insert must pass no
 * matter how it arrives. See docs/SECURITY.md, "Rate limiting".
 */

type Hits = number[];

// Kept on globalThis so that a module re-evaluation inside the same process
// (hot reload in development, more than one bundle importing this file) shares
// one set of counters instead of silently starting again from zero.
const store = globalThis as typeof globalThis & { __gxRateBuckets?: Map<string, Hits> };
const buckets: Map<string, Hits> = (store.__gxRateBuckets ??= new Map<string, Hits>());
const MAX_KEYS = 5000;

export type RateRule = { limit: number; windowMs: number };
export type RateResult = { ok: boolean; retryAfterSeconds: number };

function prune(now: number, longestWindowMs: number): void {
  for (const [key, hits] of buckets) {
    const last = hits[hits.length - 1];
    if (last === undefined || now - last > longestWindowMs) buckets.delete(key);
  }
  // still full after pruning: drop the oldest keys (Map keeps insertion order)
  if (buckets.size > MAX_KEYS) {
    let excess = buckets.size - MAX_KEYS;
    for (const key of buckets.keys()) {
      if (excess-- <= 0) break;
      buckets.delete(key);
    }
  }
}

/**
 * Counts one hit for `scope:key` and reports whether it is within the rule.
 * A refused hit is not recorded, so a blocked client is released exactly one
 * window after its last accepted request.
 */
export function rateLimit(scope: string, key: string, rule: RateRule, now = Date.now()): RateResult {
  const id = `${scope}:${key}`;
  const since = now - rule.windowMs;
  const hits = (buckets.get(id) ?? []).filter((t) => t > since);

  if (hits.length >= rule.limit) {
    buckets.set(id, hits);
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)) };
  }

  hits.push(now);
  buckets.set(id, hits);
  if (buckets.size > MAX_KEYS) prune(now, 60 * 60 * 1000);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Per-IP rules for the public form endpoints. */
export const RULES = {
  /** any request at all, valid or not */
  attempts: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** requests that passed validation and are about to be stored */
  submissions: { limit: 5, windowMs: 10 * 60 * 1000 },
  /** sign-in attempts to GIO4X Control (Supabase Auth applies its own limits as well) */
  signIn: { limit: 10, windowMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RateRule>;
