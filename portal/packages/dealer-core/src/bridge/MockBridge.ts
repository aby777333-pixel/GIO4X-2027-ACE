import type { BookType, InterventionAction } from "../types/enums";
import type {
  BridgeHealth, BridgeOrderEvent, ExecutionInstruction, FillResult, Position, TradeServerBridge,
} from "./TradeServerBridge";

// Deterministic in-memory bridge for tests + staging replay. Records every
// outbound call so engines can be asserted against, and can replay a recorded
// order tape through a registered handler.
export interface MockCall {
  method: string;
  args: unknown[];
  at: string;
}

export class MockBridge implements TradeServerBridge {
  public positions: Position[] = [];
  public calls: MockCall[] = [];
  public bookAssignments = new Map<string, BookType>();
  private handler: ((e: BridgeOrderEvent) => Promise<ExecutionInstruction>) | null = null;
  private clock: () => string;

  constructor(opts?: { positions?: Position[]; now?: () => string }) {
    this.positions = opts?.positions ?? [];
    // Injected clock keeps the bridge deterministic in tests (no Date.now()).
    this.clock = opts?.now ?? (() => "1970-01-01T00:00:00.000Z");
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args, at: this.clock() });
  }

  onOrder(handler: (e: BridgeOrderEvent) => Promise<ExecutionInstruction>): void {
    this.handler = handler;
  }

  // Drive a recorded order tape through the registered handler.
  async replay(tape: BridgeOrderEvent[]): Promise<ExecutionInstruction[]> {
    if (!this.handler) throw new Error("MockBridge.replay: no onOrder handler registered");
    const out: ExecutionInstruction[] = [];
    for (const e of tape) out.push(await this.handler(e));
    return out;
  }

  async syncPositions(): Promise<Position[]> {
    this.record("syncPositions");
    return [...this.positions];
  }
  async routeToLP(lpRef: string, order: object): Promise<FillResult> {
    this.record("routeToLP", lpRef, order);
    return { ok: true, ticket: this.calls.length, fillPrice: 0 };
  }
  async internalize(order: object): Promise<FillResult> {
    this.record("internalize", order);
    return { ok: true, ticket: this.calls.length, fillPrice: 0 };
  }
  async placeHedge(order: object): Promise<FillResult> {
    this.record("placeHedge", order);
    return { ok: true, ticket: this.calls.length, fillPrice: 0 };
  }
  async applyBookAssignment(accountId: string, book: BookType): Promise<void> {
    this.record("applyBookAssignment", accountId, book);
    this.bookAssignments.set(accountId, book);
  }
  async applyDealerDecision(orderRef: string, action: InterventionAction, params?: object): Promise<void> {
    this.record("applyDealerDecision", orderRef, action, params);
  }
  async heartbeat(): Promise<BridgeHealth> {
    this.record("heartbeat");
    return { ok: true, latencyMs: 0, lastSync: this.clock() };
  }
}
