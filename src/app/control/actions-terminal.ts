"use server";

/**
 * Three kinds of change that are not rows of the portal's configuration:
 *
 *   the trading terminal   a symbol's trading conditions, and trading blocks
 *                          (src/lib/server/terminal-db.ts; trading.manage)
 *   the trade log          a closed trade entered by hand (trading.manage)
 *   service e-mail         one message to a fixed audience of portal clients
 *                          (src/lib/server/mailer.ts; emailer.send)
 *
 * The order is the one every write in Control follows: who is calling and what
 * they may do, the input reduced to an allow-list, the audit entry in this
 * database as the signed-in member of staff (portal_ops_record, 0027 and 0028;
 * no entry, no change), then the change itself. Outcomes are fixed codes in
 * the query string: nothing typed and nothing a remote system said is echoed.
 */
import { redirect } from "next/navigation";
import { mailerReady, sendToEach } from "@/lib/server/mailer";
import { requirePortal } from "@/lib/server/portal-db";
import { INSTRUMENT_FIELDS, ROUTING_MODES, isSymbol, requireTerminal, type InstrumentField, type TradingBlock } from "@/lib/server/terminal-db";
import { cleanText, isUuid } from "@/lib/server/validate";

const BROKER = "/control/broker";
const TRADES = "/control/trades";
const EMAILER = "/control/emailer";

function actorOf(ctx: { displayName: string; email: string | null }): string {
  const name = cleanText(ctx.displayName).slice(0, 80) || "Control staff";
  return ctx.email ? `${name} <${ctx.email}>`.slice(0, 120) : name;
}

const line = (formData: FormData, name: string, max: number): string => {
  const raw = formData.get(name);
  return typeof raw === "string" ? cleanText(raw).replace(/\n+/g, " ").slice(0, max) : "";
};

async function terminalFor() {
  const access = await requireTerminal("trading.manage");
  if (access.state === "none") redirect("/control");
  if (access.state === "forbidden") redirect(`${BROKER}?error=forbidden`);
  if (access.state === "unconfigured") redirect(`${BROKER}?error=terminal`);
  return access;
}

/** One field of one symbol. The value is checked against the field's kind and bounds before anything is asked of the terminal. */
export async function updateInstrument(formData: FormData): Promise<void> {
  const { ctx, terminal } = await terminalFor();
  const symbol = formData.get("symbol");
  const field = formData.get("field");
  if (!isSymbol(symbol) || typeof field !== "string" || !Object.prototype.hasOwnProperty.call(INSTRUMENT_FIELDS, field)) redirect(`${BROKER}?error=invalid`);
  const rule = INSTRUMENT_FIELDS[field as InstrumentField];
  const raw = formData.get("value");

  let value: number | boolean | string;
  if (rule.kind === "flag") {
    if (raw !== "true" && raw !== "false") redirect(`${BROKER}?error=value`);
    value = raw === "true";
  } else if (rule.kind === "routing") {
    if (typeof raw !== "string" || !(ROUTING_MODES as readonly string[]).includes(raw)) redirect(`${BROKER}?error=value`);
    value = raw;
  } else {
    const text = typeof raw === "string" ? raw.trim() : "";
    const n = Number(text);
    if (!/^-?[0-9]{1,6}([.][0-9]{1,5})?$/.test(text) || !Number.isFinite(n) || n < rule.min || n > rule.max) redirect(`${BROKER}?error=value`);
    value = n;
  }

  const current = await terminal.select<Record<string, unknown>>(`instruments?symbol=eq.${encodeURIComponent(symbol)}&select=${field}&limit=1`);
  if (!current) redirect(`${BROKER}?error=terminal`);
  if (current.length === 0) redirect(`${BROKER}?error=missing`);
  const old = current[0][field];

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: "broker.symbol", p_entity_id: null, p_detail: { symbol, field, value, was: old === null || old === undefined ? null : String(old) } });
  if (record.error) redirect(`${BROKER}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const ok = await terminal.patch(`instruments?symbol=eq.${encodeURIComponent(symbol)}`, { [field]: value });
  if (!ok) {
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: null, p_detail: { attempted: "broker.symbol", symbol, field } });
    redirect(`${BROKER}?error=terminal`);
  }
  // the terminal's own record, read by its staff console as well
  await terminal.insert("broker_config_audit", { actor: actorOf(ctx), symbol, field, old_value: old === null || old === undefined ? null : String(old), new_value: String(value) });
  redirect(`${BROKER}?notice=symbol&symbol=${encodeURIComponent(symbol)}`);
}

/** A window in which one symbol, or every symbol, cannot be traded: around a release, or for maintenance. */
export async function addTradingBlock(formData: FormData): Promise<void> {
  const { ctx, terminal } = await terminalFor();
  const symbolRaw = formData.get("symbol");
  const symbol = symbolRaw === "" || symbolRaw === null ? null : isSymbol(symbolRaw) ? symbolRaw : undefined;
  const reason = line(formData, "reason", 160);
  const startRaw = formData.get("starts");
  const endRaw = formData.get("ends");
  // datetime-local values, read as UTC like every time the console shows
  const when = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(v) ? new Date(`${v}:00Z`) : null);
  const starts = when(startRaw);
  const ends = when(endRaw);
  if (symbol === undefined) redirect(`${BROKER}?error=invalid`);
  if (reason.length < 3 || !starts || !ends || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts || ends.getTime() < Date.now()) redirect(`${BROKER}?error=block`);
  // a block is a short window, not a way to switch a symbol off: that is "Trading allowed"
  if (ends.getTime() - starts.getTime() > 14 * 86_400_000) redirect(`${BROKER}?error=block`);

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: "broker.block", p_entity_id: null, p_detail: { op: "add", symbol: symbol ?? "ALL", reason, starts: starts.toISOString(), ends: ends.toISOString() } });
  if (record.error) redirect(`${BROKER}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const ok = await terminal.insert("broker_trading_blocks", { symbol, reason, starts_at: starts.toISOString(), ends_at: ends.toISOString(), created_by: actorOf(ctx) });
  if (!ok) {
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: null, p_detail: { attempted: "broker.block" } });
    redirect(`${BROKER}?error=terminal`);
  }
  await terminal.insert("broker_config_audit", { actor: actorOf(ctx), symbol: symbol ?? "ALL", field: "trading_block", old_value: null, new_value: `${reason} (${starts.toISOString()} → ${ends.toISOString()})` });
  redirect(`${BROKER}?notice=block`);
}

/** End a block now. It is not deleted: its end is brought forward to this moment, so the record of it remains. */
export async function endTradingBlock(formData: FormData): Promise<void> {
  const { ctx, terminal } = await terminalFor();
  const id = formData.get("id");
  if (!isUuid(id)) redirect(`${BROKER}?error=invalid`);
  const found = await terminal.select<TradingBlock>(`broker_trading_blocks?id=eq.${id}&select=id,symbol,reason,starts_at,ends_at&limit=1`);
  if (!found) redirect(`${BROKER}?error=terminal`);
  if (found.length === 0) redirect(`${BROKER}?error=missing`);
  const block = found[0];

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: "broker.block", p_entity_id: id, p_detail: { op: "end", symbol: block.symbol ?? "ALL" } });
  if (record.error) redirect(`${BROKER}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const now = new Date().toISOString();
  // a block that has not started yet ends where it starts: it never applies
  const end = new Date(block.starts_at).getTime() > Date.now() ? block.starts_at : now;
  const ok = await terminal.patch(`broker_trading_blocks?id=eq.${id}`, { ends_at: end });
  if (!ok) {
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: id, p_detail: { attempted: "broker.block" } });
    redirect(`${BROKER}?error=terminal`);
  }
  await terminal.insert("broker_config_audit", { actor: actorOf(ctx), symbol: block.symbol ?? "ALL", field: "trading_block", old_value: `${block.reason} (${block.starts_at} → ${block.ends_at})`, new_value: `ended ${end}` });
  redirect(`${BROKER}?notice=blockended`);
}

/**
 * A closed trade entered by hand: a correction, or one the platform bridge did
 * not deliver. The portal writes it as it writes any closed trade, so the
 * per-lot commission is charged and IB rebates are distributed by its own
 * triggers. It is marked as manual, with who entered it, and is not edited
 * afterwards.
 */
export async function recordTrade(formData: FormData): Promise<void> {
  const access = await requirePortal("trading.manage");
  if (access.state === "none") redirect("/control");
  if (access.state === "forbidden") redirect(`${TRADES}?error=forbidden`);
  if (access.state === "unconfigured") redirect(`${TRADES}?error=unconfigured`);
  const { ctx, db } = access;

  const account = formData.get("account");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const side = formData.get("side");
  const num = (name: string, signed = false) => {
    const raw = formData.get(name);
    const text = typeof raw === "string" ? raw.trim() : "";
    return (signed ? /^-?[0-9]{1,10}([.][0-9]{1,8})?$/ : /^[0-9]{1,10}([.][0-9]{1,8})?$/).test(text) ? text : null;
  };
  const lots = num("lots");
  const open = num("open");
  const close = num("close");
  const pnl = num("pnl", true);
  const ticketRaw = String(formData.get("ticket") ?? "").trim();
  if (!isUuid(account) || (side !== "buy" && side !== "sell")) redirect(`${TRADES}?error=invalid`);
  if (!isSymbol(symbol) || !lots || !open || !close || !pnl || Number(lots) <= 0 || Number(open) <= 0 || Number(close) <= 0 || (ticketRaw && !/^[0-9]{1,15}$/.test(ticketRaw))) redirect(`${TRADES}?error=value`);

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: "trade.record", p_entity_id: account, p_detail: { symbol, side, lots, open, close, pnl, ticket: ticketRaw || null } });
  if (record.error) redirect(`${TRADES}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  // amounts travel as text so that no digit is lost on the way to a numeric column
  const { data, error } = await db.rpc("control_trade_record", { p_account: account, p_symbol: symbol, p_side: side, p_lots: lots, p_open: open, p_close: close, p_pnl: pnl, p_ticket: ticketRaw ? Number(ticketRaw) : null, p_actor: actorOf(ctx) });
  const outcome = (data ?? {}) as { result?: string };
  if (error || outcome.result !== "ok") {
    const code = error ? "portal_error" : (outcome.result ?? "unknown");
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: account, p_detail: { attempted: "trade.record", outcome: code } });
    const shown: Record<string, string> = { invalid: "value", not_found: "missing", account_not_active: "account", duplicate: "duplicate" };
    redirect(`${TRADES}?error=${shown[code] ?? "portal"}`);
  }
  redirect(`${TRADES}?notice=recorded`);
}

const AUDIENCES = ["clients_active", "ibs_active", "kyc_incomplete"] as const;

/**
 * One service message to one fixed audience of portal clients. The addresses
 * come from the portal's database for that audience; none is typed or pasted,
 * and none is shown. The message is plain text. What is recorded here is the
 * audience, the subject and the counts; the portal keeps its own record of the
 * send, as it does for its own console.
 *
 * `confirm` must repeat the number of recipients shown on the screen: a send
 * to everyone is never one stray click.
 */
export async function sendServiceEmail(formData: FormData): Promise<void> {
  const access = await requirePortal("emailer.send");
  if (access.state === "none") redirect("/control");
  if (access.state === "forbidden") redirect(`${EMAILER}?error=forbidden`);
  if (access.state === "unconfigured") redirect(`${EMAILER}?error=unconfigured`);
  const { ctx, db } = access;
  if (!mailerReady()) redirect(`${EMAILER}?error=mailer`);

  const audience = formData.get("audience");
  if (typeof audience !== "string" || !(AUDIENCES as readonly string[]).includes(audience)) redirect(`${EMAILER}?error=invalid`);
  const subject = line(formData, "subject", 150);
  const bodyRaw = formData.get("body");
  const body = typeof bodyRaw === "string" ? cleanText(bodyRaw).slice(0, 10000) : "";
  if (subject.length < 5 || body.length < 20) redirect(`${EMAILER}?error=value`);

  const list = await db.rpc("control_email_audience", { p_audience: audience });
  if (list.error) redirect(`${EMAILER}?error=portal`);
  const recipients = ((list.data ?? []) as string[]).filter((e) => typeof e === "string" && e.length <= 254);
  if (recipients.length === 0) redirect(`${EMAILER}?error=nobody`);
  if (String(formData.get("confirm") ?? "").trim() !== String(recipients.length)) redirect(`${EMAILER}?error=confirm&audience=${audience}`);

  const record = await ctx.supabase.rpc("portal_ops_record", { p_action: "email.send", p_entity_id: null, p_detail: { audience, subject, recipients: recipients.length } });
  if (record.error) redirect(`${EMAILER}?error=${record.error.code === "42501" ? "forbidden" : "audit"}`);

  const outcome = await sendToEach(recipients, subject, body);
  const status = outcome.failed === 0 ? "sent" : outcome.sent === 0 ? "failed" : "partial";
  await db.rpc("control_email_log", {
    p_audience: audience, p_subject: subject, p_body: body, p_recipients: recipients, p_status: status,
    p_sent: outcome.sent, p_failed: outcome.failed, p_error: outcome.error, p_actor: actorOf(ctx),
  });
  if (status !== "sent") {
    await ctx.supabase.rpc("portal_ops_record", { p_action: "ops.failed", p_entity_id: null, p_detail: { attempted: "email.send", outcome: outcome.error ?? status, sent: outcome.sent, failed: outcome.failed } });
    redirect(`${EMAILER}?error=${status === "partial" ? "partial" : "provider"}`);
  }
  redirect(`${EMAILER}?notice=sent`);
}
