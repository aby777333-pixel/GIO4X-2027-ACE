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
  "tasks.write",
  "subscribers.read",
  "subscribers.export",
  "audit.read",
  "staff.read",
  "staff.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

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
