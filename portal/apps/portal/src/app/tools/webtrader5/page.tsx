import { redirect } from "next/navigation";
import { LINKS } from "@/lib/constants";

// MetaTrader 5 is provided for again (trading_accounts.platform, the platform_mt5 flag) but is
// not switched on: until an MT5 server is connected, 777 Raptor is the execution platform.
// Existing bookmarks land on the Raptor terminal instead of 404-ing.
export default function Page() {
  redirect(LINKS.raptor.terminal);
}
