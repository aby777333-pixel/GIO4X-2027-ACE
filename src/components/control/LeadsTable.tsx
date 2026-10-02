import Link from "next/link";
import { Score, StageBadge, StatusBadge } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import type { LeadRow } from "@/lib/supabase/types";

export type LeadListItem = Pick<LeadRow, "id" | "reference" | "created_at" | "name" | "email" | "topic" | "status" | "assigned_to" | "stage" | "score" | "origin">;

export const LEAD_LIST_COLUMNS = "id, reference, created_at, name, email, topic, status, assigned_to, stage, score, origin";

function assignee(lead: LeadListItem, names: Map<string, string>, me: string): string {
  if (!lead.assigned_to) return "Unassigned";
  if (lead.assigned_to === me) return "You";
  return names.get(lead.assigned_to) ?? "Assigned";
}

/**
 * Leads as a table from `md` up and as stacked rows on a phone: the same
 * facts, composed for the width rather than squeezed into it.
 */
export function LeadsTable({ leads, names, me, caption }: { leads: LeadListItem[]; names: Map<string, string>; me: string; caption: string }) {
  return (
    <>
      <div className="scroll-x hidden md:block">
        <table className="table-gx min-w-[58rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Received</th>
              <th scope="col">From</th>
              <th scope="col">Topic</th>
              <th scope="col">Stage</th>
              <th scope="col">Score</th>
              <th scope="col">Status</th>
              <th scope="col">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link href={`/control/leads/${lead.id}`} className="link num text-sm font-medium">
                    {lead.reference}
                  </Link>
                  {lead.origin === "staff" && <span className="mt-3 block whitespace-nowrap text-xs text-ink-3">Entered by staff</span>}
                </td>
                <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(lead.created_at)}</td>
                <td className="max-w-[14rem]">
                  <span className="block truncate text-ink">{lead.name}</span>
                  <span className="block truncate text-xs text-ink-3">{lead.email}</span>
                </td>
                <td className="whitespace-nowrap text-ink-2">{lead.topic}</td>
                <td>
                  <StageBadge stage={lead.stage} />
                </td>
                <td>
                  <Score value={lead.score} />
                </td>
                <td>
                  <StatusBadge status={lead.status} />
                </td>
                <td className="whitespace-nowrap text-ink-2">{assignee(lead, names, me)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden" aria-label={caption}>
        {leads.map((lead) => (
          <li key={lead.id} className="border-b border-line">
            <Link href={`/control/leads/${lead.id}`} className="block py-13">
              <span className="flex items-center justify-between gap-13">
                <span className="num text-sm font-medium text-accent">{lead.reference}</span>
                <StatusBadge status={lead.status} />
              </span>
              <span className="mt-5 block truncate text-sm text-ink">{lead.name}</span>
              <span className="block truncate text-xs text-ink-3">{lead.email}</span>
              <span className="mt-8 flex items-center justify-between gap-13">
                <StageBadge stage={lead.stage} />
                <Score value={lead.score} />
              </span>
              <span className="mt-5 flex flex-wrap gap-x-13 text-xs text-ink-3">
                <span>{lead.topic}</span>
                {lead.origin === "staff" && <span>Entered by staff</span>}
                <span className="num">{fmtDateTime(lead.created_at)}</span>
                <span>{assignee(lead, names, me)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
