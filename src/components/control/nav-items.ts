import type { Capability } from "@/lib/server/constants";

/**
 * The console's sections, in one place. `cap` is the capability a person needs
 * for the entry to be offered; an entry without one is offered to all staff.
 * This only decides what is SHOWN: every destination checks access itself and
 * the database checks again.
 */
type Item = { href: string; label: string; exact?: boolean; cap?: Capability };

const NAV: { label: string; items: Item[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/control", label: "Overview", exact: true },
      { href: "/control/pipeline", label: "Pipeline", cap: "leads.read" },
      { href: "/control/leads", label: "Leads", cap: "leads.read" },
      { href: "/control/tasks", label: "Follow-ups", cap: "leads.read" },
    ],
  },
  {
    label: "Audience",
    items: [{ href: "/control/subscribers", label: "Subscribers", cap: "subscribers.read" }],
  },
  {
    label: "Governance",
    items: [
      { href: "/control/audit", label: "Audit log", cap: "audit.read" },
      { href: "/control/staff", label: "Staff", cap: "staff.read" },
    ],
  },
];

export type NavEntry = { href: string; label: string; exact: boolean };
export type NavSection = { label: string; items: NavEntry[] };

/** The sections this person is offered. Plain data, safe to hand to a client component. */
export function navFor(caps: ReadonlySet<Capability>): NavSection[] {
  return NAV.map((section) => ({
    label: section.label,
    items: section.items.filter((item) => !item.cap || caps.has(item.cap)).map((item) => ({ href: item.href, label: item.label, exact: !!item.exact })),
  })).filter((section) => section.items.length > 0);
}
