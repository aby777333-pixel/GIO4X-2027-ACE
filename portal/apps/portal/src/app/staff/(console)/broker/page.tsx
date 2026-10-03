import { listBrokerInstruments, listBrokerAudit, listTradingBlocks } from "@/lib/broker-actions";
import { BrokerControls } from "./broker-client";

export const dynamic = "force-dynamic";

// Broker Control Center (enhancement prompt §16): per-symbol trading
// controls + trading blocks on the LIVE Raptor terminal, staff-only,
// fully audited.
export default async function StaffBrokerPage() {
  const [instruments, audit, blocks] = await Promise.all([
    listBrokerInstruments(), listBrokerAudit(), listTradingBlocks(),
  ]);
  return <BrokerControls instruments={instruments} audit={audit} blocks={blocks} />;
}
