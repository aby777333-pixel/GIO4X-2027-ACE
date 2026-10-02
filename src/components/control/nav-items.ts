import type { IconName } from "@/components/control/icons";
import type { Capability } from "@/lib/server/constants";

/**
 * The console's menu, in one place: the Service Console's sections in their
 * familiar order, with the sections this console added (Pipeline, Follow-ups,
 * Subscribers, Audit log) placed beside their neighbours.
 *
 * `cap` is the capability a person needs for a built section to be offered.
 * A section without `built` has no screens yet: it is listed, marked "Soon",
 * and opens a page that says what it will do and what it is waiting for
 * (src/components/control/sections.ts). Nothing here decides access: every
 * destination checks it itself and the database checks again.
 */
type Item = { key: string; label: string; href: string; icon: IconName; exact?: boolean; cap?: Capability; built?: boolean };

const NAV: Item[] = [
  { key: "dashboard", label: "Dashboard", href: "/control", icon: "dashboard", exact: true, built: true },
  { key: "command", label: "Command Centre", href: "/control/command", icon: "command" },
  { key: "chats", label: "Live Chats", href: "/control/chats", icon: "chats" },
  { key: "tickets", label: "Tickets", href: "/control/tickets", icon: "tickets" },
  { key: "leads", label: "Leads & CRM", href: "/control/leads", icon: "leads", cap: "leads.read", built: true },
  { key: "pipeline", label: "Pipeline", href: "/control/pipeline", icon: "pipeline", cap: "leads.read", built: true },
  { key: "tasks", label: "Follow-ups", href: "/control/tasks", icon: "tasks", cap: "leads.read", built: true },
  { key: "customers", label: "Customers", href: "/control/customers", icon: "customers" },
  { key: "kyc", label: "KYC", href: "/control/kyc", icon: "kyc" },
  { key: "compliance", label: "Compliance", href: "/control/compliance", icon: "compliance" },
  { key: "funds", label: "Funds & Settlement", href: "/control/funds", icon: "funds" },
  { key: "fees", label: "Fee Engine", href: "/control/fees", icon: "fees" },
  { key: "ib", label: "IB Network", href: "/control/ib", icon: "ib" },
  { key: "copy", label: "Copy Trading", href: "/control/copy", icon: "copy" },
  { key: "pamm", label: "PAMM / MAM", href: "/control/pamm", icon: "pamm" },
  { key: "trades", label: "Trade Log", href: "/control/trades", icon: "trades" },
  { key: "reports", label: "Reporting Centre", href: "/control/reports", icon: "reports" },
  { key: "broker", label: "Broker Controls", href: "/control/broker", icon: "broker" },
  { key: "ledger", label: "General Ledger", href: "/control/ledger", icon: "ledger" },
  { key: "events", label: "Event Bus", href: "/control/events", icon: "events" },
  { key: "documents", label: "Document Builder", href: "/control/documents", icon: "documents" },
  { key: "emailer", label: "Bulk Emailer", href: "/control/emailer", icon: "emailer" },
  { key: "subscribers", label: "Subscribers", href: "/control/subscribers", icon: "subscribers", cap: "subscribers.read", built: true },
  { key: "config", label: "Configuration", href: "/control/config", icon: "config" },
  { key: "staff", label: "Team & Access", href: "/control/staff", icon: "team", cap: "staff.read", built: true },
  { key: "audit", label: "Audit log", href: "/control/audit", icon: "audit", cap: "audit.read", built: true },
];

export type NavEntry = { key: string; href: string; label: string; icon: IconName; exact: boolean; soon: boolean };

/** The menu this person is offered. Plain data, safe to hand to a client component. */
export function navFor(caps: ReadonlySet<Capability>): NavEntry[] {
  return NAV.filter((item) => !item.built || !item.cap || caps.has(item.cap)).map((item) => ({
    key: item.key,
    href: item.href,
    label: item.label,
    icon: item.icon,
    exact: !!item.exact,
    soon: !item.built,
  }));
}
