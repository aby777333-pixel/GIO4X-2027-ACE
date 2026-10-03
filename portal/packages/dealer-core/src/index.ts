// @gio4x/dealer-core — the wired nervous system of the brokerage.
// Pure, testable engines. UI and edge functions are thin shells around this.

export * from "./types/enums";
export * from "./types/schemas";
export * from "./types/rows";
export * from "./bridge/TradeServerBridge";
export * from "./bridge/MockBridge";

export * from "./scope/ConfigCache";
export * from "./scope/resolve";
export * from "./routing/route";
export * from "./routing/lp";
export * from "./execution/router";
export * from "./exposure/aggregate";
export * from "./risk/classify";
export * from "./risk/score";
export * from "./switching/switch";
export * from "./hedging/hedge";
export * from "./surveillance/detectors";
export * from "./revenue/attribute";
