import { loadStaffTrades } from "@/lib/staff-trades-actions";
import { StaffTradeLog } from "./trades-client";

export const dynamic = "force-dynamic";

export default async function StaffTradesPage() {
  const trades = await loadStaffTrades();
  return <StaffTradeLog trades={trades} />;
}
