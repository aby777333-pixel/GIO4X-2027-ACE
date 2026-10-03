// Plain (non-"use server") module for settings constants + types so they can be
// imported by both the server action and client/server components. A "use server"
// file may only export async functions, so these can't live in settings-actions.ts.

export type Preferences = {
  density: string;
  sidebar: string;
  displayCurrency: string;
  defaultAccount: string;
  defaultLot: string;
  confirmTrades: string;
  privacyTradeData: boolean;
  privacyMarketing: boolean;
  privacyLeaderboard: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  density: "Comfortable",
  sidebar: "Auto (collapse on mobile)",
  displayCurrency: "USD",
  defaultAccount: "Ask each time",
  defaultLot: "0.10",
  confirmTrades: "Always",
  privacyTradeData: true,
  privacyMarketing: false,
  privacyLeaderboard: true,
};
