/**
 * The Service Console sections that have no screens here yet: what each will
 * do, and what it is waiting for. Shown at /control/<key> so the menu is
 * complete and honest: a section that is not built says so, in place of
 * sample figures. The order of work is docs/BACKOFFICE-PLAN.md.
 *
 * Empty since 3 October 2026: the twelve sections that were listed here (KYC,
 * Funds & Settlement, Fee Engine, IB Network, Copy Trading, PAMM / MAM, Trade
 * Log, Broker Controls, General Ledger, Event Bus, Document Builder, Bulk
 * Emailer) now have screens that read the client portal's records. A section
 * added to the menu before it is built goes back in this list.
 */
export type PendingSection = { label: string; will: string; needs: string; phase: string };

/**
 * Every section below also exists, under the same name, in the staff console
 * of the client portal (portal/apps/portal/src/app/staff, served at
 * /portal/staff/<key>). Until GIO4X Control builds its own, the section's
 * page here links to that one. It is a different system: its own sign-in and
 * its own database, and none of Control's access rules or audit apply there.
 */
export const PORTAL_CONSOLE_SECTIONS: ReadonlySet<string> = new Set([
  "kyc", "funds", "fees", "ib", "copy", "pamm", "trades", "broker", "ledger", "events", "documents", "emailer",
]);

export const PENDING_SECTIONS: Record<string, PendingSection> = {};
