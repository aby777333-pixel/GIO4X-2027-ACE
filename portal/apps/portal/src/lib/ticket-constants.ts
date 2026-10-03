// §22 Dispute resolution codes — how a ticket was closed out. Plain module
// (not a server-action file) so both the action and the client panel can import
// the list. Stored as text on support_tickets.resolution_code.

export const RESOLUTION_CODES: { code: string; label: string }[] = [
  { code: "resolved", label: "Resolved — issue fixed" },
  { code: "info_provided", label: "Information provided" },
  { code: "no_fault_found", label: "No fault found" },
  { code: "cannot_reproduce", label: "Cannot reproduce" },
  { code: "user_error", label: "User error / guidance given" },
  { code: "duplicate", label: "Duplicate ticket" },
  { code: "refunded", label: "Refunded / adjusted" },
  { code: "dispute_upheld", label: "Dispute upheld (in client's favour)" },
  { code: "dispute_rejected", label: "Dispute rejected" },
  { code: "escalated", label: "Escalated externally" },
  { code: "policy_decision", label: "Policy decision" },
  { code: "wont_fix", label: "Won't fix" },
];

export const RESOLUTION_LABEL: Record<string, string> = Object.fromEntries(
  RESOLUTION_CODES.map((r) => [r.code, r.label]),
);

export function isValidResolutionCode(code: string): boolean {
  return RESOLUTION_CODES.some((r) => r.code === code);
}
