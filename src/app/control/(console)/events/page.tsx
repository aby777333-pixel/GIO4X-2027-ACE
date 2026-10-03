import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Event Bus", "/control/events");

const TITLE = "Event Bus";
const BASE = "/control/events";
const PER_PAGE = 50;
const PREVIEW = 160;
const STATES = ["waiting", "processed"] as const;

type EventRow = {
  id: string;
  topic: string;
  payload: unknown;
  actor_id: string | null;
  attempts: number | null;
  processed_at: string | null;
  created_at: string;
};

/** The payload on one line, cut at 160 characters. Text only: it is never rendered as markup. */
function preview(payload: unknown): string {
  if (payload === null || payload === undefined) return "–";
  let text: string;
  try {
    text = JSON.stringify(payload) ?? "";
  } catch {
    return "–";
  }
  if (!text) return "–";
  return text.length > PREVIEW ? `${text.slice(0, PREVIEW)}…` : text;
}

/**
 * The portal's outbox: each event it has recorded for its other parts to
 * act on, and whether that has been done. Reads only (events.read): an event
 * is not retried, replayed or removed from this screen. Every figure is a
 * count of the portal's rows.
 */
export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("events.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} />;
  const { db } = access;

  const params = await searchParams;
  const state = oneOf(firstParam(params.state), STATES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let eventsQuery = db.from("events_outbox").select("id, topic, payload, actor_id, attempts, processed_at, created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (state === "waiting") eventsQuery = eventsQuery.is("processed_at", null);
  if (state === "processed") eventsQuery = eventsQuery.not("processed_at", "is", null);

  const count = () => db.from("events_outbox").select("id", { count: "exact", head: true });
  const [events, waiting, processed, all, stuck] = await Promise.all([eventsQuery, count().is("processed_at", null), count().not("processed_at", "is", null), count(), count().is("processed_at", null).gte("attempts", 3)]);

  const failed = !!events.error || !!waiting.error || !!processed.error || !!all.error || !!stuck.error;
  const rows = (events.data ?? []) as EventRow[];
  const total = events.count ?? 0;
  const people = await portalPeople(
    db,
    rows.map((r) => r.actor_id),
  );
  const n = (r: { error: unknown; count: number | null }) => (r.error ? "–" : String(r.count ?? 0));

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (state) sp.set("state", state);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="The events the portal has recorded in its outbox, and whether each has been processed. Newest first." />
      <PortalSource>The payload is shown as its first {PREVIEW} characters.</PortalSource>
      {failed && <PortalReadFailed />}

      <Figures
        items={[
          { label: "Waiting", value: n(waiting), note: "Not yet processed" },
          { label: "Processed", value: n(processed) },
          { label: "Total events", value: n(all) },
          { label: "Waiting with 3 or more attempts", value: n(stuck) },
        ]}
      />

      <FilterTabs base={BASE} param="state" current={state} options={STATES} allLabel="All events" />

      <Section title="Events" aside={state ? label(state) : "Waiting and processed"}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : state ? "No events in this state" : "No events have been recorded"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[72rem] text-sm">
              <caption className="sr-only">Outbox events, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Created</th>
                  <th scope="col">Processed</th>
                  <th scope="col">Payload</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.topic}</td>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.actor_id ?? "")} id={row.actor_id} />
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{row.attempts ?? "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                    <td className="whitespace-nowrap text-ink-2">{row.processed_at ? <span className="num">{fmtDateTime(row.processed_at)}</span> : "Waiting"}</td>
                    <td className="max-w-[28rem]">
                      <span className="num block truncate text-xs text-ink-3">{preview(row.payload)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "event" : "events"} href={href} />
      </Section>
    </>
  );
}
