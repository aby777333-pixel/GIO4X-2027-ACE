// Single source of truth for staff-console sections + access checks.
// Used by the sidebar (which items to show), the console layout (hard URL
// enforcement), and the Team & Access admin panel (which sections to grant).

export type StaffSection = {
  key: string;
  href: string;
  label: string;
  adminOnly?: boolean;
};

export const STAFF_SECTIONS: StaffSection[] = [
  { key: "dashboard", href: "/staff", label: "Dashboard" },
  { key: "command", href: "/staff/command", label: "Command Centre", adminOnly: true },
  { key: "chats", href: "/staff/chats", label: "Live Chats" },
  { key: "tickets", href: "/staff/tickets", label: "Tickets" },
  { key: "crm", href: "/staff/crm", label: "Leads & CRM" },
  { key: "customers", href: "/staff/customers", label: "Customers" },
  { key: "kyc", href: "/staff/kyc", label: "KYC" },
  { key: "compliance", href: "/staff/compliance", label: "Compliance" },
  { key: "funds", href: "/staff/funds", label: "Funds & Settlement" },
  { key: "fees", href: "/staff/fees", label: "Fee Engine" },
  { key: "ib", href: "/staff/ib", label: "IB Network" },
  { key: "copy", href: "/staff/copy", label: "Copy Trading" },
  { key: "pamm", href: "/staff/pamm", label: "PAMM / MAM" },
  { key: "trades", href: "/staff/trades", label: "Trade Log" },
  { key: "reports", href: "/staff/reports", label: "Reporting Centre" },
  { key: "broker", href: "/staff/broker", label: "Broker Controls" },
  { key: "ledger", href: "/staff/ledger", label: "General Ledger" },
  { key: "documents", href: "/staff/documents", label: "Document Builder" },
  { key: "emailer", href: "/staff/emailer", label: "Bulk Emailer" },
  { key: "events", href: "/staff/events", label: "Event Bus" },
  { key: "config", href: "/staff/config", label: "Configuration", adminOnly: true },
  { key: "team", href: "/staff/team", label: "Team & Access", adminOnly: true },
];

// Sections a staff member can be granted. Excludes admin-only sections and the
// dashboard (always available as the landing page).
export const ASSIGNABLE_SECTIONS = STAFF_SECTIONS.filter(
  (s) => !s.adminOnly && s.key !== "dashboard",
);

// Access rule:
//   • admin-only sections   -> only role "admin" (the master admin)
//   • role "admin"          -> full access
//   • role "staff"          -> NULL list = unrestricted; otherwise only listed
//   • anything else         -> no console access
export function canAccessSection(
  key: string,
  role: string | null | undefined,
  staffSections: string[] | null | undefined,
): boolean {
  // Dashboard is the landing page — always reachable by any console user.
  if (key === "dashboard") return role === "admin" || role === "staff";
  const section = STAFF_SECTIONS.find((s) => s.key === key);
  if (section?.adminOnly) return role === "admin";
  if (role === "admin") return true;
  if (role === "staff") return staffSections == null ? true : staffSections.includes(key);
  return false;
}

// Resolve a pathname to its section (longest matching href wins).
export function sectionForPath(pathname: string): StaffSection | undefined {
  return [...STAFF_SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => (s.href === "/staff" ? pathname === "/staff" : pathname.startsWith(s.href)));
}
