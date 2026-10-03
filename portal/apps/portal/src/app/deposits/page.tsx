// Deposits page — server component.
// Loads the current session + the user's wallets + the DB-driven deposit
// funding sources (bank accounts, crypto addresses) and hands them to the
// interactive DepositsClient. Renders for signed-out visitors too (they see
// the bank / crypto info but the submit buttons route to /auth/login).

import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { DEPOSIT_METHODS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  DepositsClient,
  type BankAccount,
  type CryptoNetworkOption,
  type DepositMethod,
  type WalletOption,
} from "./deposits-client";

// Funding sources may change without a deploy (admin edits the tables); render
// fresh on each request.
export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const user = await getCurrentUser();
  const supabase = getSupabaseServer();

  const [bankRes, cryptoRes, walletsRes] = await Promise.all([
    supabase
      .from("deposit_bank_accounts")
      .select(
        "id, region, label, beneficiary, bank, swift_code, iban, ifsc, account_number, reference_template, sort_order, is_active",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("deposit_crypto_addresses")
      .select(
        "id, network, symbol, address, min_confirmations, min_amount_usd, sort_order, is_active",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    user
      ? supabase
          .from("wallets")
          .select("id, wallet_id, currency, type, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<{
          id: string;
          wallet_id: string;
          currency: string;
          type: string;
          status: string;
        }> }),
  ]);

  const wallets: WalletOption[] = (walletsRes.data ?? []).map((w) => ({
    id: w.id,
    label: `${w.wallet_id} — ${w.type} · ${w.currency}`,
    currency: w.currency,
    ref: w.wallet_id,
  }));

  const bankAccounts: BankAccount[] = (bankRes.data ?? []).map((r) => ({
    id: r.id,
    region: r.region,
    label: r.label,
    beneficiary: r.beneficiary,
    bank: r.bank,
    swift: r.swift_code,
    iban: r.iban,
    ifsc: r.ifsc,
    account: r.account_number,
    referenceTemplate: r.reference_template,
  }));

  const cryptoNetworks: CryptoNetworkOption[] = (cryptoRes.data ?? []).map((r) => ({
    id: r.id,
    network: r.network,
    symbol: r.symbol,
    address: r.address,
    minConfirmations: r.min_confirmations,
    minAmountUsd: Number(r.min_amount_usd),
  }));

  const methods: DepositMethod[] = DEPOSIT_METHODS.map((m) => ({
    id: m.id,
    name: m.name,
    fee: m.fee,
    processing: m.processing,
  }));

  return (
    <Shell title="Deposits">
      <PageHeader
        title="Deposit Funds"
        subtitle="Choose a method and we'll credit the account within minutes."
      />
      <DepositsClient
        signedIn={!!user}
        wallets={wallets}
        methods={methods}
        bankAccounts={bankAccounts}
        cryptoNetworks={cryptoNetworks}
      />
    </Shell>
  );
}
