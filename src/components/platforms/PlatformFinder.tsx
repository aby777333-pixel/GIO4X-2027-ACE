"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { compareRows, finderValue, finderWhere, platformOrder, platforms, type PlatformKey, type ValueKey, type WhereKey } from "@/data/platforms";
import { FactCell } from "./FactState";
import { FinderWait } from "./FinderWait";

/**
 * "Find your platform": two questions, a factual read-out for BOTH platforms,
 * and no recommendation. The summary is assembled from the same rows as the
 * matrix, so it can never say more than the matrix does.
 */
export function PlatformFinder() {
  const [where, setWhere] = useState<WhereKey | null>(null);
  const [value, setValue] = useState<ValueKey | null>(null);
  const id = useId();

  const w = finderWhere.find((x) => x.key === where);
  const v = finderValue.find((x) => x.key === value);
  const rowKeys = [...(w?.rows ?? []), ...(v?.rows ?? [])];
  const rows = rowKeys.map((k) => compareRows.find((r) => r.key === k)).filter((r) => r !== undefined);
  const ready = where !== null && value !== null;

  const option = (name: string, key: string, label: string, checked: boolean, onChange: () => void) => (
    <label
      key={key}
      className={`flex min-h-[2.75rem] cursor-pointer items-center gap-13 border-b border-line px-13 py-8 text-sm transition-colors duration-fast has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
        checked ? "bg-surface font-medium text-ink" : "text-ink-2 hover:bg-surface"
      }`}
    >
      <input type="radio" name={name} value={key} checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden className={`grid h-13 w-13 shrink-0 place-content-center rounded-full border ${checked ? "border-accent" : "border-ink-3"}`}>
        <span className={`h-[0.4375rem] w-[0.4375rem] rounded-full ${checked ? "bg-accent" : "bg-transparent"}`} />
      </span>
      {label}
    </label>
  );

  return (
    <div className="grid gap-34 lg:grid-cols-phi-r lg:gap-55">
      <div className="grid content-start gap-34">
        <fieldset>
          <legend className="label">
            <span className="num text-prestige-ink">1</span> · Where do you trade most?
          </legend>
          <div className="mt-13 border-t border-line-strong">{finderWhere.map((o) => option(`${id}-where`, o.key, o.label, where === o.key, () => setWhere(o.key)))}</div>
        </fieldset>
        <fieldset>
          <legend className="label">
            <span className="num text-prestige-ink">2</span> · What do you value?
          </legend>
          <div className="mt-13 border-t border-line-strong">{finderValue.map((o) => option(`${id}-value`, o.key, o.label, value === o.key, () => setValue(o.key)))}</div>
        </fieldset>
      </div>

      <div aria-live="polite" className="panel-quiet p-21 lg:p-34">
        {!ready ? (
          <div className="flex h-full flex-col gap-21">
            {/* the waiting instrument: decorative, and it treats both platforms alike */}
            <FinderWait
              className="min-h-[10.5rem] flex-1 lg:min-h-[15rem]"
              panes={platformOrder.map((k) => platforms[k].name)}
              first={where === null ? null : finderWhere.findIndex((x) => x.key === where)}
              firstCount={finderWhere.length}
              second={value === null ? null : finderValue.findIndex((x) => x.key === value)}
              secondCount={finderValue.length}
            />
            <div className="grid gap-8">
              <p className="h4">Answer both questions.</p>
              <p className="max-w-measure text-sm text-ink-2">You will see what each platform documents for those two needs. You will not be told which to choose.</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="label">
              {w?.label} · {v?.label}
            </p>
            <h3 className="h3 mt-8">What each platform documents.</h3>
            <div className="mt-21 grid gap-34 md:grid-cols-2">
              {platformOrder.map((k: PlatformKey) => (
                <section key={k} aria-label={platforms[k].name}>
                  <h4 className="border-b border-line-strong pb-8 font-display text-lg text-ink">{platforms[k].name}</h4>
                  <dl>
                    {rows.map((r) => (
                      <div key={r.key} className="border-b border-line py-13">
                        <dt className="label">{r.label}</dt>
                        <dd className="mt-5">
                          <FactCell fact={r[k]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {v?.note?.[k] && <p className="mt-13 text-sm text-ink-2">{v.note[k]}</p>}
                  <Link href={platforms[k].href} className="go mt-21 min-h-[2.75rem] md:min-h-0">
                    {platforms[k].short}
                  </Link>
                </section>
              ))}
            </div>
            <p className="mt-34 border-t border-line pt-13 text-sm text-ink-2">
              This is a read-out of published facts, not a recommendation. Where a line says “Not yet published”, the honest position is that we cannot tell you. The choice is yours.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
