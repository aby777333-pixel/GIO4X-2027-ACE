/**
 * Database types, written by hand to mirror supabase/migrations.
 * `Insert` and `Update` list only the columns the API roles are GRANTed, so a
 * call that tries to write a server-controlled column fails to type-check as
 * well as being refused by the database.
 *
 * When the schema changes, regenerate or update this file in the same commit.
 */
export type LeadStatus = "new" | "open" | "waiting" | "resolved" | "spam";
export type StaffRole = "admin" | "agent" | "viewer";

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
  privacy_accepted_at: string;
  privacy_version: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  status: LeadStatus;
  assigned_to: string | null;
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

export type StaffRow = { user_id: string; role: StaffRole; display_name: string; created_at: string };

export type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Json;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: { status?: LeadStatus; assigned_to?: string | null };
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
