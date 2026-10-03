"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { requireUser } from "./session";
import type { Enums } from "@gio4x/supabase";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function newIdempotencyKey(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${r}`;
}

// ---------------------------------------------------------------------------
// requestDeposit — creates a wallet_transactions row with status=pending.
// Real gateway integrations land later; for now we record intent.
// ---------------------------------------------------------------------------
export async function requestDeposit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const walletId = String(formData.get("wallet_id") || "");
  const amountRaw = String(formData.get("amount") || "");
  const gateway = String(formData.get("gateway") || "card");
  const gatewayRef = String(formData.get("gateway_ref") || "") || undefined;

  const amount = Number.parseFloat(amountRaw);
  if (!walletId) return { ok: false, error: "Wallet is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Amount must be greater than 0." };
  if (amount < 10) return { ok: false, error: "Minimum deposit is $10." };

  const supabase = getSupabaseServer();

  // verify the wallet belongs to the caller
  const { data: wallet, error: wErr } = await supabase
    .from("wallets")
    .select("id, user_id")
    .eq("id", walletId)
    .maybeSingle();
  if (wErr || !wallet) return { ok: false, error: "Wallet not found." };
  if (wallet.user_id !== user.id) return { ok: false, error: "Forbidden." };

  const { data: txId, error } = await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: walletId,
    p_type: "deposit",
    p_amount: amount,
    p_idempotency_key: newIdempotencyKey("dep"),
    p_gateway: gateway,
    p_gateway_ref: gatewayRef,
    p_status: "pending",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/wallet");
  revalidatePath("/funds/history");
  revalidatePath("/");
  return { ok: true, message: "Deposit recorded — pending settlement.", id: txId ?? undefined };
}

// ---------------------------------------------------------------------------
// requestWithdrawal — pending withdrawal request. KYC-gated.
// ---------------------------------------------------------------------------
export async function requestWithdrawal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  if (user.profile?.kyc_status !== "approved") {
    return {
      ok: false,
      error: "KYC must be approved before requesting a withdrawal.",
    };
  }

  const walletId = String(formData.get("wallet_id") || "");
  const amountRaw = String(formData.get("amount") || "");
  const gateway = String(formData.get("gateway") || "bank");
  const gatewayRef = String(formData.get("gateway_ref") || "") || undefined;

  const amount = Number.parseFloat(amountRaw);
  if (!walletId) return { ok: false, error: "Wallet is required." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Amount must be greater than 0." };
  if (amount < 10) return { ok: false, error: "Minimum withdrawal is $10." };

  const supabase = getSupabaseServer();
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, user_id, balance")
    .eq("id", walletId)
    .maybeSingle();
  if (!wallet || wallet.user_id !== user.id) return { ok: false, error: "Wallet not found." };
  if (Number(wallet.balance) < amount) return { ok: false, error: "Insufficient balance." };

  const { data: txId, error } = await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: walletId,
    p_type: "withdraw",
    p_amount: amount,
    p_idempotency_key: newIdempotencyKey("wdr"),
    p_gateway: gateway,
    p_gateway_ref: gatewayRef,
    p_status: "pending",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/wallet");
  revalidatePath("/withdrawals");
  revalidatePath("/funds/history");
  return { ok: true, message: "Withdrawal request submitted.", id: txId ?? undefined };
}

// ---------------------------------------------------------------------------
// transferBetweenWallets — two RPC calls in sequence (transfer_out + _in).
// Both linked by a shared idempotency-key suffix so we can detect partial states.
// ---------------------------------------------------------------------------
export async function transferBetweenWallets(formData: FormData): Promise<ActionResult> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Not signed in." };

  const fromId = String(formData.get("from_wallet_id") || "");
  const toId = String(formData.get("to_wallet_id") || "");
  const amount = Number.parseFloat(String(formData.get("amount") || ""));

  if (!fromId || !toId) return { ok: false, error: "Source and destination required." };
  if (fromId === toId) return { ok: false, error: "Pick two different wallets." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Amount must be greater than 0." };

  const supabase = getSupabaseServer();
  const { data: wallets, error: wErr } = await supabase
    .from("wallets")
    .select("id, user_id, balance, currency, type")
    .in("id", [fromId, toId]);
  if (wErr || !wallets || wallets.length !== 2)
    return { ok: false, error: "Could not load wallets." };

  const from = wallets.find((w) => w.id === fromId);
  const to = wallets.find((w) => w.id === toId);
  if (!from || !to) return { ok: false, error: "Wallets not found." };
  if (from.user_id !== user.id || to.user_id !== user.id)
    return { ok: false, error: "Forbidden." };
  if (Number(from.balance) < amount)
    return { ok: false, error: "Insufficient balance on source wallet." };
  if (from.currency !== to.currency)
    return { ok: false, error: "Cross-currency transfers are not enabled yet." };

  const key = newIdempotencyKey("txf");

  const { error: outErr } = await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: fromId,
    p_type: "transfer_out",
    p_amount: amount,
    p_idempotency_key: `${key}-out`,
    p_status: "completed",
    p_related_user_id: user.id,
  });
  if (outErr) return { ok: false, error: outErr.message };

  const { error: inErr } = await supabase.rpc("process_wallet_transaction", {
    p_wallet_id: toId,
    p_type: "transfer_in",
    p_amount: amount,
    p_idempotency_key: `${key}-in`,
    p_status: "completed",
    p_related_user_id: user.id,
  });
  if (inErr) return { ok: false, error: `Transfer-in failed: ${inErr.message}` };

  revalidatePath("/wallet");
  revalidatePath("/transfers");
  revalidatePath("/funds/history");
  return { ok: true, message: "Transfer complete.", id: key };
}

// ---------------------------------------------------------------------------
// pure helper — server-side balance summary used by Home + Wallet
// ---------------------------------------------------------------------------
export type WalletRollup = {
  wallets: Array<{
    id: string;
    walletId: string;
    balance: number;
    currency: Enums<"wallet_currency">;
    type: Enums<"wallet_type">;
  }>;
  totalUsdEstimate: number;
};

export async function loadWalletRollup(): Promise<WalletRollup> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("wallets")
    .select("id, wallet_id, balance, currency, type")
    .order("created_at", { ascending: true });

  const wallets = (data ?? []).map((w) => ({
    id: w.id,
    walletId: w.wallet_id,
    balance: Number(w.balance ?? 0),
    currency: w.currency,
    type: w.type,
  }));

  // Naive USD estimate — currencies all assumed 1:1 until we add an FX feed.
  // Cent accounts (USC) are 1/100.
  const totalUsdEstimate = wallets.reduce((s, w) => {
    const usd = w.currency === "USC" ? w.balance / 100 : w.balance;
    return s + usd;
  }, 0);

  return { wallets, totalUsdEstimate };
}
