import type { Scene } from "@/components/cockpit/engine";

/**
 * The instrument register. Each scene is its own chunk, fetched only by the
 * pages that show it; nothing here is in the shared bundle but this map.
 */
type Loader = () => Promise<{ default: Scene<never> | Scene<unknown> | Scene }>;

export const SCENES = {
  accounts: () => import("./accounts"),
  annunciator: () => import("./annunciator"),
  banks: () => import("./banks"),
  beacon: () => import("./beacon"),
  clock: () => import("./clock"),
  compare: () => import("./compare"),
  conditions: () => import("./conditions"),
  constellation: () => import("./constellation"),
  copy: () => import("./copy"),
  course: () => import("./course"),
  crypto: () => import("./crypto"),
  document: () => import("./document"),
  energy: () => import("./energy"),
  equities: () => import("./equities"),
  events: () => import("./events"),
  flightdeck: () => import("./flightdeck"),
  forex: () => import("./forex"),
  funding: () => import("./funding"),
  gateway: () => import("./gateway"),
  horizon: () => import("./horizon"),
  indices: () => import("./indices"),
  instrument: () => import("./instrument"),
  lexicon: () => import("./lexicon"),
  markets: () => import("./markets"),
  metals: () => import("./metals"),
  mt5: () => import("./mt5"),
  network: () => import("./network"),
  pamm: () => import("./pamm"),
  platforms: () => import("./platforms"),
  raptor: () => import("./raptor"),
  rosette: () => import("./rosette"),
  signal: () => import("./signal"),
  strength: () => import("./strength"),
  trading: () => import("./trading"),
  vault: () => import("./vault"),
} satisfies Record<string, Loader>;

export type SceneId = keyof typeof SCENES;
