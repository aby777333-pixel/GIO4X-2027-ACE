/**
 * The Service Console sections that have no screens here yet: what each will
 * do, and what it is waiting for. Shown at /control/<key> so the menu is
 * complete and honest: a section that is not built says so, in place of
 * sample figures. The order of work is docs/BACKOFFICE-PLAN.md.
 */
export type PendingSection = { label: string; will: string; needs: string; phase: string };

export const PENDING_SECTIONS: Record<string, PendingSection> = {
  command: {
    label: "Command Centre",
    will: "One screen of the whole business: clients and accounts, money in and out, exposure, risk and compliance, and the health of each system.",
    needs: "Every figure on it comes from another section, so it is built last. Until those exist it would have nothing true to show.",
    phase: "Phase 7 · Oversight",
  },
  chats: {
    label: "Live Chats",
    will: "Conversations from the website and the client area: claim one, reply, hand it to a colleague, close it, with canned replies and a record of who said what.",
    needs: "A chat window on the website, and an agreed rota so that a visitor is never left waiting on a chat nobody is watching.",
    phase: "Phase 4 · Support",
  },
  tickets: {
    label: "Tickets",
    will: "Support requests with an owner, a priority, a response target, internal notes and a resolution code.",
    needs: "Client records to attach a ticket to, and a sending domain so that replies reach the client by e-mail.",
    phase: "Phase 4 · Support",
  },
  customers: {
    label: "Customers",
    will: "The client directory and a full view of one client: profile, verification, accounts, money movements, trades, tickets and notes.",
    needs: "A client area where people register. Whether that is built here or the earlier portal is kept is the owner’s decision.",
    phase: "Phase 2 · Clients and KYC",
  },
  kyc: {
    label: "KYC",
    will: "Identity and address documents: view each one, accept or reject it with a reason, and a verification status derived from the documents, never set by hand.",
    needs: "Client records and a secure place for documents, plus the choice between manual review and a verification provider.",
    phase: "Phase 2 · Clients and KYC",
  },
  compliance: {
    label: "Compliance",
    will: "Stored risk assessments, cases, sanctions and politically-exposed-person screening, and monitoring of unusual money movements.",
    needs: "Clients, verification and money movements to assess, and a screening provider.",
    phase: "Phase 7 · Oversight",
  },
  funds: {
    label: "Funds & Settlement",
    will: "Deposit and withdrawal requests: checked against verified payment details, held, approved by a second person and settled, each step recorded.",
    needs: "The general ledger first, then payment providers and bank details. Nothing here will ever move a balance without two people.",
    phase: "Phase 3 · Money",
  },
  fees: {
    label: "Fee Engine",
    will: "Fee schedules and rules, and the charges they produce, each posted to the ledger.",
    needs: "The general ledger, and the published fee schedule.",
    phase: "Phase 3 · Money",
  },
  ib: {
    label: "IB Network",
    will: "Introducing brokers, the clients they brought, commission plans and what each partner is owed.",
    needs: "Client accounts, the ledger, and trades to calculate commission from.",
    phase: "Phase 6 · Partners",
  },
  copy: {
    label: "Copy Trading",
    will: "Providers, followers and the allocation between them, with the fees each arrangement carries.",
    needs: "A connection to the trading platform and the ledger.",
    phase: "Phase 6 · Partners",
  },
  pamm: {
    label: "PAMM / MAM",
    will: "Managed pools: who allocated what, how each result was divided, and the manager’s fee.",
    needs: "A connection to the trading platform and the ledger.",
    phase: "Phase 6 · Partners",
  },
  trades: {
    label: "Trade Log",
    will: "Every order and position as the trading platform recorded it, searchable by client, account and instrument.",
    needs: "A connection to MetaTrader 5 or 777 Raptor. Without one there are no trades to list, and none will be invented.",
    phase: "Phase 5 · Trading",
  },
  reports: {
    label: "Reporting Centre",
    will: "Scheduled and on-demand reports: clients, money, trading and partners, each exportable with the export recorded.",
    needs: "The sections it reports on.",
    phase: "Phase 7 · Oversight",
  },
  broker: {
    label: "Broker Controls",
    will: "Trading conditions in one place: spreads, leverage, swaps and trading hours, changed once and published everywhere, with two-person approval.",
    needs: "A connection to the trading platform, and the confirmed conditions for each account type.",
    phase: "Phase 5 · Trading",
  },
  ledger: {
    label: "General Ledger",
    will: "The double-entry record that every balance is derived from: accounts, journal entries and their lines, corrected only by reversal.",
    needs: "Nothing but a decision to begin: it is the first thing built in the money phase, before any deposit or withdrawal screen.",
    phase: "Phase 3 · Money",
  },
  events: {
    label: "Event Bus",
    will: "What happened and what it set in motion: each business event, the notifications and jobs it produced, and anything that failed and needs retrying.",
    needs: "The sections that raise events, and a scheduled worker to deliver them.",
    phase: "Phase 4 · Support",
  },
  documents: {
    label: "Document Builder",
    will: "Client-facing documents from approved templates: statements, confirmations and letters, each with its version.",
    needs: "Client records, and the legal documents once they have been reviewed.",
    phase: "Phase 8 · Publishing",
  },
  emailer: {
    label: "Bulk Emailer",
    will: "Newsletters and notices to people who agreed to receive them, with templates, a preview, an unsubscribe link and a record of each send.",
    needs: "A sending domain with SPF, DKIM and DMARC set up. Until then, Subscribers shows who has agreed to hear from GIO4X.",
    phase: "Phase 8 · Publishing",
  },
  config: {
    label: "Configuration",
    will: "Settings a broker changes without a developer: deposit instructions, account types, published documents and feature switches, each change approved and recorded.",
    needs: "The sections whose settings it holds.",
    phase: "Phase 8 · Publishing",
  },
};
