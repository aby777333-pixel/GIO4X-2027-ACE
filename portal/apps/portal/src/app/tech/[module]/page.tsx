import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadTechModule, loadTechConsole, getSuperAdmin, loadBridges, loadApiKeys, loadSecurityRules, loadFlags, loadRegistry, loadSignals, loadJobs, loadAuditRows, loadCapabilities, loadApiUsage, loadSurveillance } from "@/lib/tech-hub-console";
import { CapabilityManager } from "@/components/tech/CapabilityManager";
import { ApiUsagePanel } from "@/components/tech/ApiUsagePanel";
import { SurveillancePanel } from "@/components/tech/SurveillancePanel";
import { AuditConsole } from "@/components/tech/AuditConsole";
import { loadTechHub, loadExecDashboard, loadRisk } from "@/lib/tech-hub-data";
import { AnalyticsPanel } from "@/components/tech/AnalyticsPanel";
import { RiskPanel } from "@/components/tech/RiskPanel";
import { ModuleToggle } from "@/components/tech/ModuleToggle";
import { SuperAdminToggle } from "@/components/tech/SuperAdminToggle";
import { BridgeManager } from "@/components/tech/BridgeManager";
import { loadSymbols } from "@/lib/tech-symbols";
import { SymbolManager } from "@/components/tech/SymbolManager";
import { loadPricingOverview, loadPricingConfig, loadPricingRules, loadCommissionSwap, loadLpPricing, loadRevenue, loadPricingAudit, loadEmergency } from "@/lib/pricing-terminal";
import { PricingPreview } from "@/components/tech/PricingPreview";
import { SpreadManager } from "@/components/tech/SpreadManager";
import { MarkupManager } from "@/components/tech/MarkupManager";
import { SmartRulesManager } from "@/components/tech/SmartRulesManager";
import { CommissionSwapManager } from "@/components/tech/CommissionSwapManager";
import { LpMarkupManager } from "@/components/tech/LpMarkupManager";
import { RevenueMonitor } from "@/components/tech/RevenueMonitor";
import { PricingAnalytics } from "@/components/tech/PricingAnalytics";
import { EmergencyPanel } from "@/components/tech/EmergencyPanel";
import { PricingAuditTimeline } from "@/components/tech/PricingAuditTimeline";
import { ApiKeyManager } from "@/components/tech/ApiKeyManager";
import { SecurityManager } from "@/components/tech/SecurityManager";
import { FlagManager } from "@/components/tech/FlagManager";
import { LiquidityManager } from "@/components/tech/LiquidityManager";
import { ReportingPanel } from "@/components/tech/ReportingPanel";
import { RegistryManager, type ConfigField } from "@/components/tech/RegistryManager";
import { SignalsPanel } from "@/components/tech/SignalsPanel";
import { AutomationPanel } from "@/components/tech/AutomationPanel";
import { loadDealerOverview, loadBookConfigs } from "@/lib/dealer-cockpit";
import { DealerCockpit } from "@/components/tech/DealerCockpit";

// Registry-backed modules: which kind + how to present it.
const REGISTRY_MODULES: Record<string, { kind: string; title: string; addLabel: string; fields: ConfigField[] }> = {
  infra: { kind: "infra", title: "Infrastructure Inventory", addLabel: "Add node", fields: [{ key: "type", label: "Type" }, { key: "host", label: "Host" }, { key: "provider", label: "Provider" }] },
  broker_ops: { kind: "broker", title: "Brokers / White-Label Brands", addLabel: "Add broker", fields: [{ key: "brand", label: "Brand" }, { key: "domain", label: "Domain" }] },
  devtools: { kind: "env", title: "Environment Variables & Build Config", addLabel: "Add variable", fields: [{ key: "value", label: "Value" }, { key: "scope", label: "Scope" }] },
  marketplace: { kind: "extension", title: "Extensions & Plugins", addLabel: "Add extension", fields: [{ key: "version", label: "Version" }] },
};
const SPREAD_PROFILE_FIELDS: ConfigField[] = [
  { key: "markup_bps", label: "Markup (bps)", type: "number" },
  { key: "commission_per_lot", label: "Commission/lot", type: "number" },
  { key: "segment", label: "Segment" },
];

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-300",
  beta: "bg-amber-500/15 text-amber-300",
  roadmap: "bg-slate-500/15 text-slate-300",
};

export default async function ModulePage({ params }: { params: { module: string } }) {
  const m = await loadTechModule(params.module);
  if (!m) {
    return (
      <div className="tech-panel rounded-xl p-8 text-sm tech-muted">
        Unknown module. <Link href="/tech" className="tech-accent underline">Back to Command Center</Link>
      </div>
    );
  }

  // Module-specific live data. Spreads reuses the trading + liquidity controls.
  const liquidity = ["liquidity", "spreads"].includes(m.key) ? await loadTechHub() : null;
  const bridges = m.key === "bridges" ? await loadBridges() : null;
  const symbols = ["trading", "spreads"].includes(m.key) ? await loadSymbols() : null;
  const apiKeys = m.key === "api" ? await loadApiKeys() : null;
  const apiUsage = m.key === "api" ? await loadApiUsage() : null;
  const secRules = m.key === "security" ? await loadSecurityRules() : null;
  const flags = m.key === "platform" ? await loadFlags() : null;
  const reg = REGISTRY_MODULES[m.key] ?? null;
  const registry = reg ? await loadRegistry(reg.kind) : null;
  const spreadProfiles = m.key === "spreads" ? await loadRegistry("spread_profile") : null;
  const pricingOv = m.key === "spreads" ? await loadPricingOverview() : null;
  const pricingCfg = m.key === "spreads" ? await loadPricingConfig() : null;
  const pricingRules = m.key === "spreads" ? await loadPricingRules() : null;
  const commSwap = m.key === "spreads" ? await loadCommissionSwap() : null;
  const lpPricing = m.key === "spreads" ? await loadLpPricing() : null;
  const revenue = m.key === "spreads" ? await loadRevenue() : null;
  const pricingAudit = m.key === "spreads" ? await loadPricingAudit() : null;
  const emergency = m.key === "spreads" ? await loadEmergency() : null;
  const signals = m.key === "signals" ? await loadSignals() : null;
  const jobs = m.key === "automation" ? await loadJobs() : null;
  const surveillance = m.key === "automation" ? await loadSurveillance() : null;
  const dealerOv = m.key === "dealer" ? await loadDealerOverview() : null;
  const dealerConfigs = m.key === "dealer" ? await loadBookConfigs() : [];
  const consoleData = ["monitoring", "database", "access", "security"].includes(m.key) ? await loadTechConsole() : null;
  const capabilities = await loadCapabilities(m.key);
  const auditRows = m.key === "security" ? await loadAuditRows() : null;
  const reportExec = m.key === "reporting" ? await loadExecDashboard() : null;
  const risk = m.key === "monitoring" ? await loadRisk() : null;
  const { user } = await getSuperAdmin();

  return (
    <div className="space-y-6">
      <Link href="/tech" className="inline-flex items-center gap-1.5 text-xs tech-muted hover:tech-accent">
        <ArrowLeft size={14} /> Command Center
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{m.name}</h1>
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[m.status] ?? ""}`}>{m.status}</span>
          </div>
          <p className="mt-1 text-sm tech-muted">{m.description}</p>
        </div>
        <div className="flex items-center gap-2 tech-panel rounded-lg px-3 py-2 text-xs">
          <span className="tech-muted">Module</span>
          <ModuleToggle moduleKey={m.key} enabled={m.enabled} />
          <span className={m.enabled ? "text-emerald-400" : "tech-muted"}>{m.enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      {/* Capabilities — every aspect editable (enable/disable + JSON settings), persisted + audited */}
      <CapabilityManager moduleKey={m.key} features={m.features} states={capabilities} />

      {/* Bridge registry — build/manage any bridge */}
      {bridges && <BridgeManager bridges={bridges} />}

      {/* Symbol & spread management — live to the trading engine */}
      {symbols && <SymbolManager symbols={symbols} />}

      {/* Spread & commission profiles (segments) — Spread & Markup module */}
      {spreadProfiles && <RegistryManager items={spreadProfiles} kind="spread_profile" title="Spread &amp; Commission Profiles" addLabel="Add profile" fields={SPREAD_PROFILE_FIELDS} />}

      {/* PRICING-CORE — price-formation engine (internal only). Live preview + spread + markup stack. */}
      {pricingOv && (
        <>
          <PricingPreview />
          <SpreadManager configs={pricingCfg?.spreadConfig ?? []} />
          <MarkupManager layers={pricingCfg?.markupLayers ?? []} engine={pricingCfg?.engine} />
          <SmartRulesManager smart={pricingRules?.smart ?? []} dynamic={pricingRules?.dynamic ?? []} />
          <CommissionSwapManager commission={commSwap?.commission ?? []} swap={commSwap?.swap ?? []} />
          <LpMarkupManager lps={lpPricing?.lps ?? []} markup={lpPricing?.markup ?? []} routing={lpPricing?.routing ?? []} />
          {revenue && <RevenueMonitor data={revenue} />}
          <PricingAnalytics />
          <EmergencyPanel recent={emergency ?? []} />
          {pricingAudit && <PricingAuditTimeline rows={pricingAudit} />}
        </>
      )}

      {/* API / Platform / Security / Reporting modules */}
      {apiKeys && <ApiKeyManager keys={apiKeys} />}
      {apiUsage && <ApiUsagePanel usage={apiUsage} />}
      {flags && <FlagManager flags={flags} />}
      {secRules && <SecurityManager rules={secRules} />}
      {reportExec && <AnalyticsPanel exec={reportExec} />}
      {m.key === "reporting" && <ReportingPanel />}

      {/* Registry-backed modules: infrastructure / brokers / env / extensions */}
      {registry && reg && <RegistryManager items={registry} kind={reg.kind} title={reg.title} addLabel={reg.addLabel} fields={reg.fields} />}

      {/* Signals & strategy (live copy/PAMM state) */}
      {signals && <SignalsPanel signals={signals} />}

      {/* Automation & AI (scheduled jobs + outbox + live trade surveillance) */}
      {jobs && <AutomationPanel jobs={jobs} />}
      {surveillance && <SurveillancePanel data={surveillance} />}

      {/* Dealer Desk cockpit */}
      {dealerOv && <DealerCockpit ov={dealerOv} configs={dealerConfigs} />}

      {/* Liquidity live panel */}
      {liquidity && liquidity.ok && (
        <>
          <LiquidityManager lps={liquidity.data.lps} />
          <div className="tech-panel rounded-xl p-5">
            <h2 className="mb-3 text-sm font-semibold">Liquidity Connectors (live book)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b tech-border text-left tech-muted">
                    <th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Connector</th><th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Markup</th><th className="py-2 pr-3 text-right">Fill</th><th className="py-2 pr-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidity.data.lps.map((lp) => (
                    <tr key={lp.name} className="border-b tech-border last:border-0">
                      <td className="py-2 pr-3 font-medium">{lp.name}</td>
                      <td className="py-2 pr-3 tech-muted">{lp.connector}</td>
                      <td className="py-2 pr-3"><span className={lp.status === "active" ? "text-emerald-400" : lp.status === "degraded" ? "text-amber-400" : "text-rose-400"}>{lp.status}</span></td>
                      <td className="py-2 pr-3 text-right">{lp.markup_bps ?? "—"} bps</td>
                      <td className="py-2 pr-3 text-right tech-muted">{lp.fill_rate != null ? `${(lp.fill_rate * 100).toFixed(0)}%` : "—"}</td>
                      <td className="py-2 pr-3 text-right tech-muted">{lp.avg_latency_ms != null ? `${lp.avg_latency_ms}ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="tech-panel rounded-xl p-5">
            <h2 className="mb-3 text-sm font-semibold">Bridges</h2>
            <div className="space-y-1.5">
              {liquidity.data.bridges.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-xs">
                  <span className="font-mono">{b.name} <span className="tech-muted">{b.schedule}</span></span>
                  <span className={b.last_status === "succeeded" ? "text-emerald-400" : "text-amber-400"}>{b.last_status ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {liquidity && !liquidity.ok && (
        <div className="tech-panel rounded-xl p-5 text-xs text-amber-300">Live data unavailable: {liquidity.error}</div>
      )}

      {/* Monitoring / Database overview */}
      {consoleData && consoleData.ok && (m.key === "monitoring" || m.key === "database") && consoleData.overview && (
        <div className="tech-panel rounded-xl p-5">
          <h2 className="mb-3 text-sm font-semibold">{m.key === "database" ? "Database" : "System"} Health</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-sm">
            <div><div className="text-[11px] tech-muted">DB size</div><div className="font-bold">{consoleData.overview.db.size_pretty}</div></div>
            <div><div className="text-[11px] tech-muted">Tables</div><div className="font-bold">{consoleData.overview.db.tables}</div></div>
            <div><div className="text-[11px] tech-muted">Profiles</div><div className="font-bold">{consoleData.overview.db.profiles}</div></div>
            <div><div className="text-[11px] tech-muted">Trades</div><div className="font-bold">{consoleData.overview.db.trades}</div></div>
          </div>
        </div>
      )}

      {/* Monitoring — live risk & exposure */}
      {risk && <RiskPanel risk={risk} />}

      {/* Access — super admins */}
      {consoleData && consoleData.ok && m.key === "access" && (
        <div className="tech-panel rounded-xl p-5">
          <h2 className="mb-3 text-sm font-semibold">Administrators</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b tech-border text-left tech-muted"><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3 text-right">Super Admin</th></tr>
            </thead>
            <tbody>
              {consoleData.admins.map((a) => (
                <tr key={a.id} className="border-b tech-border last:border-0">
                  <td className="py-2 pr-3"><div className="font-medium">{a.full_name || a.email}</div><div className="tech-muted">{a.email}</div></td>
                  <td className="py-2 pr-3 uppercase tech-muted">{a.role}</td>
                  <td className="py-2 pr-3"><SuperAdminToggle userId={a.id} on={a.is_super_admin} self={a.id === user?.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Security — searchable Audit Center (IP + before/after + export) */}
      {auditRows && <AuditConsole initial={auditRows} />}
    </div>
  );
}
