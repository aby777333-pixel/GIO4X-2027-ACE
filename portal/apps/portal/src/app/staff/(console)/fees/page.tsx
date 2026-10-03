import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, StatTile } from "@gio4x/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCurrentUser } from "@/lib/session";
import { loadFeeSchedules, loadFeeCharges } from "@/lib/fee-actions";
import {
  FEE_TYPE_LABEL,
  CALC_METHOD_LABEL,
  FEE_CHARGE_STATUS_LABEL,
  chargeStatusTone,
  formatMoney,
  type FeeType,
  type FeeCalcMethod,
  type FeeChargeStatus,
} from "@/lib/fee-constants";
import {
  FeeSimulator,
  ChargeFeeButton,
  NewScheduleButton,
  NewRuleButton,
  RuleActiveToggle,
} from "./fee-tools";
import { BookOpen, Layers, Receipt, Percent } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StaffFeesPage() {
  const [user, schedules, charges] = await Promise.all([
    getCurrentUser(),
    loadFeeSchedules(),
    loadFeeCharges(40),
  ]);
  const isAdmin = user?.profile?.role === "admin";

  const ruleCount = schedules.reduce((n, s) => n + s.rules.length, 0);
  const activeSchedules = schedules.filter((s) => s.active).length;
  const appliedCharges = charges.filter((c) => c.status === "applied").length;

  const scheduleOptions = schedules.map((s) => ({
    id: s.id,
    label: `${s.code} v${s.version} — ${s.name}`,
  }));

  const tiles = [
    { label: "Schedules", value: `${activeSchedules}/${schedules.length}`, icon: <Layers size={16} /> },
    { label: "Rules", value: String(ruleCount), icon: <Percent size={16} /> },
    { label: "Charges (recent)", value: String(charges.length), icon: <Receipt size={16} /> },
    { label: "Applied", value: String(appliedCharges), icon: <BookOpen size={16} /> },
  ];

  return (
    <>
      <PageHeader
        title="Fee Engine"
        subtitle="Centralized, versioned pricing for deposits, withdrawals, trading, swaps, rebates and more."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/staff/ledger"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-steel transition hover:border-sky/30 hover:text-navy"
            >
              <BookOpen size={16} /> Ledger
            </Link>
            <ChargeFeeButton />
            {isAdmin ? <NewRuleButton schedules={scheduleOptions} /> : null}
            {isAdmin ? <NewScheduleButton /> : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} icon={t.icon} label={t.label} value={t.value} />
        ))}
      </div>

      {/* Simulator */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fee simulator</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-xs text-steel">
            Resolve the live schedule for a hypothetical context — exactly what the engine would charge.
            No money moves.
          </p>
          <FeeSimulator />
        </CardBody>
      </Card>

      {/* Schedules + rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Schedules &amp; rules</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {schedules.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">No fee schedules yet.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy">{s.name}</span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-steel">
                        {s.code} v{s.version}
                      </span>
                      <StatusBadge tone={s.active ? "success" : "neutral"}>
                        {s.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-steel-light">
                      <span>precedence {s.precedence}</span>
                      <span>·</span>
                      <span>
                        scope:{" "}
                        {Object.keys((s.scope as Record<string, unknown>) ?? {}).length === 0
                          ? "global"
                          : JSON.stringify(s.scope)}
                      </span>
                    </div>
                  </div>
                </div>

                {s.rules.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-steel-light">No rules in this schedule.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {s.rules.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-navy">
                            {FEE_TYPE_LABEL[r.fee_type as FeeType]}
                          </span>
                          {r.is_rebate ? (
                            <StatusBadge tone="info">rebate</StatusBadge>
                          ) : null}
                          <span className="text-steel">
                            {CALC_METHOD_LABEL[r.calc_method as FeeCalcMethod]}
                          </span>
                          <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-steel">
                            rate {r.rate} {r.currency}
                          </span>
                          {r.min_amount != null ? (
                            <span className="text-[11px] text-steel-light">min {r.min_amount}</span>
                          ) : null}
                          {r.max_amount != null ? (
                            <span className="text-[11px] text-steel-light">max {r.max_amount}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-steel-light">priority {r.priority}</span>
                          {isAdmin ? (
                            <RuleActiveToggle ruleId={r.id} active={r.active} />
                          ) : (
                            <StatusBadge tone={r.active ? "success" : "neutral"}>
                              {r.active ? "Active" : "Off"}
                            </StatusBadge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Recent charges */}
      <Card>
        <CardHeader>
          <CardTitle>Recent charges</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {charges.length === 0 ? (
            <p className="py-6 text-center text-sm text-steel">No fee charges recorded yet.</p>
          ) : (
            charges.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-navy">{FEE_TYPE_LABEL[c.fee_type as FeeType]}</span>
                    <span className="font-semibold text-navy">
                      {formatMoney(c.computed_amount, c.currency)}
                    </span>
                  </div>
                  <div className="text-[11px] text-steel-light">
                    {new Date(c.created_at).toLocaleString()} · {c.source_type ?? "fee"}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </div>
                </div>
                <StatusBadge tone={chargeStatusTone(c.status as FeeChargeStatus)}>
                  {FEE_CHARGE_STATUS_LABEL[c.status as FeeChargeStatus]}
                </StatusBadge>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
