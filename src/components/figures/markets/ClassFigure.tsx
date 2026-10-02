"use client";

import { useMemo } from "react";
import { Figure, type FigureDraw } from "../Figure";
import { drawBarrel, drawBasket, drawLedger, drawMirror, drawPair, makeRounds } from "./classScenes";
import { PHI } from "./kit";

/**
 * The asset-class pages, beside each class's own pane: what a unit of that
 * market is, in the words of the page. One figure for the template, drawn
 * differently for each class (the drawings are in classScenes.ts):
 *
 *   forex     two balls about a common centre, joined by a bar: a pair
 *   metals    one round for each metal listed: priced by the troy ounce
 *   indices   many points taking their places on one sphere: a basket
 *   energy    a barrel, turning under a lamp: quoted by the barrel
 *   equities  a lit block over glass and its outline below: a share, mirrored
 *   crypto    nodes passing one entry to each other: a public record
 *
 * Pointer: each drawing answers in its own way (the orbit tilts, the nearest
 * round turns to face you, the sphere opens, the lamp goes round the barrel,
 * the outline follows the block, the entry starts from the nearest node).
 */

export type ClassKind = "forex" | "metals" | "indices" | "energy" | "equities" | "crypto";

/** the shape each drawing is made for: wide beside a tall pane, compact beside a short one */
export const CLASS_RATIO: Record<ClassKind, number> = {
  forex: PHI * PHI,
  metals: 2.8,
  indices: 2.2,
  energy: 1.4,
  equities: 1.4,
  crypto: 1.4,
};

const FIXED: Record<Exclude<ClassKind, "metals">, FigureDraw> = {
  forex: drawPair,
  indices: drawBasket,
  energy: drawBarrel,
  equities: drawMirror,
  crypto: drawLedger,
};

export function ClassFigure({ kind, symbols = [] }: { kind: ClassKind; symbols?: string[] }) {
  const key = symbols.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draw = useMemo(() => (kind === "metals" ? makeRounds(symbols) : FIXED[kind]), [kind, key]);
  return <Figure draw={draw} ratio={CLASS_RATIO[kind]} />;
}
