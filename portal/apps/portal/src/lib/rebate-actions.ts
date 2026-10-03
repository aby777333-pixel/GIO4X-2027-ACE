"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";
import { runDispatch } from "./events-actions";
import type { Enums } from "@gio4x/supabase";

type Ccy = Enums<"wallet_currency">;

// ---------------------------------------------------------------------------
// Client-side IB rebate: an IB claims their own accrued commission into their
// rebate (ib_commission) wallet, then transfers it to their main wallet to
// spend / withdraw. The money movement is in SECURITY DEFINER RPCs
// (claim_my_ib_commission, transfer_funds).
// ---------------------------------------------------------------------------

export type RebateResult = { ok: true; message: string } | { ok: false; error: string };

export type RebateSummary = {
  currency: string;
  unclaimed: number;       // accrued, not yet moved to the rebate wallet
  rebateBalance: number;   // sitting in the ib_commission wallet
  lifetime: number;        // total commission ever accrued
  payouts: Array<{ id: string; date: string; amount: number; status: string; ref: string }>;
};

export async function loadMyRebateSummary(currency = "USD"): Promise<RebateSummary> {
  const empty: RebateSummary = { currency, unclaimed: 0, rebateBalance: 0, lifetime: 0, payouts: [] };
  const user = await getCurrentUser();
  if (!user) return empty;
  const supabase = getSupabaseServer();

  const [{ data: ledger }, { data: wallet }] = await Promise.all([
    supabase
      .from("commission_ledger")
      .select("amount, settled")
      .eq("ib_user_id", user.id)
      .eq("currency", currency as Ccy),
    supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .eq("type", "ib_commission")
      .eq("currency", currency as Ccy)
      .maybeSingle(),
  ]);

  let unclaimed = 0;
  let lifetime = 0;
  for (const r of ledger ?? []) {
    const amt = Number(r.amount);
    lifetime += amt;
    if (!r.settled) unclaimed += amt;
  }

  let payouts: RebateSummary["payouts"] = [];
  if (wallet) {
    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("id, amount, status, created_at, type")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(12);
    payouts = (txs ?? []).map((t) => ({
      id: t.id,
      date: new Date(t.created_at).toISOString().slice(0, 10),
      amount: Number(t.amount),
      status: t.status,
      ref: t.id.slice(0, 8),
    }));
  }

  return {
    currency,
    unclaimed,
    rebateBalance: wallet ? Number(wallet.balance) : 0,
    lifetime,
    payouts,
  };
}

// Claim accrued commission into the rebate wallet.
export async function claimMyRebate(currency = "USD"): Promise<RebateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to claim your rebate." };

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("claim_my_ib_commission", {
    p_currency: currency as Ccy,
  });
  if (error) {
    return { ok: false, error: error.message.replace(/^.*claim_my_ib_commission:\s*/i, "") || "Could not claim." };
  }
  void runDispatch();
  revalidatePath("/ib/funds");
  revalidatePath("/ib");

  const claimed = Number(data ?? 0);
  if (claimed <= 0) return { ok: true, message: "No accrued commission to claim right now." };
  return { ok: true, message: `Claimed ${claimed.toFixed(2)} ${currency} into your rebate wallet.` };
}

// Move the whole rebate-wallet balance into the main wallet.
export async function transferRebateToWallet(currency = "USD"): Promise<RebateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to transfer your rebate." };
  const supabase = getSupabaseServer();

  const [{ data: rebateWallet }, { data: mainWallet }] = await Promise.all([
    supabase.from("wallets").select("id, balance").eq("user_id", user.id).eq("type", "ib_commission").eq("currency", currency as Ccy).maybeSingle(),
    supabase.from("wallets").select("id").eq("user_id", user.id).eq("type", "main").eq("currency", currency as Ccy).maybeSingle(),
  ]);

  if (!rebateWallet || Number(rebateWallet.balance) <= 0) {
    return { ok: false, error: "No rebate balance to transfer. Claim your commission first." };
  }
  if (!mainWallet) {
    return { ok: false, error: `You don't have a ${currency} main wallet to receive the transfer.` };
  }

  const amount = Number(rebateWallet.balance);
  const { error } = await supabase.rpc("transfer_funds", {
    p_from_kind: "wallet",
    p_from_id: rebateWallet.id,
    p_to_kind: "wallet",
    p_to_id: mainWallet.id,
    p_amount: amount,
    p_idempotency_key: `rebate-xfer-${crypto.randomUUID()}`,
  });
  if (error) {
    return { ok: false, error: error.message.replace(/^.*transfer_funds:\s*/i, "") || "Transfer failed." };
  }
  revalidatePath("/ib/funds");
  revalidatePath("/wallet");
  return { ok: true, message: `Transferred ${amount.toFixed(2)} ${currency} to your main wallet.` };
}
