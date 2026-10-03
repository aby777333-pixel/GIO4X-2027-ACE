import type { Enums } from "@gio4x/supabase";
import type { StatusTone } from "@/components/StatusBadge";

export type LeadStage = Enums<"crm_lead_stage">;
export type LeadStatus = Enums<"crm_lead_status">;
export type ActivityKind = Enums<"crm_activity_kind">;
export type TaskStatus = Enums<"crm_task_status">;
export type Priority = Enums<"ticket_priority">;

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export function stageTone(stage: LeadStage): StatusTone {
  switch (stage) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    case "proposal":
    case "qualified":
      return "info";
    case "contacted":
      return "warning";
    default:
      return "neutral";
  }
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  "note",
  "call",
  "email",
  "whatsapp",
  "sms",
  "meeting",
];

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  meeting: "Meeting",
  stage_change: "Stage change",
  assignment: "Assignment",
  system: "System",
};

export const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
