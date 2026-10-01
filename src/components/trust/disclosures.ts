/**
 * THE DISCLOSURE LEDGER.
 *
 * What GIO4X publishes on this site and what it does not publish yet.
 * "Published" means the item can be read on the linked page today. It does
 * not mean it has been independently verified. "Not yet published" means the
 * item is not on this site: the previous GIO4X websites either did not state
 * it, or stated it in conflicting ways that the owner has not resolved.
 *
 * When the owner confirms an item, change its status here and add the link:
 * /trust and /trust/transparency both read this file.
 */

import { companyLine } from "@/config/legal";
import { site } from "@/config/site";

export type DisclosureGroup = "Company" | "Trading" | "Legal" | "Data" | "Service";

export type Disclosure = {
  item: string;
  group: DisclosureGroup;
  /** what the item is, or why it is missing */
  note: string;
} & ({ status: "published"; href: string; where: string } | { status: "pending" });

/** The day this ledger was last checked against the site. */
export const LEDGER_REVIEWED = "1 October 2026";

export const disclosures: Disclosure[] = [
  // Company
  { item: "Company name and number", group: "Company", note: companyLine, status: "published", href: "/about", where: "About" },
  { item: "Registered address", group: "Company", note: `${site.headOffice.lines.join(", ")}, ${site.headOffice.country}.`, status: "published", href: "/contact", where: "Contact" },
  { item: "Regulatory status", group: "Company", note: "No regulator, licence number or register entry is published on this site. A company number is a registration, not an authorisation.", status: "pending" },
  // Trading
  { item: "Trading conditions", group: "Trading", note: "Indicative spreads and requirements, as GIO4X has published them.", status: "published", href: "/trading/conditions", where: "Trading conditions" },
  { item: "Account types", group: "Trading", note: "Classic, Premium and ECN, compared in one table.", status: "published", href: "/trading/accounts", where: "Account types" },
  { item: "Execution policy", group: "Trading", note: "How orders are routed, priced and filled.", status: "pending" },
  { item: "Swap rates", group: "Trading", note: "Overnight financing per instrument.", status: "pending" },
  { item: "Order-execution statistics", group: "Trading", note: "Fill speed, slippage and rejection figures. None is published, so none is quoted.", status: "pending" },
  { item: "Funding fees and times", group: "Trading", note: "The previous websites gave conflicting fees and processing times.", status: "pending" },
  // Legal
  { item: "Risk disclosure", group: "Legal", note: "Carried over from the previous website; under legal review.", status: "published", href: "/legal/risk", where: "Risk Disclosure" },
  { item: "Terms", group: "Legal", note: "Carried over from the previous website; under legal review.", status: "published", href: "/legal/terms", where: "Terms of Service" },
  { item: "Privacy", group: "Legal", note: "Carried over from the previous website; under legal review.", status: "published", href: "/legal/privacy", where: "Privacy Policy" },
  { item: "AML", group: "Legal", note: "Carried over from the previous website; under legal review.", status: "published", href: "/legal/aml", where: "AML Policy" },
  { item: "Restricted jurisdictions", group: "Legal", note: "The countries whose residents GIO4X does not serve.", status: "published", href: "/legal/terms#eligibility", where: "Terms, section 2" },
  { item: "Complaints procedure", group: "Legal", note: "How to complain, who answers and by when.", status: "pending" },
  // Data
  { item: "Data methodology", group: "Data", note: "The source, timing and calculation of every number on this site.", status: "published", href: "/trust/data-methodology", where: "Data methodology" },
  // Service
  { item: "Support hours", group: "Service", note: "The previous websites stated three different sets of hours.", status: "pending" },
  { item: "Telephone number", group: "Service", note: "The previous websites carried placeholder numbers. Email is the published channel.", status: "pending" },
];

export const DISCLOSURE_GROUPS: DisclosureGroup[] = ["Company", "Trading", "Legal", "Data", "Service"];

export const publishedCount = disclosures.filter((d) => d.status === "published").length;
export const pendingCount = disclosures.length - publishedCount;
