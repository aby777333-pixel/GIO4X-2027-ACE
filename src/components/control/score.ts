import type { LeadRow } from "@/lib/supabase/types";

/**
 * Why an enquiry has the score it has.
 *
 * The score itself is computed by the database (the generated column
 * `leads.score` in 0005_crm.sql) and is what the console sorts by. This file
 * restates the same rules so that the number can be shown with its reasons.
 * If you change one, change the other in the same commit.
 *
 * It orders work. It is not a judgement of the person: it only counts facts
 * the enquirer chose to give (what they asked about, whether they left a
 * phone number, whether they agreed to be contacted).
 */
export type ScorePart = { label: string; points: number };

const NOT_SALES = ["Complaint", "Press", "Privacy", "Security", "Technical"];

const TOPIC_POINTS: Record<string, number> = {
  "Account opening": 40,
  Partnership: 30,
  Account: 20,
  "Platform: 777 Raptor": 15,
  "Platform: MetaTrader 5": 15,
};

export function scoreParts(lead: Pick<LeadRow, "topic" | "account_interest" | "phone" | "country" | "marketing_consent" | "utm">): { excluded: boolean; parts: ScorePart[] } {
  if (NOT_SALES.includes(lead.topic)) return { excluded: true, parts: [] };
  const hasUtm = typeof lead.utm === "object" && lead.utm !== null && !Array.isArray(lead.utm) && Object.keys(lead.utm).length > 0;
  const parts: ScorePart[] = [{ label: `Topic: ${lead.topic}`, points: TOPIC_POINTS[lead.topic] ?? 10 }];
  if (lead.account_interest !== null) parts.push({ label: "Named an account type", points: 20 });
  if (lead.phone !== null) parts.push({ label: "Left a phone number", points: 15 });
  if (lead.country !== null) parts.push({ label: "Gave a country", points: 5 });
  if (lead.marketing_consent) parts.push({ label: "Agreed to be contacted with news", points: 10 });
  if (hasUtm) parts.push({ label: "Arrived from a campaign link", points: 10 });
  return { excluded: false, parts };
}
