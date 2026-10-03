"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import type { Enums, Json } from "@gio4x/supabase";

export type CrmActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const isStaff = user.profile?.role === "staff" || user.profile?.role === "admin";
  if (!isStaff) return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

/** Best-effort outbox emit; never blocks the primary write. */
async function emitEvent(
  supabase: ReturnType<typeof getSupabaseServer>,
  topic: string,
  payload: Record<string, unknown>,
  actorId: string,
) {
  try {
    await supabase
      .from("events_outbox")
      .insert({ topic, payload: payload as Json, actor_id: actorId });
  } catch {
    // swallow — the outbox is a side channel, not the source of truth
  }
}

function revalidateCrm(leadId?: string) {
  revalidatePath("/staff/crm");
  revalidatePath("/staff/crm/pipeline");
  if (leadId) revalidatePath(`/staff/crm/${leadId}`);
}

export type CreateLeadInput = {
  full_name: string;
  email?: string;
  phone?: string;
  country?: string;
  source?: string;
  campaign?: string;
  utm?: Record<string, unknown>;
  referral_code?: string;
  owner_notes?: string;
};

export async function createLead(
  input: CreateLeadInput,
): Promise<CrmActionResult<{ id: string }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const name = input.full_name?.trim();
  if (!name) return { ok: false, error: "Lead name is required." };
  if (!input.email?.trim() && !input.phone?.trim()) {
    return { ok: false, error: "Provide at least an email or a phone number." };
  }

  const supabase = getSupabaseServer();
  const { data, error: insErr } = await supabase
    .from("crm_leads")
    .insert({
      full_name: name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      country: input.country?.trim() || null,
      source: input.source?.trim() || "manual",
      campaign: input.campaign?.trim() || null,
      utm: (input.utm ?? {}) as Json,
      referral_code: input.referral_code?.trim() || null,
      owner_notes: input.owner_notes?.trim() || undefined,
    })
    .select("id")
    .single();
  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Could not create lead." };

  // First touch in the timeline.
  await supabase.from("crm_lead_activities").insert({
    lead_id: data.id,
    actor_id: user.id,
    kind: "system",
    body: `Lead created (source: ${input.source?.trim() || "manual"}).`,
  });

  await emitEvent(supabase, "crm.lead.created", { lead_id: data.id, source: input.source ?? "manual" }, user.id);
  revalidateCrm();
  return { ok: true, data: { id: data.id } };
}

export async function updateLeadStage(
  leadId: string,
  stage: Enums<"crm_lead_stage">,
  lostReason?: string,
): Promise<CrmActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { data: current } = await supabase
    .from("crm_leads")
    .select("stage, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Lead not found." };

  const patch: {
    stage: Enums<"crm_lead_stage">;
    status?: Enums<"crm_lead_status">;
    lost_reason?: string | null;
  } = { stage };

  if (stage === "won") patch.status = "converted";
  else if (stage === "lost") {
    patch.status = "lost";
    patch.lost_reason = lostReason?.trim() || null;
  } else {
    // Re-opening a closed lead back into the active pipeline.
    patch.status = "open";
    patch.lost_reason = null;
  }

  const { error: updErr } = await supabase.from("crm_leads").update(patch).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("crm_lead_activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    kind: "stage_change",
    body: `Stage: ${current.stage} → ${stage}${stage === "lost" && lostReason?.trim() ? ` (${lostReason.trim()})` : ""}`,
  });

  await emitEvent(supabase, "crm.lead.stage_changed", { lead_id: leadId, from: current.stage, to: stage }, user.id);
  revalidateCrm(leadId);
  return { ok: true };
}

export async function assignLead(
  leadId: string,
  staffId: string | null,
): Promise<CrmActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { error: updErr } = await supabase
    .from("crm_leads")
    .update({ assigned_staff: staffId })
    .eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("crm_lead_activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    kind: "assignment",
    body: staffId ? `Assigned to staff ${staffId}.` : "Unassigned.",
  });

  await emitEvent(supabase, "crm.lead.assigned", { lead_id: leadId, staff_id: staffId }, user.id);
  revalidateCrm(leadId);
  return { ok: true };
}

export async function assignLeadToMe(leadId: string): Promise<CrmActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  return assignLead(leadId, user.id);
}

export async function addLeadActivity(
  leadId: string,
  kind: Enums<"crm_activity_kind">,
  body: string,
): Promise<CrmActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const text = body.trim();
  if (!text) return { ok: false, error: "Activity note cannot be empty." };

  const supabase = getSupabaseServer();
  const { error: insErr } = await supabase.from("crm_lead_activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    kind,
    body: text,
  });
  if (insErr) return { ok: false, error: insErr.message };

  await emitEvent(supabase, "crm.lead.activity_added", { lead_id: leadId, kind }, user.id);
  revalidateCrm(leadId);
  return { ok: true };
}

/**
 * Convert a lead into a client profile. If a profile already exists for the
 * lead's email it is linked; otherwise the lead is flagged won/converted and a
 * follow-up note records that the auth profile must be created on signup.
 */
export async function convertLead(leadId: string): Promise<CrmActionResult<{ profile_id: string | null }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, email, full_name, converted_profile_id, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.converted_profile_id) {
    return { ok: false, error: "Lead is already converted." };
  }

  // Try to match an existing client profile by email.
  let profileId: string | null = null;
  if (lead.email) {
    const { data: match } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", lead.email)
      .maybeSingle();
    if (match) profileId = match.id;
  }

  const { error: updErr } = await supabase
    .from("crm_leads")
    .update({
      stage: "won",
      status: "converted",
      converted_profile_id: profileId,
    })
    .eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("crm_lead_activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    kind: "system",
    body: profileId
      ? `Converted — linked to existing client profile ${profileId}.`
      : "Marked converted — awaiting client signup to link an auth profile.",
  });

  await emitEvent(
    supabase,
    "crm.lead.converted",
    { lead_id: leadId, profile_id: profileId, email: lead.email },
    user.id,
  );
  revalidateCrm(leadId);
  return { ok: true, data: { profile_id: profileId } };
}

export type CreateTaskInput = {
  title: string;
  lead_id?: string;
  client_id?: string;
  assigned_to?: string;
  priority?: Enums<"ticket_priority">;
  due_at?: string;
};

export async function createTask(
  input: CreateTaskInput,
): Promise<CrmActionResult<{ id: string }>> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Task title is required." };

  const supabase = getSupabaseServer();
  const { data, error: insErr } = await supabase
    .from("crm_tasks")
    .insert({
      title,
      lead_id: input.lead_id ?? null,
      client_id: input.client_id ?? null,
      assigned_to: input.assigned_to ?? user.id,
      created_by: user.id,
      priority: input.priority ?? "normal",
      due_at: input.due_at ?? null,
    })
    .select("id")
    .single();
  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Could not create task." };

  if (input.lead_id) {
    await supabase.from("crm_lead_activities").insert({
      lead_id: input.lead_id,
      actor_id: user.id,
      kind: "note",
      body: `Task created: ${title}`,
    });
  }

  await emitEvent(supabase, "crm.task.created", { task_id: data.id, lead_id: input.lead_id ?? null }, user.id);
  revalidateCrm(input.lead_id);
  return { ok: true, data: { id: data.id } };
}

export async function completeTask(taskId: string): Promise<CrmActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const supabase = getSupabaseServer();
  const { data: task } = await supabase
    .from("crm_tasks")
    .select("id, lead_id, status")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };

  const { error: updErr } = await supabase
    .from("crm_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (updErr) return { ok: false, error: updErr.message };

  await emitEvent(supabase, "crm.task.completed", { task_id: taskId }, user.id);
  revalidateCrm(task.lead_id ?? undefined);
  return { ok: true };
}
