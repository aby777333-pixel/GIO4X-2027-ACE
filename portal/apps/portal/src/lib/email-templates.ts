// Bulk-emailer template library (GIO4X). Clicking a template populates the
// subject + body in the composer; {{tokens}} are filled per-recipient
// ({{client_name}} is substituted automatically from the recipient address)
// or typed in by the staff member before sending.

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  category: string;
  body: string;
  mergeTags: string[];
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "TPL001",
    name: "Monthly Performance Update",
    subject: "GIO4X — {{month}} Account Summary",
    category: "client",
    mergeTags: ["{{client_name}}", "{{month}}", "{{account_balance}}", "{{monthly_pnl}}", "{{win_rate}}", "{{next_statement_date}}"],
    body: `Dear {{client_name}},

Here is your trading account summary for {{month}}:

  • Account balance (month-end): {{account_balance}}
  • Net P&L this month: {{monthly_pnl}}
  • Win rate: {{win_rate}}%
  • Next statement: {{next_statement_date}}

Your full statement is attached. Reply to this email or contact your account manager with any questions.

Warm regards,
GIO4X`,
  },
  {
    id: "TPL002",
    name: "Quarterly Statement",
    subject: "Q{{quarter}} Statement — GIO4X",
    category: "client",
    mergeTags: ["{{client_name}}", "{{quarter}}", "{{fy}}", "{{opening_balance}}", "{{closing_balance}}", "{{net_pnl}}"],
    body: `Dear {{client_name}},

Your statement for Q{{quarter}} FY{{fy}} is attached.

  • Opening balance: {{opening_balance}}
  • Closing balance: {{closing_balance}}
  • Net P&L for the quarter: {{net_pnl}}

The attached PDF contains the full trade history and fee breakdown.

Warm regards,
GIO4X`,
  },
  {
    id: "TPL003",
    name: "New Opportunity Alert",
    subject: "New on GIO4X — {{product_name}}",
    category: "marketing",
    mergeTags: ["{{client_name}}", "{{product_name}}", "{{min_deposit}}", "{{leverage}}", "{{promo_deadline}}"],
    body: `Dear {{client_name}},

We're excited to share something new for our traders:

  • Product: {{product_name}}
  • Minimum deposit: {{min_deposit}}
  • Leverage up to: {{leverage}}
  • Offer ends: {{promo_deadline}}

Log in to your portal to get started, or reply to this email to learn more.

Best regards,
GIO4X`,
  },
  {
    id: "TPL004",
    name: "Compliance Notice",
    subject: "Important: {{notice_type}} — GIO4X",
    category: "compliance",
    mergeTags: ["{{client_name}}", "{{notice_type}}", "{{effective_date}}", "{{action_required}}", "{{deadline}}"],
    body: `Dear {{client_name}},

This is an important compliance update regarding your GIO4X account.

  • Notice: {{notice_type}}
  • Effective date: {{effective_date}}
  • Action required: {{action_required}}
  • Response deadline: {{deadline}}

Please review the attached circular and act before the deadline.

Regards,
GIO4X Compliance`,
  },
  {
    id: "TPL005",
    name: "Event Invitation",
    subject: "You're invited: {{event_name}}",
    category: "marketing",
    mergeTags: ["{{client_name}}", "{{event_name}}", "{{event_date}}", "{{event_time}}", "{{rsvp_link}}"],
    body: `Dear {{client_name}},

You're invited to {{event_name}}, hosted by GIO4X.

  • Date: {{event_date}}
  • Time: {{event_time}}
  • RSVP: {{rsvp_link}}

We look forward to seeing you there.

Warm regards,
GIO4X`,
  },
  {
    id: "TPL006",
    name: "Welcome Email",
    subject: "Welcome to GIO4X, {{client_name}}",
    category: "onboarding",
    mergeTags: ["{{client_name}}", "{{login_url}}", "{{account_number}}"],
    body: `Dear {{client_name}},

Welcome to GIO4X! Your account is ready.

  • Account number: {{account_number}}
  • Sign in: {{login_url}}

Complete your KYC to unlock deposits and live trading. We're glad to have you.

Warm regards,
GIO4X`,
  },
  {
    id: "TPL007",
    name: "KYC Reminder",
    subject: "Action needed: complete your KYC — GIO4X",
    category: "compliance",
    mergeTags: ["{{client_name}}", "{{kyc_deadline}}", "{{kyc_url}}"],
    body: `Dear {{client_name}},

Your GIO4X account is missing verified KYC documents.

  • Complete KYC by: {{kyc_deadline}}
  • Upload here: {{kyc_url}}

Verified accounts can deposit, withdraw, and trade live. It only takes a few minutes.

Regards,
GIO4X`,
  },
  {
    id: "TPL008",
    name: "Account Communication",
    subject: "{{subject_line}} — GIO4X",
    category: "internal",
    mergeTags: ["{{client_name}}", "{{subject_line}}", "{{message_body}}"],
    body: `Dear {{client_name}},

{{message_body}}

Regards,
GIO4X`,
  },
];
