"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gio4x/ui";
import { Coins, LinkIcon, Search, UserPlus, X } from "lucide-react";
import {
  settleCommissions,
  linkIb,
  setIbRole,
  searchProfiles,
  type ProfileOption,
  type UnsettledIb,
} from "@/lib/ib-actions";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

// Settle one IB's accrued commission into their wallet.
export function SettleButton({ ib }: { ib: UnsettledIb }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await settleCommissions(ib.ib_user_id, ib.currency);
      if (res.ok) {
        setMsg(res.message ?? "Settled.");
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-[11px] font-medium text-emerald-600">{msg}</span> : null}
      {err ? <span className="text-[11px] font-medium text-rose-600">{err}</span> : null}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <Coins size={14} /> {pending ? "Settling…" : "Settle"}
      </button>
    </div>
  );
}

// A debounced profile picker for the manual-link tool.
export function ProfilePicker({
  label,
  value,
  onPick,
}: {
  label: string;
  value: ProfileOption | null;
  onPick: (p: ProfileOption | null) => void;
}) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<ProfileOption[]>([]);
  const [pending, startTransition] = useTransition();

  function search(next: string) {
    setQ(next);
    startTransition(async () => {
      setOpts(await searchProfiles(next));
    });
  }

  if (value) {
    return (
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
          {label}
        </span>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-navy">{value.label}</span>
          <button type="button" onClick={() => onPick(null)} aria-label="Clear">
            <X size={15} className="text-steel" />
          </button>
        </div>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-steel-light">
        {label}
      </span>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-steel-light" />
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          className={inputCls + " pl-8"}
          placeholder="Search name, email or referral code…"
        />
      </div>
      {q.length >= 2 ? (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-100">
          {pending ? (
            <div className="px-3 py-2 text-xs text-steel-light">Searching…</div>
          ) : opts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-steel-light">No matches.</div>
          ) : (
            opts.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onPick(o);
                  setQ("");
                  setOpts([]);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}

// Manually enrol a child IB under a parent (fires the closure rebuild server-side).
export function LinkIbTool() {
  const router = useRouter();
  const [parent, setParent] = useState<ProfileOption | null>(null);
  const [child, setChild] = useState<ProfileOption | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setErr(null);
    if (!parent || !child) {
      setErr("Pick both a parent and a child IB.");
      return;
    }
    startTransition(async () => {
      const res = await linkIb(parent.id, child.id);
      if (res.ok) {
        setMsg(res.message ?? "Linked.");
        setParent(null);
        setChild(null);
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfilePicker label="Parent IB" value={parent} onPick={setParent} />
        <ProfilePicker label="Child (sub-IB / client)" value={child} onPick={setChild} />
      </div>
      {msg ? <p className="text-xs font-medium text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
      <Button variant="primary" onClick={submit} disabled={pending || !parent || !child}>
        <LinkIcon size={15} className="mr-1.5" /> {pending ? "Linking…" : "Link relationship"}
      </Button>
    </div>
  );
}

// Register/promote a person to IB, optionally placing them under a master/parent.
export function PromoteIbTool() {
  const router = useRouter();
  const [person, setPerson] = useState<ProfileOption | null>(null);
  const [parent, setParent] = useState<ProfileOption | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setErr(null);
    if (!person) {
      setErr("Pick a person to promote to IB.");
      return;
    }
    startTransition(async () => {
      const res = await setIbRole(person.id, true);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      if (parent) {
        const lr = await linkIb(parent.id, person.id);
        if (!lr.ok) {
          setErr(`Promoted, but linking failed: ${lr.error}`);
          router.refresh();
          return;
        }
      }
      setMsg(parent ? "Registered as IB and placed under the parent." : "Registered as IB.");
      setPerson(null);
      setParent(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ProfilePicker label="Person to make an IB" value={person} onPick={setPerson} />
        <ProfilePicker label="Place under (optional master / parent IB)" value={parent} onPick={setParent} />
      </div>
      {msg ? <p className="text-xs font-medium text-emerald-600">{msg}</p> : null}
      {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
      <Button variant="primary" onClick={submit} disabled={pending || !person}>
        <UserPlus size={15} className="mr-1.5" /> {pending ? "Registering…" : "Register / promote IB"}
      </Button>
    </div>
  );
}
