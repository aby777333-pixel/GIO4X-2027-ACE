import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { getCurrentUser } from "@/lib/session";
import { loadTransferEndpoints } from "@/lib/transfers-actions";
import { TransferForm } from "./transfer-form";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await getCurrentUser();
  const endpoints = user ? await loadTransferEndpoints() : [];

  return (
    <Shell title="Transfers">
      <PageHeader
        title="Internal Transfers"
        subtitle="Move funds instantly between your Wallet and trading accounts."
      />

      {!user ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-steel">
            <Link href="/auth/login?redirect=/transfers" className="font-medium text-sky hover:underline">
              Sign in
            </Link>{" "}
            to transfer between your wallet and trading accounts.
          </CardBody>
        </Card>
      ) : endpoints.length < 2 ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-steel">
            You need at least two endpoints to transfer. Your wallet is ready —{" "}
            <Link href="/accounts" className="font-medium text-sky hover:underline">
              open a trading account
            </Link>{" "}
            to move funds into it.
          </CardBody>
        </Card>
      ) : (
        <TransferForm endpoints={endpoints} />
      )}
    </Shell>
  );
}
