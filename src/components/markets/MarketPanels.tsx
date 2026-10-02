import Link from "next/link";
import type { ReactNode } from "react";
import { Head } from "@/components/markets/Head";
import { TradingViewWidget } from "@/components/markets/TradingViewWidget";
import type { AssetClassKey } from "@/data/instruments";

/**
 * The TradingView panels this site places, each with the settings that were
 * checked against TradingView's own host. Symbols use TradingView's names; a
 * symbol is listed here only after it was seen to return a quote in the frame.
 */

const MAJORS = ["EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"];

/** Countries behind the eight major currencies, plus China. */
const CALENDAR_COUNTRIES = "us,eu,gb,jp,ch,au,ca,nz,cn";

const FOREX = [
  { s: "FX:EURUSD", d: "EUR/USD" },
  { s: "FX:GBPUSD", d: "GBP/USD" },
  { s: "FX:USDJPY", d: "USD/JPY" },
  { s: "FX:USDCHF", d: "USD/CHF" },
  { s: "FX:AUDUSD", d: "AUD/USD" },
  { s: "FX:USDCAD", d: "USD/CAD" },
];
const INDICES = [
  { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
  { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
  { s: "FOREXCOM:DJI", d: "Dow Jones 30" },
  { s: "FOREXCOM:UKXGBP", d: "FTSE 100" },
  { s: "FOREXCOM:GRXEUR", d: "DAX 40" },
  { s: "FOREXCOM:JPXJPY", d: "Nikkei 225" },
];
const METALS = [
  { s: "OANDA:XAUUSD", d: "Gold" },
  { s: "OANDA:XAGUSD", d: "Silver" },
  { s: "OANDA:XPTUSD", d: "Platinum" },
  { s: "OANDA:XPDUSD", d: "Palladium" },
];
const ENERGY = [
  { s: "TVC:UKOIL", d: "Brent crude" },
  { s: "TVC:USOIL", d: "WTI crude" },
  { s: "CAPITALCOM:NATURALGAS", d: "Natural gas" },
];
const CRYPTO = [
  { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
  { s: "BITSTAMP:ETHUSD", d: "Ethereum" },
  { s: "COINBASE:SOLUSD", d: "Solana" },
  { s: "BITSTAMP:XRPUSD", d: "XRP" },
];

const tab = (title: string, symbols: { s: string; d: string }[]) => ({ title, originalTitle: title, symbols });
const quotes = (name: string, symbols: { s: string; d: string }[]) => ({ name, originalName: name, symbols: symbols.map((x) => ({ name: x.s, displayName: x.d })) });

const HEATMAP = { symbolUrl: "", hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, blockColor: "change" };

/** The dated economic calendar. `compact` is the short, high-importance view for the Morning Room. */
export function EconomicCalendar({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <TradingViewWidget
      kind="events"
      subject="calendar"
      title={compact ? "Economic calendar: high-importance releases" : "Economic calendar"}
      what="the economic calendar"
      height={compact ? 420 : 610}
      mobileHeight={compact ? 420 : 550}
      settings={{ importanceFilter: compact ? "1" : "0,1", countryFilter: CALENDAR_COUNTRIES }}
      note={`${compact ? "High-importance" : "Medium- and high-importance"} releases for the United States, the euro area, the United Kingdom, Japan, Switzerland, Australia, Canada, New Zealand and China. TradingView shows the times in your device’s time zone.`}
      className={className}
    />
  );
}

export function MarketOverviewPanel() {
  return (
    <TradingViewWidget
      kind="market-overview"
      title="Market overview: forex, indices, commodities, crypto"
      what="the market overview"
      height={610}
      mobileHeight={550}
      settings={{
        dateRange: "1D",
        showChart: true,
        showSymbolLogo: true,
        showFloatingTooltip: false,
        tabs: [tab("Forex", FOREX), tab("Indices", INDICES), tab("Commodities", [...METALS.slice(0, 2), ...ENERGY]), tab("Crypto", CRYPTO)],
      }}
      note="Symbols are TradingView’s own and come from several venues; they are not GIO4X’s instruments or contract specifications."
    />
  );
}

export function TickerTapePanel() {
  return (
    <TradingViewWidget
      kind="ticker-tape"
      compact
      title="Ticker tape"
      what="the ticker tape"
      height={60}
      mobileHeight={76}
      settings={{
        showSymbolLogo: true,
        displayMode: "adaptive",
        symbols: [...FOREX.slice(0, 3), METALS[0], ENERGY[0], INDICES[0], CRYPTO[0]].map((x) => ({ proName: x.s, title: x.d })),
      }}
    />
  );
}

export function ForexHeatMap({ note }: { note?: string }) {
  return (
    <TradingViewWidget
      kind="forex-heat-map"
      title="Forex heat map: the eight majors against each other"
      what="the forex heat map"
      height={420}
      minWidth={680}
      settings={{ currencies: MAJORS }}
      note={note ?? "Each cell is the day’s percentage change of the row currency against the column currency, as TradingView calculates it."}
    />
  );
}

export function ForexCrossRates() {
  return (
    <TradingViewWidget
      kind="forex-cross-rates"
      title="Forex cross rates: the eight majors"
      what="the forex cross rates"
      height={420}
      minWidth={680}
      settings={{ currencies: MAJORS }}
      note="Each cell is TradingView’s rate for one unit of the row currency in the column currency."
    />
  );
}

/** Which panels a class page carries, and the words around them. */
const CLASS_PANELS: Partial<Record<AssetClassKey, { lead: string; panels: ReactNode }>> = {
  forex: {
    lead: "TradingView’s intraday view of the eight major currencies: how each has moved against the others today, and the cross rate for every pair.",
    panels: (
      <>
        <ForexHeatMap />
        <ForexCrossRates />
      </>
    ),
  },
  metals: {
    lead: "TradingView’s quotes for the four precious metals against the US dollar.",
    panels: (
      <TradingViewWidget
        kind="market-quotes"
        title="Precious metals quotes"
        what="the metals quotes"
        height={280}
        mobileHeight={300}
        minWidth={600}
        settings={{ showSymbolLogo: true, symbolsGroups: [quotes("Precious metals", METALS)] }}
        note="Spot symbols from TradingView’s data partners, in US dollars per troy ounce."
      />
    ),
  },
  indices: {
    lead: "TradingView’s quotes for six widely followed stock indices.",
    panels: (
      <TradingViewWidget
        kind="market-quotes"
        title="Stock index quotes"
        what="the index quotes"
        height={310}
        minWidth={600}
        settings={{ showSymbolLogo: true, symbolsGroups: [quotes("Indices", INDICES)] }}
        note="These are index CFD symbols from one of TradingView’s data partners, not the official exchange index values."
      />
    ),
  },
  energy: {
    lead: "TradingView’s quotes for Brent crude, WTI crude and natural gas.",
    panels: (
      <TradingViewWidget
        kind="market-quotes"
        title="Energy quotes"
        what="the energy quotes"
        height={260}
        mobileHeight={300}
        minWidth={600}
        settings={{ showSymbolLogo: true, symbolsGroups: [quotes("Energy", ENERGY)] }}
        note="CFD symbols from TradingView’s data partners, not exchange futures prices."
      />
    ),
  },
  equities: {
    lead: "TradingView’s heat map of the S&P 500: each block is a company, sized by market value and coloured by the day’s change.",
    panels: (
      <TradingViewWidget
        kind="stock-heatmap"
        title="Stock heat map: S&P 500 by sector"
        what="the stock heat map"
        height={560}
        mobileHeight={460}
        transparent={false}
        settings={{ ...HEATMAP, exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic" }}
        note="It covers the index’s constituents, most of which GIO4X does not offer as instruments."
      />
    ),
  },
  crypto: {
    lead: "TradingView’s heat map of crypto assets: each block is a coin, sized by market value and coloured by the day’s change.",
    panels: (
      <TradingViewWidget
        kind="crypto-coins-heatmap"
        title="Crypto heat map: coins by market value"
        what="the crypto heat map"
        height={560}
        mobileHeight={460}
        transparent={false}
        settings={{ ...HEATMAP, dataSource: "Crypto", blockSize: "market_cap_calc" }}
        note="It covers many coins that GIO4X does not offer as instruments."
      />
    ),
  },
};

/** The third-party section of an asset-class page. Renders nothing for a class with no panel. */
export function ClassPanels({ cls, name }: { cls: AssetClassKey; name: string }) {
  const entry = CLASS_PANELS[cls];
  if (!entry) return null;
  return (
    <section className="section hairline scroll-mt-[var(--header-h)]" id="third-party" aria-labelledby="third-party-title">
      <div className="wrap">
        <Head eyebrow="Third-party view" id="third-party-title" title={<>{name}, as shown by TradingView.</>} lead={entry.lead} />
        <p className="mt-13 max-w-measure text-sm text-ink-3">
          GIO4X does not publish live prices of its own on this site. What follows is TradingView’s, loaded at your request.{" "}
          <Link href="/trust/data-methodology" className="link">
            Data methodology
          </Link>
        </p>
        <div className="mt-34 grid min-w-0 gap-21">{entry.panels}</div>
      </div>
    </section>
  );
}
