import type { BookType } from "../types/enums";

// Auto book switcher decision. Hysteresis band + rate-limit prevent flapping.
// De-risking (→A-book) auto-applies; re-warming (→B-book) needs dealer approval.
export interface SwitchPolicy {
  toxicThreshold: number; // e.g. 70
  hysteresis: number; // e.g. 10 → must cool below 60 to leave A-book
  minMinutesBetween: number; // rate limit per account
}

export interface SwitchDecision {
  action: "auto" | "approve" | "none";
  toBook: BookType | null;
  reason: string;
}

export function decideSwitch(
  currentBook: BookType,
  riskScore: number,
  lastSwitchMinsAgo: number | null,
  policy: SwitchPolicy,
): SwitchDecision {
  const wantBook: BookType =
    riskScore >= policy.toxicThreshold
      ? "a_book"
      : riskScore <= policy.toxicThreshold - policy.hysteresis
        ? "b_book"
        : currentBook;

  if (wantBook === currentBook) return { action: "none", toBook: null, reason: "within_hysteresis_or_unchanged" };
  if (lastSwitchMinsAgo != null && lastSwitchMinsAgo < policy.minMinutesBetween) {
    return { action: "none", toBook: null, reason: "rate_limited" };
  }
  if (wantBook === "a_book") {
    return { action: "auto", toBook: "a_book", reason: `risk ${riskScore} >= ${policy.toxicThreshold}` };
  }
  return { action: "approve", toBook: "b_book", reason: `risk ${riskScore} cooled below ${policy.toxicThreshold - policy.hysteresis}` };
}
