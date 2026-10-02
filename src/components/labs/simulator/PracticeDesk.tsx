"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, pct } from "@/components/tools/calc";
import { DataNote } from "@/components/ui/Page";
import { Tabs } from "@/components/ui/Tabs";
import { educationalNote } from "@/config/legal";
import { Chart, type DragKey } from "./Chart";
import { account, cancelOrder, closeAll, closePosition, createState, minuteOf, modifyOrder, modifyPosition, placeMarket, placePending, quote, revive, serialise, SIM, step, type Result, type SimState } from "./engine";
import { AccountPanel, Exercises, Journal, Positions, SettingsPanel, Ticket, type Note, type TicketOrder } from "./panels";
import { explain, glyph, orderName, px, sim as amt, simSigned } from "./working";

/**
 * PRACTICE DESK: a trading simulation on invented prices.
 *
 * One invented instrument, one example account, and the mechanics of placing,
 * managing and closing a trade. The engine (./engine) is pure and seeded; this
 * component only keeps its latest state, runs it at the chosen speed and hands
 * the visitor's actions to it.
 *
 * Nothing leaves the browser. The session lives in memory and is gone on
 * reload unless the visitor ticks "keep this practice session in this
 * browser", which stores it under ONE localStorage key (gx:sim, listed in
 * LOCAL_KEYS in lib/prefs and described on /legal/cookies and /preferences);
 * unticking deletes it.
 *
 * The market does not start by itself: it waits for "Start". It is the content
 * of the page, so it still ticks under reduced motion once started, and there
 * is no decorative animation to switch off.
 */

export const SIM_KEY = "gx:sim";

type Speed = 0 | 1 | 5 | 20;
/** ticks of ten simulated seconds per real second: at 1× one candle forms every two seconds */
const TICKS_PER_SECOND: Record<Exclude<Speed, 0>, number> = { 1: 3, 5: 15, 20: 60 };
const SPEEDS: { value: Speed; label: string; name: string }[] = [
  { value: 0, label: "Pause", name: "Pause the market" },
  { value: 1, label: "1×", name: "Run at 1 times speed" },
  { value: 5, label: "5×", name: "Run at 5 times speed" },
  { value: 20, label: "20×", name: "Run at 20 times speed" },
];

const STOPPED_OUT: Note = { text: "A stop out closed positions automatically and the market is paused. The explanation is under the account figures, and each close is in the journal.", bad: false };

export function PracticeDesk() {
  const [state, setState] = useState<SimState>(() => createState(SIM.defaultSeed, SIM.defaultBalance, SIM.defaultLeverage));
  /** the newest state, for the loop and for handlers that must not act on a stale one */
  const live = useRef(state);
  const [speed, setSpeed] = useState<Speed>(0);
  const [note, setNote] = useState<Note>(null);
  const [keep, setKeep] = useState(false);
  const keeping = useRef(false);
  const stored = useRef<SimState | null>(null);
  /** the tick of the stop out whose explanation has been closed */
  const [readStopOut, setReadStopOut] = useState(-1);

  const commit = useCallback((next: SimState) => {
    live.current = next;
    setState(next);
  }, []);

  const run = useCallback(
    (r: Result, done: string): boolean => {
      if (r.state !== live.current) commit(r.state);
      setNote(r.ok ? { text: done, bad: false } : { text: explain(r.error), bad: true });
      return r.ok;
    },
    [commit],
  );

  /* ---- the market --------------------------------------------------------- */
  useEffect(() => {
    if (speed === 0) return;
    const rate = TICKS_PER_SECOND[speed];
    let raf = 0;
    let last = 0;
    let due = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      due += dt * rate;
      let n = Math.min(Math.floor(due), 8);
      if (n > 0) {
        due -= Math.floor(due);
        let s = live.current;
        const before = s.stopOut;
        let halted = false;
        while (n-- > 0 && !halted) {
          s = step(s);
          halted = s.stopOut !== before;
        }
        commit(s);
        // a stop out is the thing to read: the market waits while it is read. No further frame is asked for,
        // because the pause only reaches this effect after the next render and one more tick could slip through.
        if (halted) {
          setSpeed(0);
          setNote(STOPPED_OUT);
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [speed, commit]);

  /* ---- keeping the session, only if asked ---------------------------------- */
  const save = useCallback(() => {
    if (!keeping.current || stored.current === live.current) return;
    try {
      window.localStorage.setItem(SIM_KEY, JSON.stringify(serialise(live.current)));
      stored.current = live.current;
    } catch {
      /* storage unavailable or full: the session simply stays in memory */
    }
  }, []);

  useEffect(() => {
    let found: SimState | null = null;
    try {
      const raw = window.localStorage.getItem(SIM_KEY);
      if (raw) found = revive(JSON.parse(raw));
    } catch {
      found = null;
    }
    if (found) {
      keeping.current = true;
      stored.current = found;
      commit(found);
      setKeep(true);
      setReadStopOut(found.stopOut ? found.stopOut.tick : -1);
    }
  }, [commit]);

  useEffect(() => {
    if (!keep) return;
    save();
    const id = window.setInterval(save, 2000);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [keep, save]);

  const onKeep = (on: boolean) => {
    keeping.current = on;
    stored.current = null;
    setKeep(on);
    if (!on) {
      try {
        window.localStorage.removeItem(SIM_KEY);
      } catch {
        /* ignore */
      }
    }
    setNote({ text: on ? "This practice session is now kept in this browser. Nothing is sent anywhere." : "The stored copy of this session was deleted from this browser.", bad: false });
  };

  /* ---- what the visitor does ------------------------------------------------ */
  const restart = (seed: number, balance: number, leverage: number) => {
    setSpeed(0);
    setReadStopOut(-1);
    commit(createState(seed, balance, leverage));
    setNote({ text: `Fresh example account on market ${seed}: ${amt(balance)}, leverage 1:${fmt(leverage)}. The market is paused.`, bad: false });
  };
  const newMarket = () => {
    let seed = live.current.seed;
    while (seed === live.current.seed) seed = 1000 + Math.floor(Math.random() * 9000);
    restart(seed, live.current.startBalance, live.current.leverage);
  };
  const stepOnce = () => {
    setSpeed(0);
    const next = step(live.current);
    if (next.stopOut !== live.current.stopOut) setNote(STOPPED_OUT);
    commit(next);
  };

  const onOrder = (o: TicketOrder): boolean => {
    const s = live.current;
    if (o.type === "market") return run(placeMarket(s, { side: o.side, lots: o.lots, sl: o.sl, tp: o.tp }), `${o.side === "buy" ? "Bought" : "Sold"} ${fmt(o.lots, 2, 2)} lots at the ${o.side === "buy" ? "ask" : "bid"}. It is in the list of open positions and on the chart.`);
    return run(placePending(s, { side: o.side, order: o.type, lots: o.lots, level: o.level ?? NaN, sl: o.sl, tp: o.tp }), `${orderName(o.side, o.type)} placed at ${o.level !== null ? px(o.level) : ""}. It waits until the simulated price reaches it.`);
  };
  const onModify = useCallback(
    (id: number, change: { sl?: number | null; tp?: number | null }) => {
      const what = change.sl !== undefined ? "Stop loss" : "Take profit";
      const to = change.sl !== undefined ? change.sl : change.tp;
      run(modifyPosition(live.current, id, change), to === null || to === undefined ? `${what} of position #${id} removed.` : `${what} of position #${id} is now ${px(to)}.`);
    },
    [run],
  );
  const onOrderLevel = useCallback((id: number, level: number) => run(modifyOrder(live.current, id, level), `Order #${id} now waits at ${px(level)}.`), [run]);
  const onMove = useCallback(
    (key: DragKey, price: number) => {
      if (key.target === "order") onOrderLevel(key.id, price);
      else onModify(key.id, key.field === "sl" ? { sl: price } : { tp: price });
    },
    [onModify, onOrderLevel],
  );
  const onClose = (id: number, lots?: number) => {
    const r = closePosition(live.current, id, lots);
    const e = r.ok ? r.state.journal[r.state.journal.length - 1] : undefined;
    run(r, e && e.kind === "close" ? `${e.left > 0 ? `Part of position #${id} closed` : `Position #${id} closed`} at ${px(e.exit)}: ${simSigned(e.pl)}.` : "Closed.");
  };

  const acc = account(state);
  const q = quote(state);
  const minute = Math.floor(minuteOf(state.tick));
  const toRollover = SIM.rolloverMinutes - (minuteOf(state.tick) % SIM.rolloverMinutes);
  const so = state.stopOut;
  const showStopOut = so !== null && so.tick !== readStopOut;
  const empty = state.positions.length === 0 && acc.balance <= 0;

  const figures = [
    { label: "Equity", value: amt(acc.equity), tone: "" },
    { label: "Floating P/L", value: `${glyph(acc.floating)} ${simSigned(acc.floating)}`, tone: acc.floating > 0 ? "text-pos" : acc.floating < 0 ? "text-neg" : "" },
    { label: "Free margin", value: amt(acc.free), tone: acc.free < 0 ? "text-neg" : "" },
    { label: "Margin level", value: acc.level === null ? "–" : pct(acc.level), tone: acc.level !== null && acc.level <= SIM.marginCallLevel ? "text-neg" : "" },
  ];

  return (
    <div className="grid gap-21 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-34" data-sim-desk data-tick={state.tick} data-seed={state.seed}>
      {/* chart */}
      <section aria-labelledby="sim-chart" className="panel min-w-0 p-13 sm:p-21 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-x-21 gap-y-8">
          <div className="min-w-0">
            <p className="chip" data-sim-mark>
              SIMULATION · invented prices
            </p>
            <h2 id="sim-chart" className="h4 mt-8">
              {SIM.instrument} <span className="num text-sm font-normal text-ink-3">market {state.seed}</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div className="seg" role="group" aria-label="Speed of the simulated market">
              {SPEEDS.map((s) => (
                <button key={s.value} type="button" className="!h-[2.75rem]" aria-pressed={speed === s.value} aria-label={s.name} onClick={() => setSpeed(s.value)} data-speed={s.value}>
                  {s.value === 0 && speed === 0 ? "Paused" : s.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm !h-[2.75rem]" onClick={stepOnce} data-sim-step>
              Step<span className="sr-only"> one tick</span>
            </button>
            <button type="button" className="btn btn-ghost btn-sm !h-[2.75rem]" onClick={newMarket} data-sim-new>
              New market
            </button>
          </div>
        </div>
        <p className="num mt-8 flex flex-wrap gap-x-21 gap-y-3 text-sm text-ink-2" data-sim-quote>
          <span>
            Bid <span className="font-medium text-ink">{px(q.bid)}</span>
          </span>
          <span>
            Ask <span className="font-medium text-ink">{px(q.ask)}</span>
          </span>
          <span>Spread {fmt(SIM.spreadPips)} pips</span>
          <span>Simulated minute {minute}</span>
          <span>Rollover in {fmt(Math.ceil(toRollover))} min</span>
        </p>
        <div className="mt-8 rounded-sm border border-line bg-paper">
          <Chart sim={state} onMove={onMove} />
        </div>
        <p className="mt-8 text-xs text-ink-3">
          Invented prices from a seeded random walk: not a real instrument, not a market, and not GIO4X’s quotes. Hollow candles closed higher, filled candles closed lower; one candle is one simulated minute. The solid line is the bid (B) and the dashed line the ask (A). {speed === 0 ? "The market is paused: choose a speed to start it, or step one tick at a time." : "A new market, or starting again in Settings, opens a fresh example account."}
        </p>
      </section>

      {/* account, always in view */}
      <section aria-label="Example account, live figures" className="min-w-0 lg:col-start-1 lg:row-start-2">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4" data-sim-account>
          {figures.map((f) => (
            <div key={f.label} className="bg-paper p-13">
              <dt className="label">{f.label}</dt>
              <dd className={`num mt-3 text-[0.9375rem] font-medium sm:text-md ${f.tone || "text-ink"}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div aria-live="polite" className="grid gap-8 empty:hidden [&:not(:empty)]:mt-13">
          {state.marginCall && (
            <div className="rounded border border-neg bg-paper p-13" data-sim-margincall>
              <p className="text-sm font-medium text-neg">▼ Margin call (simulated)</p>
              <p className="mt-3 text-sm text-ink-2">
                Equity of <span className="num">{amt(acc.equity)}</span> no longer exceeds the used margin of <span className="num">{amt(acc.used)}</span>: the margin level is <span className="num">{acc.level !== null ? pct(acc.level) : "–"}</span>, at or below this simulation’s <span className="num">{fmt(SIM.marginCallLevel)}%</span>. Nothing has been closed, but no new position can be opened, and at <span className="num">{fmt(SIM.stopOutLevel)}%</span> positions are closed automatically. Lesson:{" "}
                <Link href="/glossary/margin-call" className="link">
                  margin call
                </Link>
                .
              </p>
            </div>
          )}
          {showStopOut && so && (
            <div className="rounded border border-neg bg-paper p-13" data-sim-stopout>
              <p className="text-sm font-medium text-neg">▼ Stop out (simulated): {so.closed === 1 ? "1 position was" : `${so.closed} positions were`} closed automatically</p>
              <p className="mt-3 text-sm text-ink-2">
                At simulated minute <span className="num">{Math.floor(minuteOf(so.tick))}</span> the margin level was <span className="num">{pct(so.level)}</span> (<span className="num">{fmt(so.equity, 2, 2)}</span> ÷ <span className="num">{fmt(so.used, 2, 2)}</span> × 100), at or below this simulation’s <span className="num">{fmt(SIM.stopOutLevel)}%</span> level. Positions were closed at the price then available, the largest loss first, until the level was above it again. A stop out is not a floor: after a gap the level can be passed without stopping at it, and the balance can end below zero. The market has been paused; the journal shows each close with its arithmetic. Lessons:{" "}
                <Link href="/glossary/stop-out" className="link">
                  stop out
                </Link>
                ,{" "}
                <Link href="/glossary/leverage" className="link">
                  leverage
                </Link>
                .
              </p>
              <button type="button" className="btn btn-ghost btn-sm mt-8" onClick={() => setReadStopOut(so.tick)}>
                I have read this
              </button>
            </div>
          )}
          {empty && (
            <div className="rounded border border-line-strong bg-paper p-13" data-sim-empty>
              <p className="text-sm text-ink-2">
                The example account has nothing left (<span className="num">{amt(acc.balance)}</span>), so no order can be margined. On a real account, whether a client is liable for a balance below zero depends on the broker’s terms and the applicable rules (see{" "}
                <Link href="/glossary/negative-balance" className="link">
                  negative balance
                </Link>
                ).
              </p>
              <button type="button" className="btn btn-ghost btn-sm mt-8" onClick={() => restart(state.seed, state.startBalance, state.leverage)}>
                Start a fresh example account
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ticket, account, exercises, settings */}
      <div className="min-w-0 lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <div className="panel p-13 sm:p-21">
          <p role="status" aria-live="polite" className={`min-h-[2.5rem] text-sm ${note?.bad ? "text-neg" : "text-ink-2"}`} data-sim-note data-bad={note?.bad ? "yes" : "no"}>
            {note ? `${note.bad ? "Not done. " : ""}${note.text}` : "An example account on invented prices. Start the market, then place an example order."}
          </p>
          <Tabs
            label="Practice desk panels"
            className="mt-8"
            tabs={[
              { key: "ticket", label: "Ticket", content: <Ticket state={state} q={q} acc={acc} onOrder={onOrder} note={note} /> },
              { key: "account", label: "Account", content: <AccountPanel state={state} acc={acc} /> },
              { key: "exercises", label: "Exercises", content: <Exercises done={state.done} /> },
              { key: "settings", label: "Settings", content: <SettingsPanel state={state} keep={keep} onKeep={onKeep} onRestart={restart} /> },
            ]}
          />
        </div>
        <div className="mt-13 grid gap-8">
          <DataNote status="simulation">Invented prices and made-up settings: not a market, not GIO4X’s quotes or conditions. {educationalNote}</DataNote>
        </div>
      </div>

      <div className="min-w-0 lg:col-start-1 lg:row-start-3">
        <Positions state={state} acc={acc} note={note} onModify={onModify} onClose={onClose} onCloseAll={() => run(closeAll(live.current), "Every open position was closed at the price available.")} onOrderLevel={onOrderLevel} onCancel={(id) => run(cancelOrder(live.current, id), `Order #${id} cancelled.`)} />
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-4">
        <Journal journal={state.journal} stats={state.stats} leverage={state.leverage} startBalance={state.startBalance} />
      </div>
    </div>
  );
}
