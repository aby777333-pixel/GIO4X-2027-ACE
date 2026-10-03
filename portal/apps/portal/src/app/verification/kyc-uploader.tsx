"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@gio4x/ui";
import { createBrowserSupabaseClient } from "@gio4x/supabase";
import { UploadCloud, X, FileCheck, Loader2 } from "lucide-react";
import { recordKycDocument, deleteKycDocument } from "@/lib/kyc-actions";

type DocType = "passport" | "national_id" | "drivers_license" | "utility_bill" | "bank_statement" | "selfie" | "other";
type DocStatus = "pending" | "in_review" | "approved" | "rejected";

export type KycDoc = {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  file_name: string | null;
  storage_path: string;
  created_at: string;
  rejection_reason: string | null;
};

export function KycUploader({
  userId,
  docType,
  label,
  hint,
  accept,
  existing,
  signedIn,
}: {
  userId: string | null;
  docType: DocType;
  label: string;
  hint: string;
  accept: string;
  existing: KycDoc[];
  signedIn: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!signedIn || !userId) {
      setError("Sign in to upload documents.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (10 MB max).");
      return;
    }
    setError(null);
    setUploading(true);

    const supabase = createBrowserSupabaseClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${docType}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }

    startTransition(async () => {
      const res = await recordKycDocument({
        docType,
        storagePath: path,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
      });
      setUploading(false);
      if (!res.ok) setError(res.error);
    });
  }

  function onRemove(id: string) {
    startTransition(async () => {
      const res = await deleteKycDocument(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-navy">{label}</div>
          <div className="mt-0.5 text-xs text-steel">{hint}</div>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={onPick}
            className="hidden"
          />
          <Button
            variant="primary"
            className="!py-1.5 !text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || pending}
          >
            {uploading || pending ? (
              <>
                <Loader2 size={12} className="mr-1 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <UploadCloud size={12} className="mr-1" /> Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {existing.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {existing.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileCheck size={14} className="shrink-0 text-sky" />
                <span className="truncate text-navy">{d.file_name ?? d.storage_path.split("/").pop()}</span>
                <StatusPill status={d.status} />
              </div>
              {d.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="rounded p-1 text-steel hover:text-rose-600"
                  aria-label="Remove"
                  disabled={pending}
                >
                  <X size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    in_review: { label: "In review", cls: "bg-sky/10 text-sky" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}
