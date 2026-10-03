import Link from "next/link";
import type { ReactNode } from "react";
import { ControlHead, Notice } from "@/components/control/bits";
import type { PortalPerson } from "@/lib/server/portal-db";

/**
 * Shared pieces for the Control sections that read the client portal's
 * database (src/lib/server/portal-db.ts). Presentation only: nothing here
 * fetches. Figures are shown as the portal recorded them, never rounded into
 * something else and never invented: an absent value is a dash.
 */

/** In place of a section when the portal's database is not connected to this deployment. */
export function PortalUnconfigured({ title }: { title: string }) {
  return (
    <>
      <ControlHead title={title} />
      <div className="mt-21">
        <Notice title="The client portal’s database is not connected here">
          This section reads client records from the portal. Set <span className="num">PORTAL_SUPABASE_URL</span> and <span className="num">PORTAL_SUPABASE_SECRET_KEY</span> in the hosting environment (see{" "}
          <span className="num">docs/PORTAL-GATEWAY.md</span>), then redeploy.
        </Notice>
      </div>
    </>
  );
}

/** Above the table when a read failed: said once, with nothing shown as if it were complete. */
export function PortalReadFailed() {
  return (
    <div className="mt-21">
      <Notice tone="error" title="The portal’s records could not be read just now">
        Nothing below is complete. Reload in a moment; if it persists, the portal’s database may be unavailable.
      </Notice>
    </div>
  );
}

/**
 * Every portal-backed section says where its figures come from, and whether it
 * only reads or the person looking at it can also decide something here.
 */
export function PortalSource({ children, decides = false }: { children?: ReactNode; decides?: boolean }) {
  return (
    <p className="mt-13 text-xs text-ink-3">
      Read from the client portal’s records.{" "}
      {decides
        ? "A decision made here is written to the portal and recorded in the audit log with your name."
        : "This screen only reads; nothing here changes a balance or a client’s status."}
      {children ? <> {children}</> : null}
    </p>
  );
}

const money = new Map<string, Intl.NumberFormat>();
/** An amount with its currency, to the cents the portal stored. "–" for nothing. */
export function fmtMoney(value: number | string | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "–";
  const digits = currency === "BTC" || currency === "ETH" ? 8 : 2;
  let f = money.get(String(digits));
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: digits });
    money.set(String(digits), f);
  }
  return currency ? `${f.format(n)} ${currency}` : f.format(n);
}

const plain = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 5 });
export function fmtNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? plain.format(n) : "–";
}

/** snake_case from the database as words: "in_review" → "In review". */
export function label(value: string | null | undefined): string {
  if (!value) return "–";
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// shape + label, never colour alone (the .state classes of the console)
const GOOD = new Set(["approved", "active", "completed", "applied", "posted", "closed", "processed", "sent", "published", "settled", "redeemed"]);
const WAIT = new Set(["pending", "in_review", "in_progress", "processing", "open", "scheduled", "pending_verification", "not_started", "paused", "queued"]);
export function StateBadge({ value }: { value: string | null | undefined }) {
  const v = value ?? "";
  const cls = GOOD.has(v) ? "state-open" : WAIT.has(v) ? "state-pre" : "state-off";
  return <span className={`state ${cls} whitespace-nowrap`}>{label(v)}</span>;
}

/** A person from the portal: name over address. An unknown id is shown by its first characters, never guessed. */
export function Person({ person, id }: { person?: PortalPerson; id?: string | null }) {
  if (!person) return <span className="num text-ink-3">{id ? `${id.slice(0, 8)}…` : "–"}</span>;
  return (
    <span className="block min-w-0">
      <span className="block truncate text-ink">{person.name || person.email || `${person.id.slice(0, 8)}…`}</span>
      {person.name && person.email && <span className="block truncate text-xs text-ink-3">{person.email}</span>}
    </span>
  );
}

/** A row of figures above a table. Each is a count or a sum of what the portal holds, with its unit. */
export function Figures({ items }: { items: { label: string; value: ReactNode; note?: string }[] }) {
  return (
    <dl className="mt-21 grid gap-13 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="gxc-card">
          <div className="gxc-card-body">
            <dt className="text-xs text-ink-3">{item.label}</dt>
            <dd className="num mt-3 text-lg font-semibold text-ink">{item.value}</dd>
            {item.note && <p className="mt-3 text-xs text-ink-3">{item.note}</p>}
          </div>
        </div>
      ))}
    </dl>
  );
}

/** Filter links: the current one is marked, the rest are plain links that keep nothing else. */
export function FilterTabs({ base, param, current, options, allLabel = "All" }: { base: string; param: string; current: string; options: readonly string[]; allLabel?: string }) {
  const item = (value: string, text: string) => {
    const on = current === value;
    return (
      <Link key={value || "all"} href={value ? `${base}?${param}=${encodeURIComponent(value)}` : base} aria-current={on ? "true" : undefined} className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`}>
        {text}
      </Link>
    );
  };
  return (
    <nav aria-label="Filter" className="mt-21 flex flex-wrap gap-8">
      {item("", allLabel)}
      {options.map((o) => item(o, label(o)))}
    </nav>
  );
}

/** A titled card holding one table (or anything else), as the console's other sections have it. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="gxc-card mt-21">
      <div className="gxc-card-head">
        <h2 className="gxc-card-title">{title}</h2>
        {aside && <span className="text-xs text-ink-3">{aside}</span>}
      </div>
      <div className="gxc-card-body">{children}</div>
    </section>
  );
}
