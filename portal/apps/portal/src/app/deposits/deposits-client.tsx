"use client";

// Deposits client — interactive surface for the /deposits page.
// All inputs are state-bound; submit goes through the wired `requestDeposit`
// server action (which calls public.process_wallet_transaction). Bank account
// details and crypto deposit addresses are passed in from the server (loaded
// from deposit_bank_accounts / deposit_crypto_addresses) so admin edits to
// those tables propagate without a code change.

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Tabs } from "@/components/Tabs";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import {
  Banknote,
  Bitcoin,
  Check,
  Copy,
  CreditCard,
  QrCode,
  Shield,
  Smartphone,
  Wallet,
} from "lucide-react";
import { requestDeposit } from "@/lib/wallet-actions";

// ---------------------------------------------------------------------------
// Types — kept loose at this boundary so we don't drag DB-row shapes into the
// client bundle. Page.tsx adapts the supabase rows into these.
// ---------------------------------------------------------------------------
export type DepositMethod = { id: string; name: string; fee: string; processing: string };

export type WalletOption = { id: string; label: string; currency: string; ref: string };

export type BankAccount = {
  id: string;
  region: string;
  label: string;
  beneficiary: string;
  bank: string;
  swift: string | null;
  iban: string | null;
  ifsc: string | null;
  account: string;
  referenceTemplate: string;
};

export type CryptoNetworkOption = {
  id: string;
  network: string;
  symbol: string;
  address: string;
  minConfirmations: number;
  minAmountUsd: number;
};

type TabId = "card" | "crypto" | "bank";

// Method tiles map to one of the three tabs. UPI rides the bank flow; Skrill
// rides the card flow until those gateways get their own UI.
const METHOD_TAB: Record<string, TabId> = {
  card: "card",
  bank: "bank",
  crypto: "crypto",
  upi: "bank",
  skrill: "card",
};

const ICON_FOR: Record<string, ReactNode> = {
  card: <CreditCard size={18} />,
  bank: <Banknote size={18} />,
  crypto: <Bitcoin size={18} />,
  upi: <Smartphone size={18} />,
  skrill: <Wallet size={18} />,
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export function DepositsClient({
  signedIn,
  wallets,
  methods,
  bankAccounts,
  cryptoNetworks,
}: {
  signedIn: boolean;
  wallets: WalletOption[];
  methods: DepositMethod[];
  bankAccounts: BankAccount[];
  cryptoNetworks: CryptoNetworkOption[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("card");

  return (
    <>
      <div className="mb-5 grid gap-2 md:grid-cols-3 lg:grid-cols-5">
        {methods.map((m) => {
          const target = METHOD_TAB[m.id] ?? "card";
          const isActive = activeTab === target;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(target)}
              aria-pressed={isActive}
              className={`flex items-start gap-3 rounded-glass border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-sky/30 ${
                isActive
                  ? "border-sky/60 bg-sky/5"
                  : "border-slate-200 bg-white hover:border-sky/40"
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky/10 text-sky">
                {ICON_FOR[m.id]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-navy">{m.name}</div>
                <div className="mt-0.5 text-[11px] text-steel">
                  Fee {m.fee} · {m.processing}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardBody>
          <Tabs
            value={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            tabs={[
              {
                id: "card",
                label: "Card",
                content: <CardPanel signedIn={signedIn} wallets={wallets} />,
              },
              {
                id: "crypto",
                label: "Crypto",
                content: (
                  <CryptoPanel
                    signedIn={signedIn}
                    wallets={wallets}
                    networks={cryptoNetworks}
                  />
                ),
              },
              {
                id: "bank",
                label: "Bank Transfer",
                content: (
                  <BankPanel
                    signedIn={signedIn}
                    wallets={wallets}
                    accounts={bankAccounts}
                  />
                ),
              },
            ]}
          />
        </CardBody>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Card panel
// ---------------------------------------------------------------------------
function CardPanel({ signedIn, wallets }: { signedIn: boolean; wallets: WalletOption[] }) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to deposit to your real wallet.");
      return;
    }
    const fd = new FormData();
    fd.set("wallet_id", walletId);
    fd.set("amount", String(amount));
    fd.set("gateway", "card");
    fd.set("gateway_ref", cardNumber ? `card:****${cardNumber.replace(/\s+/g, "").slice(-4)}` : "card");
    startTransition(async () => {
      const res = await requestDeposit(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Deposit recorded — pending settlement.");
        setCardNumber("");
        setExp("");
        setCvv("");
        setHolder("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <WalletPicker
          signedIn={signedIn}
          wallets={wallets}
          value={walletId}
          onChange={setWalletId}
        />

        <AmountInput value={amount} onChange={setAmount} />

        <div>
          <label className="block text-xs font-medium text-steel">Card details</label>
          <div className="mt-1 space-y-2">
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card number"
              autoComplete="cc-number"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                placeholder="MM / YY"
                autoComplete="cc-exp"
                inputMode="numeric"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
              />
              <input
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder="CVV"
                autoComplete="cc-csc"
                inputMode="numeric"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
              />
            </div>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="Cardholder name"
              autoComplete="cc-name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky/60"
            />
          </div>
        </div>

        <FeedbackBlock error={error} success={success} />

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-[11px] text-steel">
            <Shield size={14} className="text-sky" /> Encrypted submission · reviewed before funds post
          </div>
          {signedIn ? (
            <Button variant="primary" type="submit" disabled={pending || !walletId}>
              {pending ? "Submitting…" : `Deposit $${amount.toLocaleString()}`}
            </Button>
          ) : (
            <Link
              href="/auth/login?redirect=/deposits"
              className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
            >
              Sign in to deposit
            </Link>
          )}
        </div>
      </div>

      <SummaryCard amount={amount} subtitle="Funds appear in your trading account within 1–2 minutes after card authorisation." />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Crypto panel
// ---------------------------------------------------------------------------
function CryptoPanel({
  signedIn,
  wallets,
  networks,
}: {
  signedIn: boolean;
  wallets: WalletOption[];
  networks: CryptoNetworkOption[];
}) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [selectedId, setSelectedId] = useState(networks[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => networks.find((n) => n.id === selectedId) ?? networks[0],
    [networks, selectedId],
  );

  // Generate QR locally — no third-party URL leaking the deposit address.
  useEffect(() => {
    if (!showQr || !selected) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(selected.address, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, selected]);

  async function copyAddress() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API blocked — silently no-op; the field is selectable.
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to record this deposit against your wallet.");
      return;
    }
    if (!selected) {
      setError("Pick a network.");
      return;
    }
    if (amount < selected.minAmountUsd) {
      setError(`Minimum deposit on ${selected.network} is $${selected.minAmountUsd}.`);
      return;
    }
    const fd = new FormData();
    fd.set("wallet_id", walletId);
    fd.set("amount", String(amount));
    fd.set("gateway", "crypto");
    fd.set("gateway_ref", `${selected.network}:${selected.address}`);
    startTransition(async () => {
      const res = await requestDeposit(fd);
      if (res.ok) {
        setSuccess(
          `Intent recorded for ${selected.network}. Send to the address above; we'll credit after ${selected.minConfirmations} confirmation${selected.minConfirmations === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (networks.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        No crypto networks are currently active. Try the Card or Bank Transfer
        tab while we configure crypto rails.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-steel">Network</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {networks.map((n) => {
              const isSelected = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(n.id);
                    setShowQr(false);
                  }}
                  aria-pressed={isSelected}
                  className={`rounded-lg border px-3 py-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-sky/30 ${
                    isSelected
                      ? "border-sky/60 bg-sky/5 text-navy"
                      : "border-slate-200 text-navy hover:border-sky/40"
                  }`}
                >
                  {n.network}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-steel">Deposit address</label>
          <div
            onClick={copyAddress}
            className="mt-1 cursor-pointer break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-navy transition hover:border-sky/40"
            title="Click to copy"
          >
            {selected?.address}
          </div>
          <div className="mt-2 flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={copyAddress}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition ${
                copied ? "bg-emerald-50 text-emerald-700" : "bg-sky/10 text-sky hover:bg-sky/20"
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-steel hover:bg-slate-200"
            >
              <QrCode size={12} /> {showQr ? "Hide QR" : "Show QR"}
            </button>
          </div>
          {showQr ? (
            <div className="mt-3 inline-block rounded-lg border border-slate-200 bg-white p-3">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt={`QR code for ${selected?.network} address`} width={200} height={200} />
              ) : (
                <div className="grid h-[200px] w-[200px] place-items-center text-[11px] text-steel">
                  Rendering QR…
                </div>
              )}
            </div>
          ) : null}
        </div>

        <WalletPicker
          signedIn={signedIn}
          wallets={wallets}
          value={walletId}
          onChange={setWalletId}
        />

        <AmountInput value={amount} onChange={setAmount} />

        <div className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          Send only on <span className="font-semibold">{selected?.network}</span>. Wrong-network
          deposits cannot be recovered.
        </div>

        <FeedbackBlock error={error} success={success} />

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-[11px] text-steel">
            <Shield size={14} className="text-sky" /> Credited after {selected?.minConfirmations} confirmation{selected && selected.minConfirmations === 1 ? "" : "s"}.
          </div>
          {signedIn ? (
            <Button variant="primary" type="submit" disabled={pending || !walletId || !selected}>
              {pending ? "Recording…" : "Record deposit intent"}
            </Button>
          ) : (
            <Link
              href="/auth/login?redirect=/deposits"
              className="rounded-lg bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-light"
            >
              Sign in to record
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Network details</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-steel">Symbol</span>
              <span className="font-medium text-navy">{selected?.symbol}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-steel">Confirmations</span>
              <span className="font-medium text-navy">{selected?.minConfirmations}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-steel">Minimum</span>
              <span className="font-medium text-navy">${selected?.minAmountUsd.toLocaleString()}</span>
            </li>
            <li className="flex justify-between border-t border-slate-100 pt-2 text-base">
              <span className="font-semibold text-navy">You will receive</span>
              <span className="font-bold text-navy">${amount.toLocaleString()}</span>
            </li>
          </ul>
          <div className="mt-4 text-[11px] text-steel-light">
            We credit at the live rate when the deposit reaches the network minimum
            confirmations.
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bank panel
// ---------------------------------------------------------------------------
function BankPanel({
  signedIn,
  wallets,
  accounts,
}: {
  signedIn: boolean;
  wallets: WalletOption[];
  accounts: BankAccount[];
}) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [regionId, setRegionId] = useState(accounts[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => accounts.find((a) => a.id === regionId) ?? accounts[0],
    [accounts, regionId],
  );

  const walletRef = useMemo(() => wallets.find((w) => w.id === walletId)?.ref ?? "", [wallets, walletId]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField((c) => (c === key ? null : c)), 1500);
    } catch {
      // ignore
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!signedIn) {
      setError("Sign in to record this bank transfer intent.");
      return;
    }
    if (!selectedRegion) {
      setError("Pick a destination bank.");
      return;
    }
    const fd = new FormData();
    fd.set("wallet_id", walletId);
    fd.set("amount", String(amount));
    fd.set("gateway", "bank");
    fd.set("gateway_ref", `${selectedRegion.region}:${selectedRegion.account}`);
    startTransition(async () => {
      const res = await requestDeposit(fd);
      if (res.ok) {
        setSuccess(
          `Intent recorded. Wire to the details above and include reference ${formatReference(selectedRegion.referenceTemplate, walletRef)} so we can reconcile.`,
        );
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        No bank accounts are currently published. Try Card or Crypto, or contact
        support to wire manually.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <WalletPicker
          signedIn={signedIn}
          wallets={wallets}
          value={walletId}
          onChange={setWalletId}
        />
        <div>
          <label className="block text-xs font-medium text-steel">Amount (USD)</label>
          <div className="mt-1 flex items-center rounded-lg border border-slate-200 px-3 py-2 focus-within:border-sky/60">
            <span className="mr-2 text-steel">$</span>
            <input
              type="number"
              min={10}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        {signedIn ? (
          <Button variant="primary" type="submit" disabled={pending || !walletId || !selectedRegion}>
            {pending ? "Recording…" : "Record wire intent"}
          </Button>
        ) : (
          <Link
            href="/auth/login?redirect=/deposits"
            className="rounded-lg bg-sky px-4 py-2 text-center text-xs font-semibold text-white transition hover:bg-sky-light"
          >
            Sign in
          </Link>
        )}
      </form>

      {accounts.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const isSel = a.id === regionId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setRegionId(a.id)}
                aria-pressed={isSel}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-sky/30 ${
                  isSel
                    ? "border-sky/60 bg-sky/5 text-navy"
                    : "border-slate-200 text-steel hover:border-sky/40 hover:text-navy"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <FeedbackBlock error={error} success={success} />

      <Card>
        <CardBody>
          <div className="grid gap-6 lg:grid-cols-2">
            {accounts.map((a) => (
              <div key={a.id}>
                <h4 className="text-sm font-semibold text-navy">{a.label}</h4>
                <dl className="mt-3 space-y-2 text-sm">
                  <BankRow label="Beneficiary" value={a.beneficiary} />
                  <BankRow label="Bank" value={a.bank} />
                  {a.swift ? (
                    <BankRow
                      label="SWIFT"
                      value={a.swift}
                      mono
                      onCopy={() => copyValue(`${a.id}:swift`, a.swift!)}
                      copied={copiedField === `${a.id}:swift`}
                    />
                  ) : null}
                  {a.iban ? (
                    <BankRow
                      label="IBAN"
                      value={a.iban}
                      mono
                      onCopy={() => copyValue(`${a.id}:iban`, a.iban!)}
                      copied={copiedField === `${a.id}:iban`}
                    />
                  ) : null}
                  {a.ifsc ? (
                    <BankRow
                      label="IFSC"
                      value={a.ifsc}
                      mono
                      onCopy={() => copyValue(`${a.id}:ifsc`, a.ifsc!)}
                      copied={copiedField === `${a.id}:ifsc`}
                    />
                  ) : null}
                  <BankRow
                    label="Account"
                    value={a.account}
                    mono
                    onCopy={() => copyValue(`${a.id}:account`, a.account)}
                    copied={copiedField === `${a.id}:account`}
                  />
                  <BankRow
                    label="Reference"
                    value={formatReference(a.referenceTemplate, walletRef)}
                    mono
                    onCopy={() =>
                      copyValue(`${a.id}:reference`, formatReference(a.referenceTemplate, walletRef))
                    }
                    copied={copiedField === `${a.id}:reference`}
                  />
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-sky/5 px-3 py-2 text-[11px] text-navy">
            Always include the reference code. Without it, deposits take longer to reconcile.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function WalletPicker({
  signedIn,
  wallets,
  value,
  onChange,
}: {
  signedIn: boolean;
  wallets: WalletOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel">Destination wallet</label>
      {wallets.length === 0 ? (
        <div className="mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-steel">
          {signedIn
            ? "No wallets yet — one is created with your account."
            : "Sign in to see your wallets."}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky/60"
        >
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function AmountInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel">Amount (USD)</label>
      <div className="mt-1 flex items-center rounded-lg border border-slate-200 px-3 py-2 focus-within:border-sky/60">
        <span className="mr-2 text-steel">$</span>
        <input
          type="number"
          min={10}
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {[50, 100, 250, 500, 1000, 5000].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-steel transition hover:border-sky/40 hover:text-navy"
          >
            ${v}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ amount, subtitle }: { amount: number; subtitle: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-steel">Deposit amount</span>
            <span className="font-medium text-navy">${amount.toLocaleString()}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-steel">Fee</span>
            <span className="font-medium text-success">$0.00</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-steel">Conversion</span>
            <span className="font-medium text-navy">1:1</span>
          </li>
          <li className="flex items-center justify-between border-t border-slate-100 pt-2 text-base">
            <span className="font-semibold text-navy">You will receive</span>
            <span className="font-bold text-navy">${amount.toLocaleString()}</span>
          </li>
        </ul>
        <div className="mt-4 rounded-lg bg-sky/5 px-3 py-2 text-[11px] text-navy">{subtitle}</div>
      </CardBody>
    </Card>
  );
}

function BankRow({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-steel">{label}</dt>
      <dd className={`flex items-center gap-2 ${mono ? "font-mono" : ""} text-navy`}>
        <span className="break-all text-right">{value}</span>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className={`inline-flex items-center rounded-md p-1 transition ${
              copied ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-steel hover:bg-slate-200"
            }`}
            title={copied ? "Copied" : "Copy"}
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function FeedbackBlock({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null;
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        {error}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
      {success}
    </div>
  );
}

function formatReference(template: string, walletRef: string): string {
  return template.replaceAll("{wallet}", walletRef || "—");
}
