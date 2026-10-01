import { getAssetClass, getInstrument, instruments } from "@/data/instruments";
import { OG_CONTENT_TYPE, OG_SIZE, renderOg } from "@/lib/og";

export const alt = "GIO4X Markets";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamicParams = false;

export function generateStaticParams() {
  return instruments.map((i) => ({ class: i.class, instrument: i.slug }));
}

/** Share card for an instrument: symbol and name only. Never a price. */
export default async function Image({ params }: { params: Promise<{ class: string; instrument: string }> }) {
  const { class: cls, instrument } = await params;
  const i = getInstrument(cls, instrument);
  return renderOg({ eyebrow: `Markets · ${getAssetClass(cls)?.name ?? "GIO4X"}`, title: i?.symbol ?? "GIO4X Markets", detail: i?.name });
}
