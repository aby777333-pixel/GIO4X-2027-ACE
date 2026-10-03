// Honest capability status per module. A capability is "live" only when it is
// actually wired to a working control on that module's page; everything else is
// "planned" (provisioned in the registry, not yet operational). Keep these in
// sync with the panels rendered in app/tech/[module]/page.tsx.
export const CAPABILITY_LIVE: Record<string, string[]> = {
  platform: ["Feature create/edit/enable/disable/delete", "Feature toggles & deployment"],
  api: ["API key create/regenerate/suspend/revoke", "REST API", "WebSocket API", "Rate limiting & throttling", "Usage analytics", "API documentation", "Third-party developer access"],
  marketplace: ["Install extensions", "Custom plugins", "Per-broker enable/disable"],
  devtools: ["Environment variables"],
  bridges: [
    "MT4 & MT5 bridges", "Proprietary platform bridge", "Liquidity provider connectors",
    "Payment gateway connectors", "Banking connectors", "CRM connectors",
    "KYC provider connectors", "TradingView integration", "External app integrations",
  ],
  liquidity: ["LP configuration", "Markup & spread", "Aggregation", "Smart order routing", "A-Book/B-Book/Hybrid", "Execution routing"],
  spreads: [
    "Global & per-symbol spreads", "Per-symbol commission (live)",
    "Spread profiles (retail/pro/vip/institutional/IB)", "Per-LP markup (live)",
    "Aggregation / best bid-ask", "Change history & audit", "Rollback-ready",
  ],
  trading: ["Symbol & contract specs", "Instrument create/delete", "Asset categories"],
  dealer: ["A-Book / B-Book / Hybrid routing", "Scope-based book config", "Live routing preview", "Exposure aggregation", "Liquidity provider management"],
  signals: ["Signal providers", "Copy trading", "PAMM/MAM strategies"],
  access: ["Super admin management", "Technical admin management", "Access audit trails"],
  broker_ops: ["White-label provisioning", "Multi-brand"],
  reporting: ["API usage", "Liquidity", "Security", "Export PDF/Excel/CSV/JSON"],
  infra: ["Servers & cloud"],
  monitoring: ["System health", "API performance", "Database monitoring", "Latency", "Audit logs", "Performance analytics"],
  database: ["Health monitoring"],
  automation: ["AI anomaly detection", "AI risk monitoring", "AI diagnostics", "Workflow automation", "Scheduled jobs"],
  security: ["MFA controls", "IP whitelisting", "Geo restrictions", "Security event monitoring"],
};

export function isCapabilityLive(moduleKey: string, feature: string): boolean {
  return CAPABILITY_LIVE[moduleKey]?.includes(feature) ?? false;
}
