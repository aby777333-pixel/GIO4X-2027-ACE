import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X: The Gentleman’s Brokerage House";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default share card, inherited by every route that does not define its own. */
export default function Image() {
  return renderOg({ eyebrow: "MetaTrader 5 × 777 Raptor", title: "Global markets. Gentlemanly standards." });
}
