"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";

// ---------------------------------------------------------------------------
// Internal transfers: move funds between the user's main wallet and their
// trading accounts. The money movement happens server-side inside the
// SECURITY DEFINER transfer_funds() RPC (atomic, idempotent, ownership-checked,
// audited). This module just loads the user's endpoints and calls the RPC.
// ---------------------------------------------------------------------------

export type TransferEndpoint = {
  kind: "wallet" | "account";
  id: string;
  label: string;
  balance: number;
  currency: string;
};

export type TransferResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// The current user's transferable endpoints: main wallet + active trading accounts.
export async function loadTransferEndpoints(): Promise<TransferEndpoint[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = getSupabaseServer();

  const [{ data: wallet }, { data: accounts }] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, balance, currency")
      .eq("user_id", user.id)
      .eq("type", "main")
      .maybeSingle(),
    supabase
      .from("trading_accounts")
      .select("id, account_number, plan_name, balance, base_currency, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  const endpoints: TransferEndpoint[] = [];
  if (wallet) {
    endpoints.push({
      kind: "wallet",
      id: wallet.id,
      label: "Wallet",
      balance: Number(wallet.balance),
      currency: wallet.currency,
    });
  }
  for (const a of accounts ?? []) {
    endpoints.push({
      kind: "account",
      id: a.id,
      label: `${a.account_number} · ${a.plan_name}`,
      balance: Number(a.balance),
      currency: a.base_currency,
    });
  }
  return endpoints;
}

export type TransferInput = {
  fromKind: "wallet" | "account";
  fromId: string;
  toKind: "wallet" | "account";
  toId: string;
  amount: number;
  idempotencyKey: string;
};

export async function transferFunds(input: TransferInput): Promise<TransferResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to transfer funds." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (input.fromKind === input.toKind && input.fromId === input.toId) {
    return { ok: false, error: "Pick two different accounts." };
  }
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    return { ok: false, error: "Could not start the transfer — please retry." };
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.rpc("transfer_funds", {
    p_from_kind: input.fromKind,
    p_from_id: input.fromId,
    p_to_kind: input.toKind,
    p_to_id: input.toId,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    // Surface the RPC's own guard messages (insufficient balance, etc.) cleanly.
    const msg = error.message.replace(/^.*transfer_funds:\s*/i, "");
    return { ok: false, error: msg || "Transfer failed. Please try again." };
  }

  revalidatePath("/transfers");
  revalidatePath("/wallet");
  revalidatePath("/funds/history");
  return { ok: true, message: "Transfer completed." };
}
