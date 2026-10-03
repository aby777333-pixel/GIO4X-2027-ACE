"use client";

// §24 Legal documents editor — admins write and publish terms / risk disclosure
// / privacy. Publishing exposes the doc at /legal/<key>; unpublished stays a draft.

import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Pencil, Check, ExternalLink } from "lucide-react";
import { saveLegalDoc, setLegalPublished, type LegalDoc } from "@/lib/legal-actions";
import { withBase } from "@/lib/base-path";

export function LegalClient({ docs }: { docs: LegalDoc[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const publish = (d: LegalDoc) => start(async () => {
    const r = await setLegalPublished(d.id, !d.published);
    setNotice(r.ok ? `${d.title} ${!d.published ? "published" : "unpublished"}` : (r.error ?? "Update failed"));
  });

  return (
    <div className="space-y-3">
      {notice && <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-[12px] text-success">{notice}</div>}
      {docs.map((d) => editing === d.id ? (
        <Editor key={d.id} doc={d} onDone={(m) => { setNotice(`Saved: ${m}`); setEditing(null); }} onCancel={() => setEditing(null)} />
      ) : (
        <div key={d.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy">{d.title}</span>
            <span className="font-mono text-[10px] text-steel">/legal/{d.key}</span>
            <StatusBadge tone={d.published ? "success" : "neutral"}>{d.published ? `published v${d.version}` : "draft"}</StatusBadge>
            <span className="ml-auto flex items-center gap-3">
              {d.published && (
                <a href={withBase(`/legal/${d.key}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-steel hover:text-sky">
                  <ExternalLink size={12} /> View
                </a>
              )}
              <button onClick={() => publish(d)} disabled={pending} className="text-[11px] font-semibold text-sky disabled:opacity-40">
                {d.published ? "Unpublish" : "Publish"}
              </button>
              <button onClick={() => setEditing(d.id)} className="flex items-center gap-1 text-[11px] font-semibold text-steel hover:text-sky">
                <Pencil size={12} /> Edit
              </button>
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] text-steel">{d.body.slice(0, 160) || "— empty —"}</p>
        </div>
      ))}
      {docs.length === 0 && <p className="text-[12px] text-steel">No legal documents.</p>}
      <p className="text-[11px] text-steel">Published documents are public at /legal/&lt;key&gt; and linked from signup. Drafts are hidden. Editing bumps the version.</p>
    </div>
  );
}

function Editor({ doc, onDone, onCancel }: { doc: LegalDoc; onDone: (m: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    setErr(null);
    const r = await saveLegalDoc({ id: doc.id, title, body });
    if (r.ok) onDone(`${title} (v${doc.version + 1})`);
    else setErr(r.error ?? "Save failed.");
  });
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        className="mb-2 block w-full rounded border border-steel/25 px-2 py-1.5 text-[13px] font-semibold text-navy outline-none focus:border-sky" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
        placeholder="Document text (plain text / markdown)…"
        className="block w-full rounded border border-steel/25 px-3 py-2 text-[12px] text-navy outline-none focus:border-sky" />
      <div className="mt-2 flex items-center gap-2">
        {err && <span className="text-[11px] text-danger">{err}</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} disabled={pending} className="rounded px-3 py-1.5 text-[11px] font-semibold text-steel disabled:opacity-40">Cancel</button>
          <button onClick={submit} disabled={pending || !title.trim()} className="flex items-center gap-1 rounded bg-sky px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
            <Check size={12} /> Save &amp; bump version
          </button>
        </div>
      </div>
    </div>
  );
}
