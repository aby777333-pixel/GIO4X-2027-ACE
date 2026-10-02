import Link from "next/link";
import { deleteView, pinView, renameView, saveView } from "@/app/control/actions-personal";
import { Notice } from "@/components/control/bits";
import { SubmitButton } from "@/components/control/SubmitButton";
import { describeView, sameViewParams, VIEW_LIMIT, VIEW_NAME_MAX, VIEW_OUTCOMES, VIEW_SCREENS, viewHref, type SavedView, type ViewParams, type ViewScreen } from "@/components/control/views-shared";

type Action = (formData: FormData) => Promise<void>;

/** The four writes. The real ones by default; a preview hands in its own. */
export type ViewActions = { save: Action; rename: Action; pin: Action; remove: Action };

/** What a list screen's page reads for this control (readViews() in src/lib/server/personal.ts). */
export type ViewsProps = {
  saved: SavedView[];
  /** the views could not be read: the screen itself is unaffected */
  failed: boolean;
  /** the fixed code a view action answered with, or "" */
  outcome: string;
  actions?: ViewActions;
};

function Pin() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.6 1.4 14.6 6.4l-1.1 1.1-.9-.2-2.3 2.3.3 2.7-1.1 1.1-2.8-2.8L3 14.3l-1.3.3.3-1.3 3.7-3.7-2.8-2.8L4 5.7l2.7.3L9 3.7l-.2-.9Z" />
    </svg>
  );
}

/** The filters the screen is showing, as hidden fields: the action validates them again and answers on that address. */
function Place({ screen, current }: { screen: ViewScreen; current: ViewParams }) {
  return (
    <>
      <input type="hidden" name="screen" value={screen} />
      {Object.entries(current).map(([key, value]) => (
        <input key={key} type="hidden" name={`f.${key}`} value={value} />
      ))}
    </>
  );
}

/**
 * "Views" on a list screen: the person's saved views for this screen as
 * links, "Save this view" for the filters now showing, and rename, pin and
 * delete. A view is this screen's own address with its filters: opening one
 * navigates there. Only the person who saved a view ever sees it.
 *
 * It works without script: the two panels are <details>, every change is a
 * form posted to a server action, and the outcome comes back as a fixed code.
 *
 * `current` is the filters the page validated, WITHOUT the search text: a
 * search box can hold a customer's e-mail address, so it is never saved, and
 * the control says so.
 */
export function ViewsControl({ screen, current, searching, saved, failed, outcome, actions }: ViewsProps & { screen: ViewScreen; current: ViewParams; /** something is typed in the screen's search box */ searching: boolean }) {
  const spec = VIEW_SCREENS[screen];
  const act: ViewActions = actions ?? { save: saveView, rename: renameView, pin: pinView, remove: deleteView };
  const said = VIEW_OUTCOMES[outcome];
  const heading = `${screen}-views`;
  const full = saved.length >= VIEW_LIMIT;

  return (
    <section aria-labelledby={heading} className="gxc-card mt-21 px-21 py-13" data-views={screen}>
      {said && (
        <div className="mb-13" data-views-outcome={outcome}>
          <Notice title={said.text} tone={said.tone} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-13 gap-y-8">
        <h2 id={heading} className="text-sm font-semibold text-ink">
          Views
        </h2>
        {failed ? (
          <p className="text-sm text-ink-2">Your saved views could not be read just now. The list below is not affected.</p>
        ) : saved.length ? (
          <ul className="flex min-w-0 flex-wrap gap-8" aria-label={`Your saved views for ${spec.label}`}>
            {saved.map((view) => {
              const showing = sameViewParams(screen, view.params, current) && !searching;
              return (
                <li key={view.id} className="min-w-0">
                  <Link href={viewHref(screen, view.params)} aria-current={showing ? "page" : undefined} title={describeView(screen, view.params)} className={`btn btn-sm max-w-full ${showing ? "btn-primary" : "btn-ghost"}`} data-view={view.id}>
                    {view.pinned && <Pin />}
                    <span className="truncate">{view.name}</span>
                    {view.pinned && <span className="sr-only"> (pinned to your dashboard)</span>}
                    {showing && <span className="sr-only"> (showing now)</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">You have no saved views for this screen yet.</p>
        )}
      </div>

      {!failed && (
        <div className="mt-8 grid gap-8">
          <details data-views-save>
            <summary className="link cursor-pointer text-sm">Save this view</summary>
            {full ? (
              <p className="mt-8 max-w-measure text-sm text-ink-2">
                You have {VIEW_LIMIT} saved views, which is the most one person can keep. Delete one to save another.
              </p>
            ) : (
              <form action={act.save} className="mt-13 grid gap-13 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Place screen={screen} current={current} />
                <div className="field">
                  <label htmlFor={`${heading}-name`}>Name for this view</label>
                  <input id={`${heading}-name`} name="name" type="text" className="input" required maxLength={VIEW_NAME_MAX} pattern="[^@]+" title="A name, without an @" autoComplete="off" placeholder="For example: Open complaints" />
                </div>
                <SubmitButton pending="Saving…">Save view</SubmitButton>
                <label className="check sm:col-span-2">
                  <input type="checkbox" name="pinned" value="1" />
                  <span>Pin it to my dashboard, with a live count</span>
                </label>
                <p className="max-w-measure text-xs text-ink-3 sm:col-span-2">
                  What is saved: <span className="font-semibold text-ink-2">{describeView(screen, current)}</span>. Search text is not saved with a view
                  {searching ? ", so what is in the search box now is left out" : ""}: it could be somebody’s e-mail address. Name a view after its filters, not after a person. Only you see your views.{" "}
                  <span className="num">
                    {saved.length} of {VIEW_LIMIT}
                  </span>{" "}
                  used.
                </p>
              </form>
            )}
          </details>

          {saved.length > 0 && (
            <details data-views-manage>
              <summary className="link cursor-pointer text-sm">Rename, pin or delete a view</summary>
              <ul className="mt-8">
                {saved.map((view) => (
                  <li key={view.id} className="grid gap-8 border-t border-line py-13 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" data-view-row={view.id}>
                    <form action={act.rename} className="flex min-w-0 items-end gap-8">
                      <Place screen={screen} current={current} />
                      <input type="hidden" name="id" value={view.id} />
                      <div className="field min-w-0 flex-1">
                        <label htmlFor={`${heading}-${view.id}`}>
                          Name<span className="sr-only"> of the view “{view.name}”</span>
                        </label>
                        <input id={`${heading}-${view.id}`} name="name" type="text" className="input" required maxLength={VIEW_NAME_MAX} pattern="[^@]+" title="A name, without an @" autoComplete="off" defaultValue={view.name} />
                      </div>
                      <SubmitButton pending="Saving…" className="btn btn-ghost">
                        Rename
                      </SubmitButton>
                    </form>
                    <div className="flex flex-wrap gap-8">
                      <form action={act.pin}>
                        <Place screen={screen} current={current} />
                        <input type="hidden" name="id" value={view.id} />
                        <input type="hidden" name="pinned" value={view.pinned ? "0" : "1"} />
                        <SubmitButton pending="Saving…" className="btn btn-ghost">
                          {view.pinned ? "Unpin" : "Pin to dashboard"}
                          <span className="sr-only">: {view.name}</span>
                        </SubmitButton>
                      </form>
                      <form action={act.remove}>
                        <Place screen={screen} current={current} />
                        <input type="hidden" name="id" value={view.id} />
                        <SubmitButton pending="Deleting…" className="btn btn-ghost">
                          Delete
                          <span className="sr-only">: {view.name}</span>
                        </SubmitButton>
                      </form>
                    </div>
                    <p className="text-xs text-ink-3 md:col-span-2">
                      {view.pinned ? "Pinned to your dashboard. " : ""}
                      {describeView(screen, view.params)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
