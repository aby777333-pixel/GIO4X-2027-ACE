/**
 * What the bulk bar and its server actions (src/app/control/actions-bulk.ts)
 * share. Plain data, safe on both sides.
 */

/** The most rows one bulk request may name. A list page shows 25. */
export const BULK_MAX = 50;

/**
 * done         every ticked row was attempted: `changed` were updated, `refused` were not
 * none         nothing was ticked
 * too-many     more than BULK_MAX rows
 * invalid      the action, its value or an id is not on the allow-list; nothing was sent
 * reason       a stage of "lost" without a reason; nothing was sent
 * forbidden    the caller's role does not allow it; nothing was sent
 * signed-out   no session
 * unavailable  the database could not be reached to establish the caller
 */
export type BulkState = { code: "done"; changed: number; refused: number } | { code: "none" | "too-many" | "invalid" | "reason" | "forbidden" | "signed-out" | "unavailable" };

/** One thing the bar can do: the value it needs and, for one value, a second choice. */
export type BulkOp = {
  /** sent as `op` */
  key: string;
  label: string;
  /** the form field the chosen value is sent as */
  field: string;
  valueLabel: string;
  options: readonly { value: string; label: string }[];
  /** asked only when the value is `when` (a lost enquiry needs a reason) */
  then?: { when: string; field: string; label: string; options: readonly { value: string; label: string }[] };
};
