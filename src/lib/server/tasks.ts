import type { Db } from "@/lib/supabase/server";

/** Reference and name for the enquiries a list of follow-ups belongs to. Empty if they cannot be read. */
export async function leadsFor(supabase: Db, tasks: { lead_id: string }[]): Promise<Map<string, { reference: string; name: string }>> {
  const leads = new Map<string, { reference: string; name: string }>();
  const ids = [...new Set(tasks.map((t) => t.lead_id))];
  if (!ids.length) return leads;
  try {
    const { data } = await supabase.from("leads").select("id, reference, name").in("id", ids);
    for (const row of data ?? []) leads.set(row.id, { reference: row.reference, name: row.name });
  } catch {
    /* the list still renders, with a plain link to each enquiry */
  }
  return leads;
}
