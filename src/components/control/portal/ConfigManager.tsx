import { savePortalConfig } from "@/app/control/actions-portal";
import { Notice } from "@/components/control/bits";
import { CONFIG_TABLES, type ConfigField, type ConfigTable } from "@/components/control/portal/config-fields";
import { Section, label } from "@/components/control/portal/kit";
import { SubmitButton } from "@/components/control/SubmitButton";

type Value = string | number | boolean | null | undefined;
export type ConfigRow = { id: string; title: string; active: boolean; values: Record<string, Value> };
type Choice = { value: string; label: string };

/** "2026-05-29T13:03:00+00:00" → "2026-05-29T13:03", what a datetime-local field holds. Always UTC. */
function whenValue(v: Value): string {
  if (typeof v !== "string" || !v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

function Field({ field, value, id, choices }: { field: ConfigField; value: Value; id: string; choices?: Choice[] }) {
  const hint = field.hint ? (
    <p id={`${id}-hint`} className="field-hint">
      {field.hint}
    </p>
  ) : null;
  const described = field.hint ? `${id}-hint` : undefined;

  if (field.kind === "flag") {
    return (
      <div className="flex items-center gap-8">
        <input id={id} name={field.name} type="checkbox" defaultChecked={value === true} />
        <label htmlFor={id} className="text-sm text-ink">
          {field.label}
        </label>
      </div>
    );
  }
  if (field.kind === "choice" || field.kind === "row") {
    const options: Choice[] = field.kind === "row" ? (choices ?? []) : (field.options ?? []).map((o) => ({ value: o, label: label(o) }));
    return (
      <div className="field">
        <label htmlFor={id}>{field.label}</label>
        <select id={id} name={field.name} className="select" defaultValue={typeof value === "string" ? value : ""} required={field.required} aria-describedby={described}>
          {!field.required && <option value="">–</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hint}
      </div>
    );
  }
  const common = { id, name: field.name, className: "input", required: field.required, autoComplete: "off", "aria-describedby": described } as const;
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      {field.kind === "when" ? (
        <input {...common} type="datetime-local" defaultValue={whenValue(value)} />
      ) : field.kind === "integer" ? (
        <input {...common} type="text" inputMode="numeric" pattern="[0-9]{1,6}" defaultValue={value === null || value === undefined ? "" : String(value)} />
      ) : field.kind === "decimal" ? (
        <input {...common} type="text" inputMode="decimal" pattern="[0-9]{1,12}([.][0-9]{1,8})?" defaultValue={value === null || value === undefined ? "" : String(value)} />
      ) : (
        <input {...common} type="text" maxLength={field.max ?? 120} defaultValue={typeof value === "string" ? value : ""} />
      )}
      {hint}
    </div>
  );
}

function Form({ table, op, row, choices }: { table: ConfigTable; op: "create" | "update"; row?: ConfigRow; choices?: Choice[] }) {
  const spec = CONFIG_TABLES[table];
  const key = row?.id ?? "new";
  return (
    <form action={savePortalConfig} className="mt-13 grid gap-13">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="op" value={op} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-13 sm:grid-cols-2 xl:grid-cols-3">
        {spec.fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            id={`${table}-${key}-${field.name}`}
            // a new row starts active; everything else starts empty
            value={row ? row.values[field.name] : field.name === "active" ? true : undefined}
            choices={choices}
          />
        ))}
      </div>
      <div>
        <SubmitButton pending="Recording…" className="btn btn-primary btn-sm">
          {op === "create" ? `Add the ${spec.noun}` : "Save the changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Add, change and retire rows of one portal configuration table, for a person
 * who holds the table's capability (the page decides whether to draw this at
 * all; the server action and both databases check again). Each row is behind
 * its own disclosure, so nothing is changed by accident while reading the
 * table above. There is no delete: charges, partners and accounts point at
 * these rows, so one that is no longer wanted is retired and stays on record.
 */
export function ConfigManager({ table, title, rows, choices }: { table: ConfigTable; title: string; rows: ConfigRow[]; choices?: Choice[] }) {
  const spec = CONFIG_TABLES[table];
  return (
    <Section title={title} aside="Recorded in the audit log with your name">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink">Add a {spec.noun}</summary>
        <Form table={table} op="create" choices={choices} />
      </details>
      {rows.map((row) => (
        <details key={row.id} className="mt-13 border-t border-line pt-13">
          <summary className="cursor-pointer text-sm text-ink">
            Change <span className="font-semibold">{row.title}</span>
            {!row.active && <span className="text-ink-3"> (retired)</span>}
          </summary>
          <Form table={table} op="update" row={row} choices={choices} />
          {row.active && (
            <form action={savePortalConfig} className="mt-13">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="op" value="retire" />
              <input type="hidden" name="id" value={row.id} />
              <SubmitButton pending="Recording…" className="btn btn-ghost btn-sm">
                Retire this {spec.noun}
              </SubmitButton>
              <span className="ml-13 text-xs text-ink-3">It is switched off and kept on record; nothing is deleted.</span>
            </form>
          )}
        </details>
      ))}
    </Section>
  );
}

const SAVED: Record<string, string> = {
  created: "Added. The change is recorded in the audit log.",
  updated: "Saved. The change is recorded in the audit log.",
  retired: "Retired. It is switched off and stays on record.",
};

const REFUSED: Record<string, { title: string; body: string }> = {
  forbidden: { title: "Your role does not include this change", body: "Nothing was changed." },
  unconfigured: { title: "The portal’s database is not connected", body: "Nothing was changed." },
  invalid: { title: "That request was not understood", body: "Nothing was changed. Reload the page and try again." },
  value: {
    title: "A value was not accepted",
    body: "Nothing was changed. Amounts and rates are not negative; a percentage rate and a sub-IB share are fractions between 0 and 1 (0.005 is 0.5%); a maximum is not below a minimum; leverage is a whole number from 1 to 2000; a required field is not empty.",
  },
  duplicate: { title: "That name, or that code and version, is already used", body: "Nothing was changed." },
  defaultplan: { title: "The default plan cannot be retired", body: "Nothing was changed. Make another plan the default first." },
  missing: { title: "That row no longer exists in the portal", body: "Nothing was changed." },
  audit: { title: "The change could not be recorded, so it was not made", body: "Nothing was changed in the portal. Try again in a moment." },
  portal: { title: "The portal did not accept the change", body: "The attempt is recorded in the audit log. Check the table above before trying again." },
};

/** What the last change did, from the fixed codes the server action redirects with. */
export function ConfigNotice({ notice, error }: { notice: string; error: string }) {
  const refused = REFUSED[error];
  if (refused) {
    return (
      <div className="mt-21">
        <Notice tone="error" title={refused.title}>
          {refused.body}
        </Notice>
      </div>
    );
  }
  const saved = SAVED[notice];
  return saved ? (
    <div className="mt-21">
      <Notice tone="ok" title={saved} />
    </div>
  ) : null;
}
