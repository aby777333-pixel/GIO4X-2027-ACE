"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { UserPlus, Save } from "lucide-react";
import { createStaffUser, setStaffAccess, type TeamMember } from "@/lib/team-actions";

type Section = { key: string; label: string };

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

function chip(active: boolean) {
  return `cursor-pointer rounded-md border px-2.5 py-1 text-[11px] transition ${
    active ? "border-sky bg-sky/10 text-sky" : "border-slate-200 text-steel hover:bg-slate-50"
  }`;
}

export function CreateTeamMember({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "staff" });
  const [granted, setGranted] = useState<Set<string>>(new Set(sections.map((s) => s.key)));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = form.role === "admin";

  function toggle(key: string) {
    setGranted((g) => {
      const n = new Set(g);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function submit() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await createStaffUser({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
        sections: [...granted],
      });
      if (res.ok) {
        setMsg(res.message ?? "Created.");
        setForm({ fullName: "", email: "", password: "", role: "staff" });
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inputCls} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className={inputCls} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={inputCls} placeholder="Temp password (8+ chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="staff">Staff / Employee</option>
          <option value="admin">Master Admin</option>
        </select>
      </div>

      {isAdmin ? (
        <p className="text-xs text-amber-700">Master admins have full access to every section.</p>
      ) : (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-steel-light">Section access</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <label key={s.key} className={chip(granted.has(s.key))}>
                <input type="checkbox" className="mr-1.5 align-middle" checked={granted.has(s.key)} onChange={() => toggle(s.key)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {msg ? <p className="text-xs font-medium text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
      <Button variant="primary" onClick={submit} disabled={pending || !form.email || form.password.length < 8}>
        <UserPlus size={15} className="mr-1.5" /> {pending ? "Creating…" : "Create team member"}
      </Button>
    </div>
  );
}

export function TeamRoster({ team, sections }: { team: TeamMember[]; sections: Section[] }) {
  if (team.length === 0) {
    return <p className="py-6 text-center text-sm text-steel">No team members yet.</p>;
  }
  return (
    <div className="space-y-2">
      {team.map((m) => (
        <TeamRow key={m.id} member={m} sections={sections} />
      ))}
    </div>
  );
}

function TeamRow({ member, sections }: { member: TeamMember; sections: Section[] }) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  // NULL staff_sections = unrestricted → start with everything checked.
  const [granted, setGranted] = useState<Set<string>>(
    new Set(member.staff_sections ?? sections.map((s) => s.key)),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = role === "admin";

  function toggle(key: string) {
    setGranted((g) => {
      const n = new Set(g);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await setStaffAccess(member.id, role, [...granted]);
      if (res.ok) {
        setMsg("Saved");
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-navy">{member.full_name?.trim() || member.email}</div>
          <div className="truncate text-[11px] text-steel-light">{member.email}</div>
        </div>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-[11px] font-medium text-emerald-600">{msg}</span> : null}
          {err ? <span className="text-[11px] font-medium text-rose-600">{err}</span> : null}
          <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Staff</option>
            <option value="admin">Master Admin</option>
          </select>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-sky px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-sky-light disabled:opacity-50"
          >
            <Save size={13} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {isAdmin ? (
        <p className="mt-2 text-[11px] text-amber-700">Full access (master admin).</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <label key={s.key} className={chip(granted.has(s.key))}>
              <input type="checkbox" className="mr-1 align-middle" checked={granted.has(s.key)} onChange={() => toggle(s.key)} />
              {s.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
