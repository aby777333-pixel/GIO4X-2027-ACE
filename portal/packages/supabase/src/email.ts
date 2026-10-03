// Email template registry. Each template is typed so callers can't pass the
// wrong shape of variables. Default provider is `stub` (logs to console);
// when Supabase Auth sends its own confirmation/recovery emails, we don't
// touch them — this registry is for our own transactional sends (welcome,
// IB approval, KYC update, deposit/withdraw confirmations, etc.).

export interface EmailSendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface EmailAdapter {
  send<K extends EmailTemplateKey>(
    to: string,
    templateKey: K,
    vars: EmailTemplateVars[K],
  ): Promise<EmailSendResult>;
}

// ---- Templates ------------------------------------------------------------

export type EmailTemplateKey =
  | "welcome"
  | "kycApproved"
  | "kycRejected"
  | "depositConfirmed"
  | "withdrawalRequested"
  | "withdrawalCompleted"
  | "ibApproved"
  | "newDeviceLogin";

export interface EmailTemplateVars {
  welcome: { fullName: string; referralCode: string; loginUrl: string };
  kycApproved: { fullName: string };
  kycRejected: { fullName: string; reason: string };
  depositConfirmed: { fullName: string; amount: string; currency: string; method: string };
  withdrawalRequested: { fullName: string; amount: string; currency: string; method: string };
  withdrawalCompleted: { fullName: string; amount: string; currency: string; method: string };
  ibApproved: { fullName: string; ibCode: string };
  newDeviceLogin: { fullName: string; device: string; ipAddress: string; when: string };
}

interface EmailContent { subject: string; text: string; html: string }

function render<K extends EmailTemplateKey>(key: K, vars: EmailTemplateVars[K]): EmailContent {
  switch (key) {
    case "welcome": {
      const v = vars as EmailTemplateVars["welcome"];
      return {
        subject: "Welcome to GIO4X",
        text: `Hi ${v.fullName},\n\nYour GIO4X account is ready. Your referral code: ${v.referralCode}.\nSign in: ${v.loginUrl}`,
        html: `<p>Hi ${v.fullName},</p><p>Your GIO4X account is ready. Your referral code: <strong>${v.referralCode}</strong>.</p><p><a href="${v.loginUrl}">Sign in</a></p>`,
      };
    }
    case "kycApproved": {
      const v = vars as EmailTemplateVars["kycApproved"];
      return {
        subject: "GIO4X — KYC verified",
        text: `Hi ${v.fullName}, your verification is complete. Withdrawals are now enabled.`,
        html: `<p>Hi ${v.fullName}, your verification is complete. Withdrawals are now enabled.</p>`,
      };
    }
    case "kycRejected": {
      const v = vars as EmailTemplateVars["kycRejected"];
      return {
        subject: "GIO4X — KYC needs attention",
        text: `Hi ${v.fullName}, your verification was rejected: ${v.reason}. Please re-upload.`,
        html: `<p>Hi ${v.fullName}, your verification was rejected: <em>${v.reason}</em>. Please re-upload.</p>`,
      };
    }
    case "depositConfirmed": {
      const v = vars as EmailTemplateVars["depositConfirmed"];
      return {
        subject: `GIO4X — Deposit confirmed (${v.amount} ${v.currency})`,
        text: `Hi ${v.fullName}, we received your ${v.amount} ${v.currency} deposit via ${v.method}.`,
        html: `<p>Hi ${v.fullName}, we received your <strong>${v.amount} ${v.currency}</strong> deposit via ${v.method}.</p>`,
      };
    }
    case "withdrawalRequested": {
      const v = vars as EmailTemplateVars["withdrawalRequested"];
      return {
        subject: `GIO4X — Withdrawal requested (${v.amount} ${v.currency})`,
        text: `Hi ${v.fullName}, your ${v.amount} ${v.currency} withdrawal via ${v.method} is being processed.`,
        html: `<p>Hi ${v.fullName}, your <strong>${v.amount} ${v.currency}</strong> withdrawal via ${v.method} is being processed.</p>`,
      };
    }
    case "withdrawalCompleted": {
      const v = vars as EmailTemplateVars["withdrawalCompleted"];
      return {
        subject: `GIO4X — Withdrawal sent (${v.amount} ${v.currency})`,
        text: `Hi ${v.fullName}, ${v.amount} ${v.currency} has been sent via ${v.method}.`,
        html: `<p>Hi ${v.fullName}, <strong>${v.amount} ${v.currency}</strong> has been sent via ${v.method}.</p>`,
      };
    }
    case "ibApproved": {
      const v = vars as EmailTemplateVars["ibApproved"];
      return {
        subject: "GIO4X — IB application approved",
        text: `Hi ${v.fullName}, your IB account is live. IB code: ${v.ibCode}.`,
        html: `<p>Hi ${v.fullName}, your IB account is live. IB code: <strong>${v.ibCode}</strong>.</p>`,
      };
    }
    case "newDeviceLogin": {
      const v = vars as EmailTemplateVars["newDeviceLogin"];
      return {
        subject: "GIO4X — New device sign-in",
        text: `Hi ${v.fullName}, we noticed a sign-in from ${v.device} (${v.ipAddress}) at ${v.when}. Not you? Reset your password immediately.`,
        html: `<p>Hi ${v.fullName}, we noticed a sign-in from <strong>${v.device}</strong> (${v.ipAddress}) at ${v.when}. Not you? Reset your password immediately.</p>`,
      };
    }
  }
  // Exhaustiveness fallback
  throw new Error(`unknown email template: ${String(key)}`);
}

class StubEmailAdapter implements EmailAdapter {
  async send<K extends EmailTemplateKey>(
    to: string,
    templateKey: K,
    vars: EmailTemplateVars[K],
  ): Promise<EmailSendResult> {
    const { subject } = render(templateKey, vars);
    // eslint-disable-next-line no-console
    console.log(`[email:stub] → ${to} · ${templateKey} · ${subject}`);
    return { ok: true, providerRef: `stub-${Date.now()}` };
  }
}

let singleton: EmailAdapter | null = null;

export function getEmail(): EmailAdapter {
  if (singleton) return singleton;
  const provider = (process.env.EMAIL_PROVIDER || "supabase").toLowerCase();
  switch (provider) {
    // case "resend": singleton = new ResendEmailAdapter(...); break;
    // case "smtp":   singleton = new SmtpEmailAdapter(...);   break;
    case "supabase":
    case "stub":
    default:
      // For "supabase", transactional emails outside of Supabase's built-in
      // auth flows still go through the stub for now. Wire a real provider
      // when transactional volume justifies it.
      singleton = new StubEmailAdapter();
  }
  return singleton;
}
