"use client";

import { DEFAULT_BRANCHES } from "./stages";
import { TradeCanvas } from "./TradeCanvas";
import type { SceneTarget } from "./scene";

/**
 * One station of the Trade Anatomy scene, for the card on the Labs page: the
 * open position, with the day turning round it. Decorative; the card's text
 * says what the experiment is.
 */
const TARGET: SceneTarget = { stage: 4, branches: DEFAULT_BRANCHES, seq: 0 };

export function TradeStill() {
  return (
    <div className="on-night">
      <TradeCanvas target={TARGET} className="aspect-phi" />
    </div>
  );
}
