import type { ReactNode } from "react";
import type { AssetClass, Instrument } from "@/data/instruments";
import { ClassFigure } from "./ClassFigure";
import { HeroCompanion } from "./HeroCompanion";

/**
 * The companion of an asset-class page: the class's figure with one sentence
 * taken from that class's own description (data/instruments.ts), laid out to
 * suit the height of the pane it stands beside.
 */
const NOTES: Record<AssetClass["key"], { label: string; text: ReactNode; layout: "stack" | "beside" }> = {
  forex: {
    label: "Reading a quote",
    text: "Every quote is a pair: the base currency is priced in units of the quote currency.",
    layout: "stack",
  },
  metals: {
    label: "By the ounce",
    text: "Each metal is priced per troy ounce in US dollars and traded on margin as a pair, like a currency pair.",
    layout: "stack",
  },
  indices: {
    label: "One instrument",
    text: "An index measures a basket of shares, so one instrument gives exposure to a whole market. It is traded as a CFD: you do not own the underlying shares.",
    layout: "stack",
  },
  energy: {
    label: "By the barrel",
    text: "Brent is the reference for seaborne crude and WTI is the US benchmark. Both are quoted in US dollars per barrel.",
    layout: "beside",
  },
  equities: {
    label: "A mirror",
    text: "A share CFD mirrors the share price without conferring ownership, voting rights or delivery of the stock.",
    layout: "beside",
  },
  crypto: {
    label: "Public record",
    text: "Cryptocurrencies are recorded on public blockchains. A CFD gives exposure to the price without holding the coins or a wallet.",
    layout: "beside",
  },
};

export function ClassCompanion({ cls, list }: { cls: AssetClass; list: Instrument[] }) {
  const note = NOTES[cls.key];
  // the metals are named on their rounds by the first half of their symbols (XAU, XAG, ...)
  const symbols = list.map((i) => i.symbol.split("/")[0]);
  return (
    <HeroCompanion layout={note.layout} label={note.label} figure={<ClassFigure kind={cls.key} symbols={symbols} />}>
      {note.text}
    </HeroCompanion>
  );
}
