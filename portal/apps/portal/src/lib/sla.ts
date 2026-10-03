// §22 Service-desk SLA — pure, explainable time-to-resolution targets by
// priority. The clock runs while WE own the ticket (open / in progress) and
// pauses while we're waiting on the customer; resolved/closed have no SLA.

export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";

// Hours to resolution by priority (broker-tunable defaults).
export const SLA_TARGET_HOURS: Record<TicketPriority, number> = {
  urgent: 2, high: 8, normal: 24, low: 72,
};

export type SlaState = "ok" | "at_risk" | "breached" | "paused" | "done";

export interface SlaResult {
  state: SlaState;
  label: string;
  remainingMs: number;   // negative = overdue
}

function fmtDur(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function slaFor(priority: TicketPriority, status: TicketStatus, createdAtIso: string, nowMs: number): SlaResult {
  if (status === "resolved" || status === "closed") return { state: "done", label: "—", remainingMs: 0 };
  if (status === "waiting_customer") return { state: "paused", label: "waiting on customer", remainingMs: 0 };
  const target = (SLA_TARGET_HOURS[priority] ?? 24) * 3_600_000;
  const elapsed = nowMs - new Date(createdAtIso).getTime();
  const remaining = target - elapsed;
  if (remaining <= 0) return { state: "breached", label: `overdue ${fmtDur(remaining)}`, remainingMs: remaining };
  if (remaining <= target * 0.25) return { state: "at_risk", label: `due in ${fmtDur(remaining)}`, remainingMs: remaining };
  return { state: "ok", label: `due in ${fmtDur(remaining)}`, remainingMs: remaining };
}

export const SLA_TONE: Record<SlaState, "danger" | "warning" | "success" | "neutral" | "info"> = {
  breached: "danger", at_risk: "warning", ok: "success", paused: "neutral", done: "info",
};
