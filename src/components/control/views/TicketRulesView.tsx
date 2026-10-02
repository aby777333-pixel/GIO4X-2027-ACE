import Link from "next/link";
import { moveRule, saveRule, setRuleActive } from "@/app/control/actions-ticket-tools";
import { ControlHead, Empty, Notice } from "@/components/control/bits";
import { fmtDateTime } from "@/components/control/format";
import { SubmitButton } from "@/components/control/SubmitButton";
import { RULE_NAME_MAX } from "@/components/control/ticket-tools";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL } from "@/lib/server/constants";
import type { TicketRuleRow } from "@/lib/supabase/types";

export type TicketRulesViewProps = {
  /** in the order they are tried */
  rules: TicketRuleRow[];
  failed: boolean;
  /** who a rule may name right now: active staff whose role works tickets (ticket_assignees()) */
  assignees: { user_id: string; display_name: string }[];
  assigneesFailed: boolean;
  /** the rule being changed, or null for "add a new one" */
  editing: TicketRuleRow | null;
  names: Map<string, string>;
  me: string;
  notice?: string;
  error?: string;
};

/**
 * Presentation only: the assignment rules in the order they are tried, and one
 * form that adds a rule or changes the one chosen with "Edit". The page has
 * already checked tickets.manage; the actions check it again and the database
 * decides (and is the only thing that ever applies a rule).
 */
export function TicketRulesView({ rules, failed, assignees, assigneesFailed, editing, names, me, notice, error }: TicketRulesViewProps) {
  const who = (userId: string | null) => (!userId ? "the database" : userId === me ? "you" : (names.get(userId) ?? "a former member of staff"));
  const person = (userId: string) => (userId === me ? `${names.get(userId) ?? "You"} (you)` : (names.get(userId) ?? "a former member of staff"));
  const canTake = new Set(assignees.map((a) => a.user_id));
  // the person a rule already names stays selectable while it is edited, even if they can no longer take tickets
  const editingGone = !!editing?.assign_to && !canTake.has(editing.assign_to);

  return (
    <>
      <p className="text-xs text-ink-3">
        <Link href="/control/tickets" className="link-quiet">
          Tickets
        </Link>
        <span aria-hidden className="mx-8 inline-block h-px w-8 bg-line-strong align-middle" />
        <span className="text-ink-2">Assignment rules</span>
      </p>

      <div className="mt-13">
        <ControlHead
          title="Assignment rules"
          lead="What happens to a ticket at the moment it arrives from the website: who gets it, and whether its priority changes."
          actions={
            <Link href="/control/tickets/macros" className="btn btn-ghost">
              Canned replies
            </Link>
          }
        />
      </div>

      <div className="mt-21 grid gap-13">
        {notice && !error && <Notice title={notice} tone="ok" />}
        {error && <Notice title={error} tone="error" />}
        <Notice title="How the rules are applied">
          Once, when a ticket arrives, from the top of the list down: the first rule that is on and matches is applied and the rest are not looked at. A rule that names someone who cannot be given tickets at that moment (switched off, or in
          a role that does not work tickets) is skipped and the next one is tried. If no rule applies, the ticket arrives unassigned as before. Rules never touch tickets already in the queue, and a rule can never stop a customer’s ticket
          from being accepted.
        </Notice>
      </div>

      <div className="mt-21 grid gap-21 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="rules-list" className="min-w-0">
          <h2 id="rules-list" className="h4">
            Rules, in the order they are tried
          </h2>

          {failed ? (
            <div className="mt-13">
              <Notice title="The rules could not be read" tone="error">
                The database did not answer. Reload the page; if this continues, check that migration 0013 has been applied.
              </Notice>
            </div>
          ) : rules.length ? (
            <ol className="mt-13 grid gap-13">
              {rules.map((rule, index) => {
                const doesNothing = !rule.assign_to && !rule.set_priority;
                // only said when the list of people could be read: an unread list proves nothing
                const cannotTake = !!rule.assign_to && !assigneesFailed && !canTake.has(rule.assign_to);
                return (
                  <li key={rule.id} className={`gxc-card min-w-0 px-21 py-13 ${rule.active ? "" : "opacity-80"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-x-13 gap-y-5">
                      <h3 className="min-w-0 break-words text-sm font-semibold text-ink">
                        <span className="num mr-8 text-ink-3">{index + 1}.</span>
                        {rule.name}
                      </h3>
                      <span className={`state whitespace-nowrap ${rule.active ? "state-open" : "state-off"}`}>{rule.active ? "On" : "Off"}</span>
                    </div>

                    <dl className="mt-8 grid gap-3 text-sm">
                      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-8">
                        <dt className="text-ink-3">When</dt>
                        <dd className="min-w-0 break-words text-ink">
                          {rule.when_category || rule.when_priority ? (
                            <>
                              {rule.when_category && <>the category is {TICKET_CATEGORY_LABEL[rule.when_category]}</>}
                              {rule.when_category && rule.when_priority && " and "}
                              {rule.when_priority && <>the priority is {TICKET_PRIORITY_LABEL[rule.when_priority]}</>}
                            </>
                          ) : (
                            "any ticket arrives"
                          )}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-8">
                        <dt className="text-ink-3">Then</dt>
                        <dd className="min-w-0 break-words text-ink">
                          {doesNothing ? (
                            "nothing"
                          ) : (
                            <>
                              {rule.assign_to && <>assign it to {person(rule.assign_to)}</>}
                              {rule.assign_to && rule.set_priority && " and "}
                              {rule.set_priority && <>set its priority to {TICKET_PRIORITY_LABEL[rule.set_priority]}</>}
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>

                    {rule.active && cannotTake && (
                      <p className="mt-8 text-xs font-semibold text-warn">Skipped at the moment: the person it names cannot be given tickets (switched off, or their role no longer works tickets). Edit the rule, or it stays skipped.</p>
                    )}
                    {rule.active && doesNothing && <p className="mt-8 text-xs font-semibold text-warn">Skipped: the person it named is no longer on staff and it sets no priority. Edit the rule or switch it off.</p>}

                    <div className="mt-13 flex flex-wrap items-center justify-between gap-x-13 gap-y-8 border-t border-line pt-8">
                      <p className="text-xs text-ink-3">
                        Last changed <span className="num">{fmtDateTime(rule.updated_at)}</span> by {who(rule.updated_by ?? rule.created_by)}
                      </p>
                      <div className="flex flex-wrap items-center gap-8">
                        {index > 0 && (
                          <form action={moveRule}>
                            <input type="hidden" name="id" value={rule.id} />
                            <input type="hidden" name="dir" value="up" />
                            <SubmitButton pending="Moving…" className="btn btn-ghost btn-sm">
                              Move up<span className="sr-only">: {rule.name}</span>
                            </SubmitButton>
                          </form>
                        )}
                        {index < rules.length - 1 && (
                          <form action={moveRule}>
                            <input type="hidden" name="id" value={rule.id} />
                            <input type="hidden" name="dir" value="down" />
                            <SubmitButton pending="Moving…" className="btn btn-ghost btn-sm">
                              Move down<span className="sr-only">: {rule.name}</span>
                            </SubmitButton>
                          </form>
                        )}
                        <Link href={`/control/tickets/rules?edit=${rule.id}#editor`} className="btn btn-ghost btn-sm">
                          Edit<span className="sr-only">: {rule.name}</span>
                        </Link>
                        <form action={setRuleActive}>
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="active" value={rule.active ? "0" : "1"} />
                          <SubmitButton pending="Saving…" className="btn btn-quiet btn-sm">
                            {rule.active ? "Switch off" : "Switch on"}
                            <span className="sr-only">: {rule.name}</span>
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Empty title="No rules yet">
              <p>Every ticket arrives unassigned, at Normal priority (High when it is a complaint), and waits in the queue for someone to take it. Add a rule with the form on this page to change that for new tickets.</p>
            </Empty>
          )}
          {!failed && rules.length > 0 && (
            <p className="mt-13 max-w-measure text-xs text-ink-3">
              A rule that is switched off is kept, in its place, and can be switched on again: nothing is deleted. When a rule is applied, the ticket’s history says which one. Creating, editing, moving and switching rules are recorded in
              the audit log.
            </p>
          )}
        </section>

        <section id="editor" aria-labelledby="rule-editor" className="gxc-card min-w-0 scroll-mt-34">
          <div className="gxc-card-head">
            <h2 id="rule-editor" className="gxc-card-title">
              {editing ? "Edit rule" : "Add a rule"}
            </h2>
            {editing && (
              <Link href="/control/tickets/rules" className="gxc-card-link">
                Add a new one instead
              </Link>
            )}
          </div>
          {/* keyed, so that choosing another rule to edit refills the fields */}
          <form key={editing?.id ?? "new"} action={saveRule} className="gxc-card-body grid gap-13">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="field">
              <label htmlFor="rule-name">Name</label>
              <input id="rule-name" name="name" type="text" className="input" defaultValue={editing?.name ?? ""} maxLength={RULE_NAME_MAX} required autoComplete="off" aria-describedby="rule-name-hint" />
              <p id="rule-name-hint" className="field-hint">
                For staff: it is shown in this list and in a ticket’s history when the rule is applied. Up to {RULE_NAME_MAX} characters.
              </p>
            </div>

            <fieldset className="grid gap-13 border-t border-line pt-13">
              <legend className="field-label">When a ticket arrives and</legend>
              <div className="field">
                <label htmlFor="rule-when-category">its category is</label>
                <select id="rule-when-category" name="when_category" className="select" defaultValue={editing?.when_category ?? ""}>
                  <option value="">Any category</option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {TICKET_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="rule-when-priority">and its priority is</label>
                <select id="rule-when-priority" name="when_priority" className="select" defaultValue={editing?.when_priority ?? ""} aria-describedby="rule-when-priority-hint">
                  <option value="">Any priority</option>
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                <p id="rule-when-priority-hint" className="field-hint">
                  A ticket arrives as {TICKET_PRIORITY_LABEL.normal}, or as {TICKET_PRIORITY_LABEL.high} when it is a complaint. No ticket arrives as {TICKET_PRIORITY_LABEL.low} or {TICKET_PRIORITY_LABEL.urgent}.
                </p>
              </div>
            </fieldset>

            <fieldset className="grid gap-13 border-t border-line pt-13">
              <legend className="field-label">Then (choose at least one)</legend>
              <div className="field">
                <label htmlFor="rule-assign">assign it to</label>
                <select id="rule-assign" name="assign_to" className="select" defaultValue={editing?.assign_to ?? ""} aria-describedby="rule-assign-hint">
                  <option value="">Nobody: leave it unassigned</option>
                  {editingGone && editing?.assign_to && <option value={editing.assign_to}>{person(editing.assign_to)} (cannot be given tickets now)</option>}
                  {assignees.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.display_name}
                      {a.user_id === me ? " (you)" : ""}
                    </option>
                  ))}
                </select>
                <p id="rule-assign-hint" className="field-hint">
                  {assigneesFailed
                    ? "The list of people could not be read just now. Reload the page before choosing someone."
                    : "Active members of staff whose role works tickets. If that stops being true of the person chosen, the rule is skipped until it is edited."}
                </p>
              </div>
              <div className="field">
                <label htmlFor="rule-set-priority">and set its priority to</label>
                <select id="rule-set-priority" name="set_priority" className="select" defaultValue={editing?.set_priority ?? ""}>
                  <option value="">Leave the priority as it arrives</option>
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-8">
              <SubmitButton pending="Saving…">{editing ? "Save changes" : "Add rule"}</SubmitButton>
              {editing && (
                <Link href="/control/tickets/rules" className="btn btn-quiet">
                  Cancel
                </Link>
              )}
            </div>
            <p className="text-xs text-ink-3">{editing ? "Saving keeps the rule where it is in the order." : "A new rule goes to the end of the list and is on. Move it up if it should be tried earlier."}</p>
          </form>
        </section>
      </div>
    </>
  );
}
