"use client";

import type { ComponentType } from "react";
import type { LabKey } from "@/data/academy-labs";
import { CandleLab } from "./CandleLab";
import { LeverageLab } from "./LeverageLab";
import { MovingAverageLab } from "./MovingAverageLab";
import { PositionSizeLab } from "./PositionSizeLab";
import { StopLossLab } from "./StopLossLab";

/**
 * The exercise a lesson carries, by key (src/data/academy-labs.ts says which
 * lesson has which). Each is a self-contained client island: the lesson page
 * around it stays statically generated.
 */
const LABS: Record<LabKey, ComponentType> = {
  "stop-loss": StopLossLab,
  candle: CandleLab,
  "position-size": PositionSizeLab,
  leverage: LeverageLab,
  "moving-average": MovingAverageLab,
};

export function Lab({ lab }: { lab: LabKey }) {
  const Exercise = LABS[lab];
  return Exercise ? <Exercise /> : null;
}
