import { ControlHead, Empty, NoAccess, Pager } from "@/components/control/bits";
import { controlMeta, firstParam, fmtDateTime } from "@/components/control/format";
import { Figures, FilterTabs, Person, PortalReadFailed, PortalSource, PortalUnconfigured, Section, StateBadge, fmtMoney, fmtNum, label } from "@/components/control/portal/kit";
import { oneOf, pageRange, portalPeople, requirePortal } from "@/lib/server/portal-db";

export const dynamic = "force-dynamic";
export const metadata = controlMeta("Fee Engine", "/control/fees");

const TITLE = "Fee Engine";
const BASE = "/control/fees";
const PER_PAGE = 50;
const CONFIG_LIMIT = 200;
const CHARGE_STATUSES = ["pending", "applied", "waived", "reversed"] as const;

type ScheduleRow = {
  id: string;
  code: string;
  name: string | null;
  version: number | null;
  active: boolean | null;
  effective_from: string | null;
  effective_to: string | null;
};

type RuleRow = {
  id: string;
  schedule_id: string;
  fee_type: string;
  calc_method: string;
  rate: number | string | null;
  min_amount: number | string | null;
  max_amount: number | string | null;
  currency: string | null;
  is_rebate: boolean | null;
  priority: number | null;
  active: boolean | null;
};

type ChargeRow = {
  id: string;
  fee_type: string;
  user_id: string | null;
  base_amount: number | string | null;
  lots: number | string | null;
  computed_amount: number | string | null;
  currency: string | null;
  status: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
};

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? "–" : value ? "Yes" : "No");

/** The rate as the portal stored it; what it is a rate of depends on the method beside it. */
function rate(row: RuleRow): string {
  if (row.rate === null || row.rate === undefined || row.rate === "") return "–";
  return row.calc_method === "percentage" ? `${fmtNum(row.rate)} %` : fmtNum(row.rate);
}

/**
 * The portal's fee engine: the schedules in force, the rules inside them, and
 * the charges those rules produced. Reads only (funds.read): a schedule is not
 * edited and a charge is not waived or reversed from this screen. Every figure
 * is a count of the portal's rows; no amounts are added up here.
 */
export default async function FeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePortal("funds.read");
  if (access.state === "none") return null;
  if (access.state === "forbidden") return <NoAccess title={TITLE} />;
  if (access.state === "unconfigured") return <PortalUnconfigured title={TITLE} missing={access.missing} />;
  const { db } = access;

  const params = await searchParams;
  const status = oneOf(firstParam(params.status), CHARGE_STATUSES, "");
  const { page, from, to } = pageRange(firstParam(params.page), PER_PAGE);

  let chargesQuery = db
    .from("fee_charges")
    .select("id, fee_type, user_id, base_amount, lots, computed_amount, currency, status, source_type, source_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) chargesQuery = chargesQuery.eq("status", status);

  const [charges, schedules, rules, ...byStatus] = await Promise.all([
    chargesQuery,
    db
      .from("fee_schedules")
      .select("id, code, name, version, active, effective_from, effective_to", { count: "exact" })
      .order("precedence", { ascending: true })
      .order("code", { ascending: true })
      .order("version", { ascending: false })
      .limit(CONFIG_LIMIT),
    db
      .from("fee_rules")
      .select("id, schedule_id, fee_type, calc_method, rate, min_amount, max_amount, currency, is_rebate, priority, active", { count: "exact" })
      .order("priority", { ascending: true })
      .limit(CONFIG_LIMIT),
    ...CHARGE_STATUSES.map((s) => db.from("fee_charges").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);

  const failed = !!charges.error || !!schedules.error || !!rules.error || byStatus.some((r) => r.error);
  const rows = (charges.data ?? []) as ChargeRow[];
  const total = charges.count ?? 0;
  const scheduleRows = (schedules.data ?? []) as ScheduleRow[];
  const scheduleTotal = schedules.count ?? scheduleRows.length;
  const ruleRows = (rules.data ?? []) as RuleRow[];
  const ruleTotal = rules.count ?? ruleRows.length;
  const scheduleCode = new Map(scheduleRows.map((s) => [s.id, s.code]));
  const people = await portalPeople(db, rows.map((r) => r.user_id));

  const shown = (have: number, all: number, one: string, many: string) => (have < all ? `First ${have} of ${all}` : `${all} ${all === 1 ? one : many}`);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <>
      <ControlHead title={TITLE} lead="The portal’s fee schedules, the rules inside them, and the charges they produced. Newest charge first." />
      <PortalSource>Schedules and rules are set in the portal’s own staff console.</PortalSource>
      {failed && <PortalReadFailed />}

      <Figures items={CHARGE_STATUSES.map((s, i) => ({ label: `Charges ${label(s).toLowerCase()}`, value: byStatus[i]?.error ? "–" : String(byStatus[i]?.count ?? 0) }))} />

      <Section title="Fee schedules" aside={schedules.error ? undefined : shown(scheduleRows.length, scheduleTotal, "schedule", "schedules")}>
        {scheduleRows.length === 0 ? (
          <Empty title={schedules.error ? "Nothing could be read" : "No fee schedules have been set up"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[48rem] text-sm">
              <caption className="sr-only">Fee schedules, in order of precedence</caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Version</th>
                  <th scope="col">Active</th>
                  <th scope="col">Effective from</th>
                  <th scope="col">Effective to</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{row.code}</td>
                    <td className="max-w-[18rem] text-ink-2">{row.name || "–"}</td>
                    <td className="num text-ink-2">{row.version ?? "–"}</td>
                    <td className="text-ink-2">{yesNo(row.active)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.effective_from ? fmtDateTime(row.effective_from) : "–"}</td>
                    <td className="num whitespace-nowrap text-ink-2">{row.effective_to ? fmtDateTime(row.effective_to) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Fee rules" aside={rules.error ? undefined : shown(ruleRows.length, ruleTotal, "rule", "rules")}>
        {ruleRows.length === 0 ? (
          <Empty title={rules.error ? "Nothing could be read" : "No fee rules have been set up"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Fee rules, in order of priority</caption>
              <thead>
                <tr>
                  <th scope="col">Schedule</th>
                  <th scope="col">Fee type</th>
                  <th scope="col">Method</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Minimum</th>
                  <th scope="col">Maximum</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Rebate</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {ruleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="num whitespace-nowrap text-ink">{scheduleCode.get(row.schedule_id) ?? `${row.schedule_id.slice(0, 8)}…`}</td>
                    <td className="whitespace-nowrap text-ink">{label(row.fee_type)}</td>
                    <td className="whitespace-nowrap text-ink-2">{label(row.calc_method)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{rate(row)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.min_amount)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.max_amount)}</td>
                    <td className="num text-ink-2">{row.currency || "–"}</td>
                    <td className="text-ink-2">{yesNo(row.is_rebate)}</td>
                    <td className="num text-ink-2">{row.priority ?? "–"}</td>
                    <td className="text-ink-2">{yesNo(row.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <FilterTabs base={BASE} param="status" current={status} options={CHARGE_STATUSES} allLabel="All charges" />

      <Section title="Fee charges" aside={status ? label(status) : "All statuses"}>
        {rows.length === 0 ? (
          <Empty title={failed ? "Nothing could be read" : status ? "No charges with this status" : "No fees have been charged"} />
        ) : (
          <div className="scroll-x">
            <table className="table-gx min-w-[64rem] text-sm">
              <caption className="sr-only">Fee charges, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Fee type</th>
                  <th scope="col">Base amount</th>
                  <th scope="col">Lots</th>
                  <th scope="col">Charged</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[16rem]">
                      <Person person={people.get(row.user_id ?? "")} id={row.user_id} />
                    </td>
                    <td className="whitespace-nowrap text-ink">{label(row.fee_type)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtMoney(row.base_amount)}</td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtNum(row.lots)}</td>
                    <td className="num whitespace-nowrap text-ink">{fmtMoney(row.computed_amount, row.currency)}</td>
                    <td>
                      <StateBadge value={row.status} />
                    </td>
                    <td className="max-w-[14rem] text-ink-2">
                      <span className="block truncate">{label(row.source_type)}</span>
                      {row.source_id && <span className="num block truncate text-xs text-ink-3">{row.source_id}</span>}
                    </td>
                    <td className="num whitespace-nowrap text-ink-2">{fmtDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageCount={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun={total === 1 ? "charge" : "charges"} href={href} />
      </Section>
    </>
  );
}
