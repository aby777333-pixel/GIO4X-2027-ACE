"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { Notice } from "@/components/control/bits";
import { BULK_MAX, type BulkOp, type BulkState } from "@/components/control/bulk-shared";

/**
 * Bulk selection on a list, in three small pieces that find each other through
 * the form they belong to (the `form` attribute), not through React state, so
 * the list itself can stay a server-rendered table:
 *
 *   <BulkBox>        the box on a row. An ordinary checkbox named `id`.
 *   <BulkSelectAll>  ticks or clears every box on the page.
 *   <BulkBar>        the form. It appears once something is ticked, offers the
 *                    actions, and sends the ticked ids with the chosen change.
 *
 * A list is drawn twice (a table from `md` up, stacked rows below), so a row
 * has two boxes; they are kept in step and the server counts each id once.
 */

const boxes = (formId: string): HTMLInputElement[] => [...document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="id"][form="${formId}"]`)];

/** Said to the other pieces after boxes were changed by script (a change made by hand already bubbles as `change`). */
const CHANGED = "gxc:bulk";

function useSelection(formId: string): { count: number; all: number } {
  const [state, setState] = useState({ count: 0, all: 0 });
  const recount = useCallback(() => {
    const list = boxes(formId);
    const count = new Set(list.filter((b) => b.checked).map((b) => b.value)).size;
    const all = new Set(list.map((b) => b.value)).size;
    setState((s) => (s.count === count && s.all === all ? s : { count, all }));
  }, [formId]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const box = e.target;
      if (box instanceof HTMLInputElement && box.name === "id" && box.getAttribute("form") === formId) {
        // the same row's box in the other layout follows
        for (const twin of boxes(formId)) if (twin !== box && twin.value === box.value) twin.checked = box.checked;
      }
      recount();
    };
    // a form reset (React resets a form after its action) clears the boxes after the event, not before
    const onReset = () => window.setTimeout(recount, 0);
    document.addEventListener("change", onChange);
    document.addEventListener(CHANGED, recount);
    document.addEventListener("reset", onReset);
    recount();
    return () => {
      document.removeEventListener("change", onChange);
      document.removeEventListener(CHANGED, recount);
      document.removeEventListener("reset", onReset);
    };
  }, [formId, recount]);

  return state;
}

/** The box on one row. `reference` names the row for assistive technology. */
export function BulkBox({ formId, id, reference }: { formId: string; id: string; reference: string }) {
  return (
    <label className="check inline-grid grid-cols-[1.3125rem] gap-0">
      <input type="checkbox" name="id" value={id} form={formId} />
      <span className="sr-only">Select {reference}</span>
    </label>
  );
}

/** Ticks every row on this page, or clears them all. Half-ticked while only some are. */
export function BulkSelectAll({ formId, label = "Select all on this page", showLabel = false }: { formId: string; label?: string; showLabel?: boolean }) {
  const { count, all } = useSelection(formId);
  const box = useRef<HTMLInputElement | null>(null);
  const some = count > 0 && count < all;

  useEffect(() => {
    if (box.current) box.current.indeterminate = some;
  }, [some]);

  return (
    <label className={`check ${showLabel ? "" : "inline-grid grid-cols-[1.3125rem] gap-0"}`}>
      <input
        ref={box}
        type="checkbox"
        checked={all > 0 && count === all}
        aria-checked={some ? "mixed" : undefined}
        onChange={(e) => {
          for (const b of boxes(formId)) b.checked = e.target.checked;
          document.dispatchEvent(new Event(CHANGED));
        }}
      />
      <span className={showLabel ? "" : "sr-only"}>{label}</span>
    </label>
  );
}

function outcome(state: BulkState, noun: readonly [string, string]): { tone: "ok" | "error"; title: string; text?: string } {
  switch (state.code) {
    case "done": {
      const title = `${state.changed} ${state.changed === 1 ? noun[0] : noun[1]} updated`;
      if (state.refused === 0) return { tone: "ok", title };
      return {
        tone: "error",
        title: `${title}, ${state.refused} refused`,
        text: `${state.refused === 1 ? "One row was" : `${state.refused} rows were`} not changed: your role or the database did not allow it, or the row could not be saved. Open ${state.refused === 1 ? "it" : "one"} to see where it stands.`,
      };
    }
    case "none":
      return { tone: "error", title: "Nothing was selected", text: "Tick at least one row, then apply the change." };
    case "too-many":
      return { tone: "error", title: "Too many rows", text: `One request changes ${BULK_MAX} rows at most. Nothing was changed.` };
    case "reason":
      return { tone: "error", title: "A reason is needed", text: "Moving enquiries to Lost needs the reason. Nothing was changed." };
    case "forbidden":
      return { tone: "error", title: "Your role does not allow that change", text: "Nothing was changed." };
    case "signed-out":
      return { tone: "error", title: "Your session has ended", text: "Sign in again and repeat the change. Nothing was changed." };
    case "unavailable":
      return { tone: "error", title: "The database could not be reached", text: "Nothing was changed; please try again." };
    default:
      return { tone: "error", title: "That request was not valid", text: "Nothing was changed." };
  }
}

/**
 * The form the ticked boxes belong to. The change is applied on the server to
 * each row in turn, as the signed-in person, by the same update the row's own
 * page makes; the answer is how many were updated and how many were refused.
 */
export function BulkBar({ formId, action, ops, noun }: { formId: string; action: (previous: BulkState | null, formData: FormData) => Promise<BulkState>; ops: readonly BulkOp[]; noun: readonly [string, string] }) {
  const uid = useId();
  const router = useRouter();
  const { count } = useSelection(formId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [opKey, setOpKey] = useState("");
  const [value, setValue] = useState("");
  const [second, setSecond] = useState("");
  const [shown, setShown] = useState<BulkState | null>(null);

  const op = ops.find((o) => o.key === opKey);
  const then = op?.then && value === op.then.when ? op.then : null;
  const ready = !!op && value !== "" && (!then || second !== "") && count > 0 && count <= BULK_MAX;

  // a new answer: show it, start again, and read the list afresh
  useEffect(() => {
    if (!state) return;
    setShown(state);
    setOpKey("");
    setValue("");
    setSecond("");
    for (const b of boxes(formId)) b.checked = false;
    document.dispatchEvent(new Event(CHANGED));
    if (state.code === "done" && state.changed > 0) router.refresh();
  }, [state, formId, router]);

  const said = shown ? outcome(shown, noun) : null;
  const visible = count > 0 || isPending;

  return (
    <div className={visible ? "sticky bottom-13 z-2 mt-21" : "mt-21"}>
      {said && !isPending && (
        <div className={visible ? "mb-8" : ""}>
          <Notice title={said.title} tone={said.tone}>
            {said.text}
          </Notice>
        </div>
      )}

      <form id={formId} action={formAction} aria-label={`Change the selected ${noun[1]}`} hidden={!visible} className="gxc-card px-21 py-13">
        <input type="hidden" name="op" value={opKey} />
        <div className="grid gap-13 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <p className="text-sm font-semibold text-ink sm:col-span-2 lg:mr-8 lg:pb-8" aria-live="polite">
            <span className="num">{count}</span> selected
          </p>
          <div className="field lg:min-w-[11rem]">
            <label htmlFor={`${uid}-op`}>Change</label>
            <select
              id={`${uid}-op`}
              className="select"
              value={opKey}
              onChange={(e) => {
                setOpKey(e.target.value);
                setValue("");
                setSecond("");
              }}
            >
              <option value="">Choose what to change</option>
              {ops.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {op && (
            <div className="field lg:min-w-[11rem]">
              <label htmlFor={`${uid}-value`}>{op.valueLabel}</label>
              <select
                id={`${uid}-value`}
                name={op.field}
                className="select"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setSecond("");
                }}
              >
                <option value="">Choose one</option>
                {op.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {then && (
            <div className="field lg:min-w-[11rem]">
              <label htmlFor={`${uid}-second`}>{then.label}</label>
              <select id={`${uid}-second`} name={then.field} className="select" value={second} onChange={(e) => setSecond(e.target.value)}>
                <option value="">Choose one</option>
                {then.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-8 sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={!ready || isPending} aria-disabled={!ready || isPending}>
              {isPending ? "Applying…" : `Apply to ${count} ${count === 1 ? noun[0] : noun[1]}`}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={isPending}
              onClick={() => {
                for (const b of boxes(formId)) b.checked = false;
                document.dispatchEvent(new Event(CHANGED));
              }}
            >
              Clear selection
            </button>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-3">
          Each row is changed separately, as you, and recorded in the audit log like a change made on its own page. A row your role or the database does not allow is counted as refused.
          {count > BULK_MAX ? ` One request changes ${BULK_MAX} rows at most: clear some.` : ""}
        </p>
      </form>
    </div>
  );
}
