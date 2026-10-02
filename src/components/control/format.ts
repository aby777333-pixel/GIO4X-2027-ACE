import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import type { Json, LeadStage, LeadStatus, StaffRole } from "@/lib/supabase/types";

/** Metadata for a Control page: never indexed, never followed, never archived. */
export function controlMeta(title: string, path: string): Metadata {
  return {
    ...pageMeta({ title: `${title} · Control`, description: "GIO4X Control, the internal console for GIO4X staff.", path, index: false }),
    robots: { index: false, follow: false, nocache: true, noarchive: true },
  };
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

/**
 * The console shows one clock for everyone: UTC, labelled. An audit trail read
 * by people in different offices should not depend on who is looking.
 */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : `${dateTime.format(d)} UTC`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : dateOnly.format(d);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  compliance: "Compliance",
  finance: "Finance",
  dealing: "Dealing",
  support: "Support",
  sales: "Sales",
  agent: "Agent",
  viewer: "Viewer (read-only)",
};

/** What each role can do today. Must describe `role_capabilities` in 0004_capabilities.sql. */
export const ROLE_NOTE: Record<StaffRole, string> = {
  admin: "Everything, including staff access",
  compliance: "Reads everything, including the staff list. Changes nothing",
  finance: "Reads the audit log. The finance modules are not built yet",
  dealing: "Reads the audit log. The dealing modules are not built yet",
  support: "Works enquiries and follow-ups",
  sales: "Works enquiries and follow-ups, reads subscribers",
  agent: "Works enquiries and follow-ups, reads subscribers",
  viewer: "Reads enquiries, subscribers and the audit log",
};

export const STAGE_NOTE: Record<LeadStage, string> = {
  enquiry: "Has written in; nobody has replied yet",
  contacted: "Somebody has replied",
  qualified: "Wants an account and can have one",
  applying: "Has started an application",
  client: "Holds an account",
  lost: "Will not go further, with the reason",
};

/** Where a due time stands against the clock the page was rendered with. */
export function dueState(iso: string, now: number): "overdue" | "today" | "later" {
  const due = new Date(iso).getTime();
  if (Number.isNaN(due) || due < now) return "overdue";
  return new Date(due).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10) ? "today" : "later";
}

export const STATUS_NOTE: Record<LeadStatus, string> = {
  new: "Received, not yet picked up",
  open: "Being handled",
  waiting: "Waiting for the enquirer",
  resolved: "Closed",
  spam: "Not a genuine enquiry",
};

export function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

/** Flat key/value pairs from a JSON object, for display. Values are shortened; nothing is interpreted. */
export function jsonPairs(value: Json): { key: string; value: string }[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).map(([key, v]) => ({
    key,
    value: (v === null || v === undefined ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 160),
  }));
}
