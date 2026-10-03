import type { BookType } from "../types/enums";
import type { InterventionAction } from "../types/enums";
import type { RoutingDecision } from "../types/schemas";

// The trade server (GIO Raptor) is the muscle; DEALER-CORE is the brain. Every
// platform sits behind this one interface so the engines are platform-agnostic.

export interface BridgeOrderEvent {
  orderRef: string;
  accountId: string;
  symbol: string;
  side: "buy" | "sell";
  volumeLots: number;
  requestedPrice?: number;
  ts: string; // ISO
}

export interface Position {
  ticket: number;
  accountId: string;
  symbol: string;
  side: "buy" | "sell";
  volumeLots: number;
  openPrice: number;
  currentPrice?: number;
  book: BookType;
  lpId?: string | null;
  floatingPnl?: number;
  openedAt?: string;
}

export interface FillResult {
  ok: boolean;
  fillPrice?: number;
  ticket?: number;
  error?: string;
}

export interface BridgeHealth {
  ok: boolean;
  latencyMs?: number;
  lastSync?: string;
  message?: string;
}

// What the execution router tells the bridge to do with an order.
export type ExecutionInstruction =
  | { kind: "hold" }
  | { kind: "route_to_lp"; lpRef: string; decision: RoutingDecision }
  | { kind: "internalize"; decision: RoutingDecision };

export const ExecutionInstruction = {
  HOLD: { kind: "hold" } as ExecutionInstruction,
  routeToLP: (lpRef: string, decision: RoutingDecision): ExecutionInstruction => ({ kind: "route_to_lp", lpRef, decision }),
  internalize: (decision: RoutingDecision): ExecutionInstruction => ({ kind: "internalize", decision }),
};

export interface TradeServerBridge {
  // inbound
  onOrder(handler: (e: BridgeOrderEvent) => Promise<ExecutionInstruction>): void;
  syncPositions(): Promise<Position[]>;
  // outbound
  routeToLP(lpRef: string, order: object): Promise<FillResult>;
  internalize(order: object): Promise<FillResult>;
  placeHedge(order: object): Promise<FillResult>;
  applyBookAssignment(accountId: string, book: BookType): Promise<void>;
  applyDealerDecision(orderRef: string, action: InterventionAction, params?: object): Promise<void>;
  heartbeat(): Promise<BridgeHealth>;
}
