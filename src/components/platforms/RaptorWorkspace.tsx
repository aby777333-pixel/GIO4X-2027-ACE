import type { RegionKey } from "@/data/platforms";

/**
 * The geometry of the Raptor page's interface study: nine areas of a trading
 * workspace, in a 960 × 600 box. The study itself is drawn by RaptorLive (a
 * canvas that moves and answers the pointer); the tour lays its numbered
 * buttons over the same areas. Both read their places from here.
 */
export const WORKSPACE = { w: 960, h: 600 } as const;

export const REGIONS: Record<RegionKey, { x: number; y: number; w: number; h: number }> = {
  workspace: { x: 0, y: 0, w: 560, h: 36 },
  account: { x: 560, y: 0, w: 400, h: 36 },
  explorer: { x: 0, y: 36, w: 200, h: 214 },
  watchlist: { x: 0, y: 250, w: 200, h: 350 },
  chart: { x: 200, y: 36, w: 520, h: 364 },
  positions: { x: 200, y: 400, w: 320, h: 200 },
  history: { x: 520, y: 400, w: 200, h: 200 },
  order: { x: 720, y: 36, w: 240, h: 300 },
  risk: { x: 720, y: 336, w: 240, h: 264 },
};
