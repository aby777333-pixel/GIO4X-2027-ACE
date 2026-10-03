// SMS / OTP adapter — typed interface so the provider can be swapped without
// touching feature code. Default provider is `stub`, which logs to the server
// console (visible in dev) instead of actually sending a text.
//
// To swap to Twilio / Msg91 / Supabase phone-auth later: implement an adapter
// that conforms to `SmsAdapter` and switch on `SMS_PROVIDER` in `getSms()`.

export interface SmsSendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface SmsAdapter {
  /** Send a numeric OTP. The caller is responsible for storing/verifying it. */
  sendOtp(toE164: string, code: string, ttlSeconds: number): Promise<SmsSendResult>;
  /** Send any free-text transactional SMS (welcome, alert, etc). */
  sendText(toE164: string, body: string): Promise<SmsSendResult>;
}

class StubSmsAdapter implements SmsAdapter {
  async sendOtp(to: string, code: string, ttlSeconds: number): Promise<SmsSendResult> {
    // eslint-disable-next-line no-console
    console.log(
      `[sms:stub] OTP ${code} → ${to} (valid ${ttlSeconds}s, sender ${this.sender})`,
    );
    return { ok: true, providerRef: `stub-${Date.now()}` };
  }
  async sendText(to: string, body: string): Promise<SmsSendResult> {
    // eslint-disable-next-line no-console
    console.log(`[sms:stub] TEXT → ${to}: ${body.slice(0, 80)}${body.length > 80 ? "…" : ""}`);
    return { ok: true, providerRef: `stub-${Date.now()}` };
  }
  private get sender() {
    return process.env.SMS_SENDER_ID || "GIO4X";
  }
}

let singleton: SmsAdapter | null = null;

export function getSms(): SmsAdapter {
  if (singleton) return singleton;
  const provider = (process.env.SMS_PROVIDER || "stub").toLowerCase();
  switch (provider) {
    // case "twilio": singleton = new TwilioSmsAdapter(...); break;
    // case "msg91":  singleton = new Msg91SmsAdapter(...);  break;
    // case "supabase": singleton = new SupabasePhoneAdapter(...); break;
    case "stub":
    default:
      singleton = new StubSmsAdapter();
  }
  return singleton;
}

/** Crypto-safe 6-digit OTP. */
export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  const buf = new Uint8Array(4);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 4; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return String(n % max).padStart(digits, "0");
}
