/**
 * The places on the map of GIO4X, in three layers. Every one is read from data
 * the site already publishes:
 *
 *   offices   the two addresses in src/config/site.ts, and nothing else. They
 *             are the only two GIO4X has published with an address (see
 *             docs/WAITING-FOR-ABE.md, item C4: other office lists carried on
 *             earlier sites were not verified, so they are not shown).
 *   centres   the nine financial centres of src/lib/sessions.ts.
 *   banks     the central banks of src/data/knowledge.ts, each with its page.
 *
 * site.ts holds postal addresses, not coordinates. An office is placed at the
 * town its published address names (Ruislip; Egmore in Chennai), to two
 * decimal places of a degree: the town, not the building. The page says so.
 */
import { site } from "@/config/site";
import { centralBanks, type CentralBank } from "@/data/knowledge";
import { centres, type Centre } from "@/lib/sessions";

export type LayerKey = "offices" | "centres" | "banks";

export type Office = {
  label: string;
  /** the legal entity at this address, where the site states one */
  entity: string | null;
  lines: readonly string[];
  country: string;
  /** the town the marker stands on */
  town: string;
};

type Base = {
  id: string;
  /** the full name, as the list and the card give it */
  name: string;
  /** the few letters drawn beside the marker */
  mark: string;
  /** one line under the name in the list */
  sub: string;
  lat: number;
  lon: number;
  tz: string;
  /** which side of the marker the letters stand on, and a nudge up or down, so that neighbours never collide */
  left?: boolean;
  dy?: number;
};

export type Place = (Base & { layer: "offices"; office: Office }) | (Base & { layer: "centres"; centre: Centre }) | (Base & { layer: "banks"; bank: CentralBank });

const OFFICES: Place[] = [
  {
    id: "office-head",
    layer: "offices",
    name: "Head office",
    mark: "Head office",
    sub: "Ruislip, London",
    lat: 51.57,
    lon: -0.42,
    tz: "Europe/London",
    left: true,
    office: { label: "Head office", entity: site.legalName, lines: site.headOffice.lines, country: site.headOffice.country, town: "Ruislip" },
  },
  {
    id: "office-support",
    layer: "offices",
    name: "Support office",
    mark: "Support office",
    sub: "Egmore, Chennai",
    lat: 13.08,
    lon: 80.26,
    tz: "Asia/Kolkata",
    office: { label: "Support office", entity: null, lines: site.supportOffice.lines, country: site.supportOffice.country, town: "Egmore, Chennai" },
  },
];

const CENTRE_LEFT = new Set(["london", "dubai", "singapore"]);
const CENTRES: Place[] = centres.map((c) => ({
  id: `centre-${c.key}`,
  layer: "centres",
  name: c.city,
  mark: c.city,
  sub: c.venue,
  lat: c.lat,
  lon: c.lon,
  tz: c.tz,
  left: CENTRE_LEFT.has(c.key),
  centre: c,
}));

/** Frankfurt, Zurich and London stand close together, as do Washington and Ottawa. */
const BANK_PLACE: Record<string, { left?: boolean; dy?: number }> = {
  boe: { left: true },
  ecb: { dy: -5 },
  snb: { dy: 7 },
  fed: { dy: 5 },
  boc: { dy: -4 },
  rba: { left: true },
};
const BANKS: Place[] = centralBanks.map((b) => ({
  id: `bank-${b.slug}`,
  layer: "banks",
  name: b.name,
  mark: b.short,
  sub: `${b.currency} · ${b.city}`,
  lat: b.lat,
  lon: b.lon,
  tz: b.tz,
  ...BANK_PLACE[b.slug],
  bank: b,
}));

export const LAYERS: { key: LayerKey; label: string; /** for a narrow screen */ short: string; blurb: string; places: Place[]; view: { lon: number; lat: number } }[] = [
  { key: "offices", label: "Offices", short: "Offices", blurb: "The two offices GIO4X has published with an address.", places: OFFICES, view: { lon: 40, lat: 30 } },
  { key: "centres", label: "Financial centres", short: "Centres", blurb: "The nine centres whose regular hours the site’s clocks read.", places: CENTRES, view: { lon: 70, lat: 22 } },
  { key: "banks", label: "Central banks", short: "Banks", blurb: "The central banks the site covers, each with its own page.", places: BANKS, view: { lon: 10, lat: 28 } },
];

export const layerOf = (key: LayerKey) => LAYERS.find((l) => l.key === key) ?? LAYERS[0];
