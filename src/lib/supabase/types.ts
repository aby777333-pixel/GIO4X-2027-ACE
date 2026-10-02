/**
 * Database types, written by hand to mirror supabase/migrations.
 * `Insert` and `Update` list only the columns the API roles are GRANTed, so a
 * call that tries to write a server-controlled column fails to type-check as
 * well as being refused by the database.
 *
 * When the schema changes, regenerate or update this file in the same commit.
 */
export type LeadStatus = "new" | "open" | "waiting" | "resolved" | "spam";
export type LeadStage = "enquiry" | "contacted" | "qualified" | "applying" | "client" | "lost";
export type LostReason = "no_response" | "not_eligible" | "chose_another" | "not_interested" | "duplicate" | "other";
export type StaffRole = "admin" | "compliance" | "finance" | "dealing" | "support" | "sales" | "agent" | "viewer";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeadRow = {
  id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  topic: string;
  message: string;
  account_interest: string | null;
  page: string;
  utm: Json;
  /** empty for an enquiry a member of staff entered: nobody accepted the notice on the website */
  privacy_accepted_at: string | null;
  privacy_version: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  /** where the row came from: a form on the website, or a member of staff (0012) */
  origin: "website" | "staff";
  added_by: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  stage: LeadStage;
  stage_changed_at: string | null;
  lost_reason: LostReason | null;
  /** 0 to 100, computed by the database (a generated column) */
  score: number;
};

export type LeadTaskRow = {
  id: string;
  lead_id: string;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;
  title: string;
  due_at: string;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
};

export type LeadInsert = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  topic: string;
  message: string;
  account_interest?: string | null;
  page: string;
  utm: Json;
  privacy_accepted_at: string;
  privacy_version: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
};

export type LeadNoteRow = { id: string; lead_id: string; author: string | null; body: string; created_at: string };

export type SubscriberRow = {
  id: string;
  email: string;
  created_at: string;
  source: string;
  consent_at: string;
  consent_version: string;
  unsubscribed_at: string | null;
};

export type StaffRow = { user_id: string; role: StaffRole; display_name: string; created_at: string; active: boolean; updated_at: string };

/** One row of staff_list(): the staff table joined to the sign-in address. */
export type StaffListRow = {
  user_id: string;
  email: string;
  role: StaffRole;
  display_name: string;
  active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type StaffChangeRow = {
  id: string;
  created_at: string;
  kind: "grant" | "change";
  target: string;
  target_email: string;
  role: StaffRole;
  display_name: string;
  active: boolean;
  requested_by: string;
  status: "pending" | "applied" | "rejected" | "cancelled";
  decided_by: string | null;
  decided_at: string | null;
  unreviewed: boolean;
};

export type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Json;
};

export type TicketCategory = "account" | "platform" | "funding" | "technical" | "complaint" | "privacy" | "security" | "other";
export type TicketStatus = "open" | "pending" | "solved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketRow = {
  id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  category: TicketCategory;
  subject: string;
  message: string;
  page: string;
  privacy_accepted_at: string;
  privacy_version: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  first_response_at: string | null;
  solved_at: string | null;
  last_customer_at: string | null;
};

export type TicketInsert = {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: TicketCategory;
  subject: string;
  message: string;
  page: string;
  privacy_accepted_at: string;
  privacy_version: string;
};

export type TicketMessageRow = {
  id: string;
  ticket_id: string;
  created_at: string;
  author_kind: "customer" | "staff";
  author: string | null;
  internal: boolean;
  body: string;
};

/** What ticket_view() returns to the person who opened the ticket. Staff are never named. */
export type TicketPublicView = {
  reference: string;
  created_at: string;
  category: TicketCategory;
  subject: string;
  message: string;
  status: TicketStatus;
  messages: { at: string; from: "customer" | "staff"; body: string }[];
};

export type ChatStatus = "waiting" | "active" | "closed";

/** The columns staff may read. The token hash is not readable through the API: never select "*" on this table. */
export type ChatConversationRow = {
  id: string;
  created_at: string;
  last_message_at: string;
  status: ChatStatus;
  visitor_name: string | null;
  page: string;
  claimed_by: string | null;
  closed_at: string | null;
  closed_by: "visitor" | "staff" | null;
};

export const CHAT_CONVERSATION_COLUMNS = "id, created_at, last_message_at, status, visitor_name, page, claimed_by, closed_at, closed_by";

export type ChatMessageRow = {
  id: number;
  conversation_id: string;
  created_at: string;
  author_kind: "visitor" | "staff";
  author: string | null;
  body: string;
};

/** What chat_poll() returns to a visitor. */
export type ChatPublicPoll = {
  status: ChatStatus;
  joined: boolean;
  messages: { id: number; from: "visitor" | "staff"; body: string; at: string }[];
};

export type StaffPresenceRow = { user_id: string; chat_until: string };

export type SiteSettingKey = "announcement" | "chat" | "support";
export type SiteSettingRow = { key: SiteSettingKey; value: Json; updated_at: string; updated_by: string | null };

/** What site_public() returns: the three values, shaped by site_setting_set(). */
export type SitePublic = {
  announcement?: { enabled: boolean; text: string; href: string; tone: "info" | "notice" };
  chat?: { enabled: boolean };
  support?: { hours: string };
};

export type IncidentComponent = "website" | "client-portal" | "trader-portal" | "ib-portal" | "raptor" | "metatrader-5" | "market-data" | "support";
export type IncidentSeverity = "notice" | "degraded" | "outage" | "maintenance";
export type IncidentStatus = "scheduled" | "investigating" | "identified" | "monitoring" | "resolved";

export type IncidentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  title: string;
  component: IncidentComponent;
  severity: IncidentSeverity;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  published: boolean;
};

/** Must equal the checks in 0011_blog.sql. */
export type BlogCategory = "market-notes" | "education" | "platform" | "company";
export type BlogStatus = "draft" | "review" | "published" | "archived";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** the restricted Markdown that src/components/blog/BlogBody.tsx renders */
  body: string;
  category: BlogCategory;
  tags: string[];
  byline: string;
  status: BlogStatus;
  /** public once status is published AND this time has passed (a future time is a scheduled post) */
  published_at: string | null;
  corrected_at: string | null;
  correction_note: string;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  noindex: boolean;
  /** paths inside the public `blog` storage bucket ("" when there is none) */
  og_image_path: string;
  cover_path: string;
  cover_alt: string;
  cover_caption: string;
  cover_credit: string;
  cover_width: number | null;
  cover_height: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The columns the anonymous role may read (0011): everything on the page, nothing about who wrote the row. */
export const BLOG_PUBLIC_COLUMNS =
  "id, slug, title, excerpt, body, category, tags, byline, status, published_at, corrected_at, correction_note, seo_title, seo_description, canonical_url, noindex, og_image_path, cover_path, cover_alt, cover_caption, cover_credit, cover_width, cover_height, updated_at" as const;
export type BlogPublicPost = Omit<BlogPostRow, "created_by" | "updated_by" | "created_at">;

type BlogWritable = Pick<
  BlogPostRow,
  | "slug" | "title" | "excerpt" | "body" | "category" | "tags" | "byline" | "status" | "published_at"
  | "seo_title" | "seo_description" | "canonical_url" | "noindex" | "og_image_path"
  | "cover_path" | "cover_alt" | "cover_caption" | "cover_credit" | "cover_width" | "cover_height"
>;

export type IncidentUpdateRow = { id: number; incident_id: string; created_at: string; author: string | null; status: IncidentStatus; body: string };

/** One row of people_list(): everyone who has written in, one record per address. Not client accounts. */
export type PersonListRow = {
  key: string;
  email: string;
  name: string | null;
  first_seen: string;
  last_seen: string;
  enquiries: number;
  tickets: number;
  open_tickets: number;
  subscribed: boolean;
  total: number;
};

/** What person_view() returns. */
export type PersonView = {
  key: string;
  email: string;
  name: string | null;
  leads: { id: string; reference: string; created_at: string; topic: string; status: LeadStatus; stage: LeadStage; score: number; assigned_to: string | null }[];
  tickets: { id: string; reference: string; created_at: string; category: TicketCategory; subject: string; status: TicketStatus; priority: TicketPriority; assigned_to: string | null }[];
  subscription: { since: string; consent_version: string; unsubscribed_at: string | null } | null;
  marketing_consent: boolean;
};

type Tally = { key: string; count: number }[];

/** What report_summary() returns. Every figure is counted from rows at the moment it is asked for. */
export type ReportSummary = {
  days: number;
  since: string;
  leads: { total: number; spam: number; by_topic: Tally; by_stage: Tally; by_status: Tally; by_source: Tally; by_page: Tally; lost_reasons: Tally };
  tickets: { total: number; solved: number; answered: number; first_response_median_minutes: number | null; by_category: Tally; by_status: Tally };
  chats: { total: number; answered: number };
  subscribers: { new: number; unsubscribed: number; active: number };
  follow_ups: { created: number; completed: number };
};

/** What command_summary() returns. */
export type CommandSummary = {
  at: string;
  leads: { new: number; unassigned: number; open: number; last_24h: number };
  follow_ups: { open: number; overdue: number };
  tickets: { open: number; pending: number; unassigned: number; unanswered: number; late: number; complaints_open: number };
  chats: { waiting: number; active: number; staff_online: number; enabled: boolean };
  staff: { active: number; pending_changes: number };
  site: { incidents_open: number; incidents_published: number; announcement_on: boolean };
  audience: { subscribers: number };
  audit_24h: number;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: { status?: LeadStatus; assigned_to?: string | null; stage?: LeadStage; lost_reason?: LostReason | null };
        Relationships: [];
      };
      lead_tasks: {
        Row: LeadTaskRow;
        Insert: { lead_id: string; title: string; due_at: string; assigned_to?: string | null };
        Update: { done?: boolean };
        Relationships: [];
      };
      staff_changes: {
        Row: StaffChangeRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      tickets: {
        Row: TicketRow;
        Insert: TicketInsert;
        Update: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; assigned_to?: string | null };
        Relationships: [];
      };
      ticket_messages: {
        Row: TicketMessageRow;
        Insert: { ticket_id: string; body: string; internal?: boolean };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      chat_conversations: {
        Row: ChatConversationRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      staff_presence: {
        Row: StaffPresenceRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      site_settings: {
        Row: SiteSettingRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      blog_posts: {
        Row: BlogPostRow;
        Insert: Partial<BlogWritable> & { slug: string; title: string };
        Update: Partial<BlogWritable & Pick<BlogPostRow, "corrected_at" | "correction_note">>;
        Relationships: [];
      };
      incidents: {
        Row: IncidentRow;
        Insert: { title: string; component: IncidentComponent; severity: IncidentSeverity; status?: IncidentStatus; started_at?: string; published?: boolean };
        Update: { title?: string; component?: IncidentComponent; severity?: IncidentSeverity; published?: boolean };
        Relationships: [];
      };
      incident_updates: {
        Row: IncidentUpdateRow;
        Insert: { incident_id: string; status: IncidentStatus; body: string };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      lead_notes: {
        Row: LeadNoteRow;
        Insert: { lead_id: string; body: string };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: SubscriberRow;
        Insert: { id: string; email: string; source: string; consent_at: string; consent_version: string };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      staff: {
        Row: StaffRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      audit_log: {
        Row: AuditRow;
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_staff: { Args: { [_ in never]: never }; Returns: boolean };
      staff_role: { Args: { [_ in never]: never }; Returns: string | null };
      staff_directory: { Args: { [_ in never]: never }; Returns: { user_id: string; display_name: string }[] };
      record_subscriber_export: { Args: { row_count: number }; Returns: undefined };
      staff_can: { Args: { cap: string }; Returns: boolean };
      my_capabilities: { Args: { [_ in never]: never }; Returns: string[] };
      staff_list: { Args: { [_ in never]: never }; Returns: StaffListRow[] };
      staff_propose_grant: { Args: { p_email: string; p_role: string; p_display_name: string }; Returns: string };
      staff_propose_change: { Args: { p_user: string; p_role: string; p_display_name: string; p_active: boolean }; Returns: string };
      staff_decide: { Args: { p_change: string; p_approve: boolean }; Returns: undefined };
      staff_cancel: { Args: { p_change: string }; Returns: undefined };
      site_public: { Args: { [_ in never]: never }; Returns: Json };
      site_setting_set: { Args: { p_key: string; p_value: Json }; Returns: undefined };
      ticket_view: { Args: { p_reference: string; p_email: string }; Returns: Json | null };
      ticket_reply: { Args: { p_reference: string; p_email: string; p_body: string }; Returns: string };
      chat_available: { Args: { [_ in never]: never }; Returns: boolean };
      chat_start: { Args: { p_name: string; p_page: string; p_body: string }; Returns: Json };
      chat_send: { Args: { p_id: string; p_token: string; p_body: string }; Returns: string };
      chat_poll: { Args: { p_id: string; p_token: string; p_after?: number }; Returns: Json | null };
      chat_end: { Args: { p_id: string; p_token: string }; Returns: string };
      chat_presence: { Args: { p_on?: boolean }; Returns: undefined };
      chat_staff_claim: { Args: { p_id: string }; Returns: undefined };
      chat_staff_send: { Args: { p_id: string; p_body: string }; Returns: undefined };
      chat_staff_close: { Args: { p_id: string }; Returns: undefined };
      people_list: { Args: { p_search?: string; p_limit?: number; p_offset?: number }; Returns: PersonListRow[] };
      person_view: { Args: { p_key: string }; Returns: Json | null };
      report_summary: { Args: { p_days?: number }; Returns: Json };
      command_summary: { Args: { [_ in never]: never }; Returns: Json };
      record_leads_export: { Args: { row_count: number }; Returns: undefined };
      lead_add_manual: {
        Args: { p_name: string; p_email: string; p_phone: string | null; p_country: string | null; p_topic: string; p_message: string; p_how: string };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
