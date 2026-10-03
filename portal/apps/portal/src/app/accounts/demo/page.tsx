import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@gio4x/ui";
import { LINKS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { DemoAccountForm } from "./demo-form";

export default async function DemoAccountPage() {
  const user = await getCurrentUser();
  const signedIn = !!user;

  return (
    <Shell title="New Demo Account">
      <PageHeader
        title="Create a Demo Account"
        subtitle="Practice with virtual money on real market prices. No KYC required."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardBody>
            <DemoAccountForm signedIn={signedIn} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3 text-xs text-steel">
            <p>Demo accounts use the same execution engine as live accounts — prices and slippage are real.</p>
            <p>Your demo balance is reset to the starting amount after 90 days of inactivity.</p>
            <p>
              You can have <strong className="text-navy">up to 5 active demo accounts</strong> at once.
            </p>
            <p className="border-t border-slate-100 pt-3">
              Ready for live trading?{" "}
              <Link href={LINKS.raptor.register} className="text-sky hover:underline" target="_blank" rel="noreferrer">
                Open a real account →
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
