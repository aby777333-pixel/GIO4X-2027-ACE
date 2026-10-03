"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import {
  Mail, Upload, Paperclip, Send, X, CheckCircle2, AlertTriangle, Loader2, FileText,
} from "lucide-react";
import { sendBulkEmail, type EmailerStats } from "@/lib/emailer-actions";
import type { EmailTemplate } from "@/lib/email-templates";

type Attachment = { filename: string; content: string; size: number; contentType?: string };

const DEFAULT_TAGS = ["{{client_name}}", "{{account_balance}}", "{{next_action}}", "{{fund_name}}"];
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function parseRecipients(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
}
function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function EmailerTools({
  templates,
  stats,
  configured,
}: {
  templates: EmailTemplate[];
  stats: EmailerStats;
  configured: boolean;
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const recipientList = useMemo(() => parseRecipients(recipients), [recipients]);
  const deliveryRate = useMemo(() => {
    const denom = stats.sent_total + stats.failed_total;
    return denom > 0 ? Math.round((stats.sent_total / denom) * 1000) / 10 : null;
  }, [stats]);

  function loadTemplate(t: EmailTemplate) {
    setSubject(t.subject);
    setBody(t.body);
    setTemplateId(t.id);
    setTags(t.mergeTags.length ? t.mergeTags : DEFAULT_TAGS);
    setResult(null);
  }

  function insertTag(tag: string) {
    setBody((b) => (b.endsWith("\n") || b === "" ? b + tag : b + " " + tag));
  }

  function importCsv(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^﻿/, "");
      const found = text.match(EMAIL_RE) || [];
      const merged = Array.from(new Set([...recipientList, ...found.map((e) => e.toLowerCase())]));
      setRecipients(merged.join(", "));
    };
    reader.readAsText(file);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setResult({ ok: false, msg: `"${file.name}" exceeds the 25MB limit.` });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const content = dataUrl.replace(/^data:[^;]+;base64,/, "");
        setAttachments((prev) => [...prev, { filename: file.name, content, size: file.size, contentType: file.type || undefined }]);
      };
      reader.readAsDataURL(file);
    });
  }

  async function send() {
    setResult(null);
    if (recipientList.length === 0) { setResult({ ok: false, msg: "Add at least one recipient." }); return; }
    if (!subject.trim()) { setResult({ ok: false, msg: "Subject is required." }); return; }
    if (!body.trim()) { setResult({ ok: false, msg: "Email body is required." }); return; }
    setPending(true);
    try {
      const res = await sendBulkEmail({
        recipients: recipientList,
        subject,
        body,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        templateId,
      });
      if (res.ok) {
        setResult({ ok: true, msg: `Sent to ${res.sent} of ${res.total} recipient(s)${res.failed ? ` · ${res.failed} failed` : ""}.${res.error ? " " + res.error : ""}` });
        router.refresh();
      } else {
        setResult({ ok: false, msg: res.error });
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setPending(false);
    }
  }

  const statCards = [
    { label: "Sent this month", value: stats.sent_month.toLocaleString() },
    { label: "Total sent", value: stats.sent_total.toLocaleString() },
    { label: "Delivery rate", value: deliveryRate == null ? "—" : `${deliveryRate}%` },
    { label: "Batches this month", value: stats.batches_month.toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards (real, from email_logs) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardBody className="py-4">
              <div className="text-xs text-steel">{s.label}</div>
              <div className="mt-1 text-2xl font-bold text-navy">{s.value}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Composer */}
        <Card>
          <CardHeader><CardTitle>Email Composer</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-start gap-2">
              <textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="Recipient email(s) — separate with commas, or use Import CSV"
                rows={2}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
              />
              <button
                type="button"
                onClick={() => csvRef.current?.click()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-navy hover:border-sky/40"
              >
                <Upload size={14} /> Import CSV
              </button>
              <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className="text-[11px] text-steel">{recipientList.length} recipient(s)</div>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
            />

            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insertTag(t)}
                  className="rounded-md bg-sky/10 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky/20"
                  title="Insert merge tag"
                >
                  {t}
                </button>
              ))}
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email…"
              rows={12}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
            />

            {/* Attachments */}
            <div className="rounded-lg border border-dashed border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-steel">
                  <Paperclip size={14} /> Attach reports, PDFs, images… (25MB/file)
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy hover:border-sky/40">
                  <Upload size={14} /> Choose files
                </button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((a, i) => (
                    <div key={`${a.filename}-${i}`} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs text-navy">
                      <span className="flex items-center gap-1.5 truncate"><FileText size={12} /> {a.filename} <span className="text-steel">· {fmtSize(a.size)}</span></span>
                      <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-steel hover:text-rose-600"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {result.msg}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className={`inline-flex items-center gap-1.5 text-[11px] ${configured ? "text-emerald-600" : "text-amber-600"}`}>
                {configured ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {configured ? "Connected to Resend Email API" : "Email key not set — add RESEND_API_KEY to send"}
              </div>
              <div className="flex gap-2">
                <button type="button" disabled title="Scheduling coming soon" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400">
                  Schedule
                </button>
                <Button variant="primary" onClick={send} disabled={pending}>
                  {pending ? (<span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Sending…</span>) : (<span className="inline-flex items-center gap-2"><Send size={14} /> Send Now</span>)}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Template library */}
        <Card>
          <CardHeader><CardTitle>Template Library</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            <p className="text-[11px] text-steel">Click a template to populate subject + body with placeholder fillers.</p>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadTemplate(t)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${templateId === t.id ? "border-sky/50 bg-sky/5" : "border-slate-200 hover:border-sky/30 hover:bg-slate-50"}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-navy"><Mail size={13} className="text-sky" /> {t.name}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-steel">{t.category} · {t.mergeTags.length} fillers</div>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
