"use server";

import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";

// Bulk emailer server action. Sends via the Resend REST API (one request per
// recipient so no client sees another's address), logs the batch to
// public.email_logs, and returns a per-batch result. Requires env:
//   RESEND_API_KEY     — Resend API key (REQUIRED to actually send)
//   RESEND_FROM_EMAIL  — verified sender, e.g. no-reply@gio4x.com (default below)
//   RESEND_FROM_NAME   — display name (default "GIO4X")
//   RESEND_REPLY_TO    — reply-to address (default support@gio4x.com)

export type EmailAttachmentInput = { filename: string; content: string; contentType?: string };
export type SendResult =
  | { ok: true; sent: number; failed: number; total: number; error?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Simple branded letterhead wrapper for the plain-text body.
function formatEmailHtml(body: string): string {
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br>");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb;">
      <div style="background:#0b1f3a; padding:20px 24px; text-align:center;">
        <span style="color:#ffffff; font-size:20px; font-weight:800; letter-spacing:1px;">GIO<span style="color:#38bdf8;">4X</span></span>
      </div>
      <div style="padding:28px 28px;">
        <div style="color:#1f2937; font-size:14px; line-height:1.8;">${htmlBody}</div>
      </div>
      <div style="background:#f8fafc; padding:14px; text-align:center; border-top:1px solid #eef2f7;">
        <p style="color:#94a3b8; font-size:11px; margin:0; line-height:1.6;">
          GIO4X &bull; This message was sent to you as a GIO4X account holder.<br>
          <a href="https://gio4x.com" style="color:#0ea5e9; text-decoration:none;">gio4x.com</a>
        </p>
      </div>
    </div>`;
}

// Per-recipient personalisation: {{client_name}} -> the name part of the email,
// title-cased. Other tokens are left as the staff member typed them.
function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] || "there").replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (c) => c.toUpperCase()) || "there";
}
function personalise(text: string, email: string): string {
  return text.replace(/\{\{\s*client_name\s*\}\}/gi, nameFromEmail(email));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

export async function sendBulkEmail(input: {
  recipients: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachmentInput[];
  templateId?: string | null;
}): Promise<SendResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };

  const recipients = Array.from(
    new Set((input.recipients || []).map((r) => r.trim()).filter(Boolean)),
  );
  const subject = (input.subject || "").trim();
  const body = (input.body || "").trim();

  if (recipients.length === 0) return { ok: false, error: "Add at least one recipient." };
  if (!subject) return { ok: false, error: "Subject is required." };
  if (!body) return { ok: false, error: "Email body is required." };
  const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) return { ok: false, error: `Invalid email(s): ${invalid.slice(0, 5).join(", ")}` };

  // Validate + size-cap attachments (strip any data: prefix).
  const safeAttachments: EmailAttachmentInput[] = [];
  let total = 0;
  for (const a of input.attachments || []) {
    if (!a?.filename || !a?.content) continue;
    const cleaned = String(a.content).replace(/^data:[^;]+;base64,/, "").trim();
    const approx = Math.ceil(cleaned.length * 0.75);
    if (approx > MAX_FILE_BYTES) return { ok: false, error: `Attachment "${a.filename}" exceeds the 25MB limit.` };
    total += approx;
    safeAttachments.push({ filename: a.filename, content: cleaned, contentType: a.contentType });
  }
  if (total > MAX_TOTAL_BYTES) return { ok: false, error: "Total attachment size exceeds 40MB." };

  const resendKey = process.env.RESEND_API_KEY || "";
  if (!resendKey) {
    return { ok: false, error: "Email service not configured. Set RESEND_API_KEY (and RESEND_FROM_EMAIL) in the environment." };
  }
  const fromName = (process.env.RESEND_FROM_NAME || "GIO4X").trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "no-reply@gio4x.com").trim();
  const replyTo = (process.env.RESEND_REPLY_TO || "support@gio4x.com").trim();

  const sendOne = async (to: string) => {
    const payload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: to.trim(),
      reply_to: replyTo,
      subject: personalise(subject, to),
      html: formatEmailHtml(personalise(body, to)),
    };
    if (safeAttachments.length > 0) {
      payload.attachments = safeAttachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { content_type: a.contentType } : {}),
      }));
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try { const j = JSON.parse(txt); msg = j.message || j.error || txt; } catch { /* keep raw */ }
      throw new Error(msg);
    }
    return res.json();
  };

  const results = await Promise.allSettled(recipients.map((to) => sendOne(to)));
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : "Unknown error"));
  const errorMessage = errors.length ? Array.from(new Set(errors)).slice(0, 3).join(" | ") : undefined;
  const status = sent > 0 && failed === 0 ? "sent" : sent > 0 ? "partial" : "failed";

  // Best-effort audit log (RLS lets staff insert their own batch).
  // email_logs isn't in the generated Database types yet — cast loosely.
  try {
    const supabase = getSupabaseServer();
    const sb = supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } };
    await sb.from("email_logs").insert({
      sent_by: user.id,
      recipients,
      subject,
      body,
      attachment_names: safeAttachments.map((a) => a.filename),
      template_id: input.templateId || null,
      status,
      sent_count: sent,
      failed_count: failed,
      error_message: errorMessage || null,
      metadata: { from: fromEmail },
    });
  } catch { /* logging is non-fatal */ }

  if (sent > 0) return { ok: true, sent, failed, total: recipients.length, error: errorMessage };
  return { ok: false, error: errorMessage || "All sends failed." };
}

export type EmailerStats = { sent_month: number; sent_total: number; failed_total: number; batches_month: number };

export async function loadEmailerStats(): Promise<EmailerStats> {
  const fallback: EmailerStats = { sent_month: 0, sent_total: 0, failed_total: 0, batches_month: 0 };
  const { user } = await requireStaff();
  if (!user) return fallback;
  try {
    const supabase = getSupabaseServer();
    const sb = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };
    const { data } = await sb.rpc("emailer_stats");
    const d = (data as Partial<EmailerStats>) || {};
    return { ...fallback, ...d };
  } catch {
    return fallback;
  }
}
