"use client";

// Personal information card — owns the whole Card so the Edit toggle can
// swap the body between a read-only `<dl>` and the edit form WITHOUT
// shoving the form into CardHeader's flex row (which was the visual bug
// before this component existed: the form rendered next to the title,
// the dl stayed put below it, and the page looked misaligned).

import { useState, useTransition, type ReactNode } from "react";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { updateProfile } from "@/lib/profile-actions";

export type PersonalInfoData = {
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string;
  timezone: string;
  avatar_url: string | null;
  referral_code: string | null;
};

export function PersonalInfoCard({ data }: { data: PersonalInfoData }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Saved.");
        setEditing(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal information</CardTitle>
        {editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="text-xs font-medium text-steel hover:text-navy"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSuccess(null);
            }}
            className="text-xs font-medium text-sky hover:underline"
          >
            Edit
          </button>
        )}
      </CardHeader>
      <CardBody>
        {success && !editing ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {success}
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field name="full_name" label="Full name" defaultValue={data.full_name} required />
              <ReadOnlyField label="Email" value={data.email ?? "—"} />
              <Field name="phone" label="Phone" defaultValue={data.phone ?? ""} />
              <Field name="country" label="Country (ISO code, e.g. IN)" defaultValue={data.country ?? ""} />
              <Field name="language" label="Language (e.g. en)" defaultValue={data.language} />
              <Field name="timezone" label="Timezone (e.g. Asia/Kolkata)" defaultValue={data.timezone} />
              <div className="sm:col-span-2">
                <Field name="avatar_url" label="Avatar URL" defaultValue={data.avatar_url ?? ""} />
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-navy"
                disabled={pending}
              >
                Cancel
              </button>
              <Button variant="primary" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Full name" value={data.full_name} />
            <Row label="Email" value={data.email ?? "—"} />
            <Row label="Phone" value={data.phone ?? "—"} />
            <Row label="Country" value={data.country ?? "—"} />
            <Row label="Language" value={data.language} />
            <Row label="Timezone" value={data.timezone} />
            <div className="col-span-2">
              <dt className="text-[11px] uppercase tracking-wider text-steel-light">Referral code</dt>
              <dd className="mt-0.5 font-mono text-navy">{data.referral_code ?? "—"}</dd>
            </div>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-steel-light">{label}</dt>
      <dd className="mt-0.5 text-navy">{value}</dd>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-steel-light">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-steel-light">{label}</label>
      <div className="mt-1 w-full cursor-not-allowed rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-steel">
        {value}
      </div>
    </div>
  );
}
