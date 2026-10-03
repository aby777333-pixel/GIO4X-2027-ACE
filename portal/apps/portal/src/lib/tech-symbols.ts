import { getSuperAdmin } from "./tech-hub-console";
import { terminalSelect } from "./tech-terminal";

export type Instrument = {
  symbol: string; description: string; type: string; is_active: boolean | null;
  spread_markup: number | null; commission_per_lot: number | null; min_lot: number; max_lot: number; lot_step: number;
  contract_size: number; margin_rate: number | null; session_hours: string | null;
};

// Live symbols from the terminal (source of truth the order engine reads).
export async function loadSymbols(): Promise<Instrument[]> {
  const { user, isSuper } = await getSuperAdmin();
  if (!user || !isSuper) return [];
  const data = await terminalSelect<Instrument>(
    "instruments?select=symbol,description,type,is_active,spread_markup,commission_per_lot,min_lot,max_lot,lot_step,contract_size,margin_rate,session_hours&order=symbol.asc",
  );
  return data ?? [];
}
