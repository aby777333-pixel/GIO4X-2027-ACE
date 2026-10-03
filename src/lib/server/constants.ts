/**
 * Values shared by the public endpoints, GIO4X Control and the database
 * constraints. If you change a list here, change the matching CHECK constraint
 * in supabase/migrations in the same commit: the database enforces these too.
 */

/** Contact topics. Must equal `leads_topic_valid` in 0001_init.sql. */
export const CONTACT_TOPICS = [
  "General",
  "Account",
  "Account opening",
  "Platform: 777 Raptor",
  "Platform: MetaTrader 5",
  "Technical",
  "Partnership",
  "Press",
  "Security",
  "Privacy",
  "Complaint",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Lead statuses. Must equal `leads_status_valid` in 0001_init.sql. */
export const LEAD_STATUSES = ["new", "open", "waiting", "resolved", "spam"] as const;

export const LEAD_STATUS_LABEL: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: "New",
  open: "Open",
  waiting: "Waiting",
  resolved: "Resolved",
  spam: "Spam",
};

/** Pipeline stages. Must equal `leads_stage_valid` in 0005_crm.sql. */
export const LEAD_STAGES = ["enquiry", "contacted", "qualified", "applying", "client", "lost"] as const;

export const LEAD_STAGE_LABEL: Record<(typeof LEAD_STAGES)[number], string> = {
  enquiry: "Enquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  applying: "Applying",
  client: "Client",
  lost: "Lost",
};

/** Why an enquiry was lost. Must equal `leads_lost_reason_valid` in 0005_crm.sql. */
export const LOST_REASONS = ["no_response", "not_eligible", "chose_another", "not_interested", "duplicate", "other"] as const;

export const LOST_REASON_LABEL: Record<(typeof LOST_REASONS)[number], string> = {
  no_response: "No response",
  not_eligible: "Not eligible",
  chose_another: "Chose another provider",
  not_interested: "Not interested",
  duplicate: "Duplicate enquiry",
  other: "Other",
};

/** Staff roles. Must equal `staff_role_valid` in 0004_capabilities.sql. */
export const STAFF_ROLES = ["admin", "compliance", "finance", "dealing", "support", "sales", "agent", "viewer"] as const;

/**
 * What a member of staff may do. The database decides (`role_capabilities` and
 * `staff_can()` in 0004_capabilities.sql); this list exists so that a
 * misspelt capability fails to type-check.
 */
export const CAPABILITIES = [
  "leads.read",
  "leads.write",
  "leads.assign",
  "leads.import",
  "tasks.write",
  "subscribers.read",
  "subscribers.export",
  "audit.read",
  "staff.read",
  "staff.manage",
  "tickets.read",
  "tickets.write",
  "tickets.manage",
  "chats.read",
  "chats.write",
  "customers.read",
  "customers.note",
  "compliance.read",
  "reports.read",
  "analytics.read",
  "command.read",
  "activity.read",
  "config.manage",
  "blog.read",
  "blog.write",
  "blog.publish",
  "content.read",
  "content.write",
  "content.publish",
  // the sections that read the client portal's database (0021_portal_sections.sql)
  "kyc.read",
  "funds.read",
  "partners.read",
  "trading.read",
  "events.read",
  "documents.read",
  "emailer.read",
  // decisions made in the portal's database (0022_portal_actions.sql)
  "kyc.decide",
  "funds.settle",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** How a staff-entered enquiry came about. Stored as the enquiry's source. Must match the pattern in lead_add_manual() (0012). */
export const MANUAL_LEAD_SOURCES = ["telephone", "event", "referral", "walk-in", "email", "social", "other"] as const;
export const MANUAL_LEAD_SOURCE_LABEL: Record<(typeof MANUAL_LEAD_SOURCES)[number], string> = {
  telephone: "Telephone call",
  event: "Event or meeting",
  referral: "Referral",
  "walk-in": "Visit to an office",
  email: "E-mail",
  social: "Social media",
  other: "Something else",
};

/** Ticket categories. Must equal `tickets_category_valid` in 0007_support.sql. */
export const TICKET_CATEGORIES = ["account", "platform", "funding", "technical", "complaint", "privacy", "security", "other"] as const;

export const TICKET_CATEGORY_LABEL: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  account: "My account",
  platform: "Trading platform",
  funding: "Deposits and withdrawals",
  technical: "Website or technical problem",
  complaint: "Complaint",
  privacy: "Privacy or my data",
  security: "Security concern",
  other: "Something else",
};

/** Ticket statuses. Must equal `tickets_status_valid` in 0007_support.sql. */
export const TICKET_STATUSES = ["open", "pending", "solved", "closed"] as const;

export const TICKET_STATUS_LABEL: Record<(typeof TICKET_STATUSES)[number], string> = {
  open: "Open",
  pending: "Waiting for customer",
  solved: "Solved",
  closed: "Closed",
};

/** Ticket priorities. Must equal `tickets_priority_valid` in 0007_support.sql. */
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const TICKET_PRIORITY_LABEL: Record<(typeof TICKET_PRIORITIES)[number], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/**
 * Hours within which a first reply is due, by priority. An internal target for
 * staff, never a promise shown to the public. Must equal the hours in
 * command_summary() in 0009_insight.sql.
 */
export const TICKET_TARGET_HOURS: Record<(typeof TICKET_PRIORITIES)[number], number> = { urgent: 2, high: 8, normal: 24, low: 72 };

/** The categories the compliance register watches, and the enquiry topics that belong beside them. */
export const COMPLIANCE_CATEGORIES = ["complaint", "privacy", "security"] as const;
export const COMPLIANCE_TOPICS = ["Complaint", "Privacy", "Security"] as const;

/** Must equal `incidents_component_valid` in 0006_site.sql and the services listed on /status. */
export const INCIDENT_COMPONENTS = ["website", "client-portal", "trader-portal", "ib-portal", "raptor", "metatrader-5", "market-data", "support"] as const;

export const INCIDENT_COMPONENT_LABEL: Record<(typeof INCIDENT_COMPONENTS)[number], string> = {
  website: "Website",
  "client-portal": "Client Portal",
  "trader-portal": "Trader Portal",
  "ib-portal": "IB Portal",
  raptor: "777 Raptor",
  "metatrader-5": "MetaTrader 5 connectivity",
  "market-data": "Market data",
  support: "Support",
};

/** Must equal `incidents_severity_valid` in 0006_site.sql. */
export const INCIDENT_SEVERITIES = ["notice", "degraded", "outage", "maintenance"] as const;

export const INCIDENT_SEVERITY_LABEL: Record<(typeof INCIDENT_SEVERITIES)[number], string> = {
  notice: "Notice",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
};

/** Must equal `incidents_status_valid` in 0006_site.sql. */
export const INCIDENT_STATUSES = ["scheduled", "investigating", "identified", "monitoring", "resolved"] as const;

export const INCIDENT_STATUS_LABEL: Record<(typeof INCIDENT_STATUSES)[number], string> = {
  scheduled: "Scheduled",
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/**
 * The version of the Privacy Policy a visitor accepts when they submit a form.
 * Stored with every lead and subscription as consent evidence ("what, when,
 * which version"). It must name the policy that is actually published at
 * /legal/privacy: set PRIVACY_POLICY_VERSION when that page carries a version,
 * and change it every time the policy changes. Until then rows are recorded as
 * "unversioned", which states the truth rather than inventing a version.
 * Allowed characters: letters, digits, dot, underscore, hyphen (max 40).
 */
export const PRIVACY_VERSION = (() => {
  const v = process.env.PRIVACY_POLICY_VERSION?.trim() ?? "";
  return /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : "unversioned";
})();

/** Largest request body the public endpoints will read. */
export const MAX_BODY_BYTES = 16 * 1024;

/** A human needs longer than this to complete a form. */
export const MIN_FILL_MS = 2500;

/** Shown for every storage failure. Never includes database detail. */
export const GENERIC_UNAVAILABLE = "We could not record your message just now. Please try again shortly, or write to info@gio4x.com.";
export const GENERIC_RATE_LIMITED = "Too many requests. Please wait a few minutes and try again.";
