"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "./supabase-server";
import { getCurrentUser } from "./session";

export type CustomerActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const role = user.profile?.role;
  if (role !== "staff" && role !== "admin") return { user: null, error: "Staff access only." as const };
  return { user, error: null };
}

type RpcResult = { data: unknown; error: { message: string } | null };
async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const supabase = getSupabaseServer();
  const sb = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  };
  return sb.rpc(fn, args);
}

export type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  role: string;
  status: string;
  kyc_status: string;
  referral_code: string | null;
  created_at: string;
};

export async function loadCustomers(): Promise<CustomerRow[]> {
  const { user } = await requireStaff();
  if (!user) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, country, role, status, kyc_status, referral_code, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as unknown as CustomerRow[];
}

export type CustomerDetail = {
  profile: CustomerRow & { language: string | null; timezone: string | null };
  wallets: { wallet_id: string; currency: string; balance: number; type: string; status: string }[];
  accounts: {
    account_number: string;
    account_kind: string;
    base_currency: string;
    balance: number;
    equity: number;
    leverage: number;
    status: string;
  }[];
  kyc: { id: string; doc_type: string; status: string; file_name: string | null; created_at: string }[];
};

export async function loadCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const { user } = await requireStaff();
  if (!user) return null;
  const supabase = getSupabaseServer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, country, role, status, kyc_status, referral_code, created_at, language, timezone")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: wallets }, { data: accounts }, { data: kyc }] = await Promise.all([
    supabase.from("wallets").select("wallet_id, currency, balance, type, status").eq("user_id", id),
    supabase
      .from("trading_accounts")
      .select("account_number, account_kind, base_currency, balance, equity, leverage, status")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("kyc_documents")
      .select("id, doc_type, status, file_name, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);

  type W = { wallet_id: string; currency: string; balance: number; type: string; status: string };
  type A = CustomerDetail["accounts"][number];
  return {
    profile: profile as unknown as CustomerDetail["profile"],
    wallets: ((wallets ?? []) as unknown as W[]).map((w) => ({ ...w, balance: Number(w.balance ?? 0) })),
    accounts: ((accounts ?? []) as unknown as A[]).map((a) => ({
      ...a,
      balance: Number(a.balance ?? 0),
      equity: Number(a.equity ?? 0),
    })),
    kyc: (kyc ?? []) as unknown as CustomerDetail["kyc"],
  };
}

export async function setCustomerStatus(id: string, status: string): Promise<CustomerActionResult> {
  const { user, error } = await requireStaff();
  if (!user) return { ok: false, error };
  const { error: e } = await callRpc("staff_set_customer_status", { p_user_id: id, p_status: status });
  if (e) return { ok: false, error: e.message };
  revalidatePath(`/staff/customers/${id}`);
  revalidatePath("/staff/customers");
  return { ok: true, message: `Account ${status}.` };
}
