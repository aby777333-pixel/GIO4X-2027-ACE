import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardBody, Button } from "@gio4x/ui";
import { Banknote, Bitcoin, CreditCard, Plus, ShieldCheck } from "lucide-react";

type Method = { id: number; type: "card" | "bank" | "crypto"; label: string; detail: string; primary: boolean; verified: boolean };

const methods: Method[] = [
  { id: 1, type: "card", label: "Visa **** 4421", detail: "Expires 09/28 · Used for last deposit", primary: true, verified: true },
  { id: 2, type: "crypto", label: "USDT (TRC20)", detail: "TQn9Y2khEsLJ...cbLSE", primary: false, verified: true },
  { id: 3, type: "bank", label: "ICICI Bank — XXXX8421", detail: "IFSC ICIC0000001 · 1–3 business days", primary: false, verified: true },
  { id: 4, type: "card", label: "Mastercard **** 9982", detail: "Expires 02/27 · Awaiting AML check", primary: false, verified: false },
];

const iconFor = { card: CreditCard, bank: Banknote, crypto: Bitcoin } as const;

export default function BankAccountsPage() {
  return (
    <Shell title="Payment Methods">
      <PageHeader
        title="Payment Methods"
        subtitle="Cards, bank accounts, and crypto wallets you can use to deposit and withdraw."
        actions={
          <Link href="/deposits">
            <Button variant="primary">
              <Plus size={14} className="mr-1" /> Add new method
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {methods.map((m) => {
          const Icon = iconFor[m.type];
          return (
            <Card key={m.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky/10 text-sky">
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-navy">{m.label}</div>
                      <div className="text-[11px] text-steel">{m.detail}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {m.primary ? <StatusBadge tone="info">Primary</StatusBadge> : null}
                    <StatusBadge tone={m.verified ? "success" : "warning"}>
                      {m.verified ? "Verified" : "Pending"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-steel">
                  <span>{m.primary ? "Primary payout method" : "Verified destination"}</span>
                  <Link href="/withdrawals" className="font-medium text-sky hover:underline">
                    Use for withdrawal →
                  </Link>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-amber-200 bg-amber-50">
        <CardBody className="flex items-center gap-3">
          <ShieldCheck className="text-amber-700" />
          <div className="text-xs text-amber-900">
            <strong>AML rule:</strong> First withdrawal must go to the same method used for your first deposit.
            After that, you can withdraw to any verified method.
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}
