"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePrefs } from "@/hooks/usePrefs";
import { LOCAL_KEYS, resetLocal } from "@/lib/prefs";

type LocalKey = (typeof LOCAL_KEYS)[number];

/** What each key is for, in the visitor's language. Every key in LOCAL_KEYS must be described. */
const KEY_INFO: Record<LocalKey, { name: string; purpose: string }> = {
  "gx:prefs": { name: "Display preferences", purpose: "Your appearance, accent (for an accent of your own, the one or two hues you chose), density, comfort and time-zone choices from this page, whether pointer effects are on, whether TradingView panels load automatically, whether your visits are counted, whether interface sounds are on and how loud, whether you have started or declined the guided tour, whether Academy lessons open as “Read” or as “Story”,and whether an offline copy may be kept, so the site looks and behaves the same on your next visit." },
  "gx:recent": { name: "Recently viewed", purpose: "A short list of the pages and searches you opened most recently, so you can return to them from My desk. Kept only after you switch the list on there." },
  "gx:saved": { name: "Saved items", purpose: "Articles, lessons, terms or tools you chose to keep for later. Listed on My desk, which can also export these items to a file you keep." },
  "gx:calc": { name: "Calculator inputs", purpose: "The last figures you typed into the Trader Toolkit, so that one tool can hand its inputs to the next." },
  "gx:consent": { name: "Privacy choice", purpose: "Your answer to a privacy or cookie question, so it is not asked again." },
  "gx:watch": { name: "Watchlist", purpose: "The instruments you chose to keep an eye on." },
  "gx:morning-depth": { name: "Morning Room depth", purpose: "Whether you read the Morning Room at Quick, Standard or Deep, so it opens the same way next time." },
  "gx:boot": { name: "Start-up shown", purpose: "A note that the short start-up animation has already played on this device (or was left out because reduced motion or low visual effects was on), so it is not shown again." },
  "gx:learn": { name: "Glossary and Academy progress", purpose: "Which glossary terms you have answered the “Check yourself” question for correctly, and which Academy lessons you have completed by answering all three of their questions correctly, so the glossary and the Academy can mark them and count them. No score is kept." },
  "gx:play": { name: "Riddle, score and passport", purpose: "The run of days on which you answered the daily riddle, your best score in the Workshop’s “Sixty seconds”, and the stamps in your passport on My desk. Each is written only by something you do: answering a riddle, finishing a round, starting the passport." },
  "gx:sim": { name: "Practice desk session", purpose: "The state of the trading simulation in Labs (its invented prices, example account, example positions and journal), kept only if you tick “Keep this practice session in this browser” there, so it is still there after a reload. Unticking the box deletes it." },
};

const COMMON_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Zurich",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Time-zone preference: "local" follows the device; anything else is an IANA zone. */
export function TimeZonePreference() {
  const [prefs, update, ready] = usePrefs();
  const id = useId();
  const [now, setNow] = useState<Date | null>(null);
  const [deviceZone, setDeviceZone] = useState<string>("");

  useEffect(() => {
    setNow(new Date());
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const zones = useMemo(() => {
    const set = new Set(COMMON_ZONES);
    if (prefs.tz !== "local" && validZone(prefs.tz)) set.add(prefs.tz);
    return [...set];
  }, [prefs.tz]);

  const active = prefs.tz === "local" || !validZone(prefs.tz) ? deviceZone : prefs.tz;
  const clock =
    now && active
      ? new Intl.DateTimeFormat("en-GB", { timeZone: active, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(now)
      : null;

  return (
    <div className="grid gap-13">
      <div className="field max-w-[26rem]">
        <label htmlFor={id}>Time zone</label>
        <select id={id} className="select" value={zones.includes(prefs.tz) ? prefs.tz : "local"} onChange={(e) => update({ tz: e.target.value })} disabled={!ready} aria-describedby={`${id}-hint`}>
          <option value="local">This device{deviceZone ? ` (${deviceZone.replace(/_/g, " ")})` : ""}</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p id={`${id}-hint`} className="field-hint">
          Your preferred zone for times shown on this site. Every schedule also states the zone it is using.
        </p>
      </div>
      <p className="text-sm text-ink-2" aria-live="polite">
        <span className="label mr-8">Now</span>
        <span className="num font-medium text-ink">{clock ?? "…"}</span>
      </p>
    </div>
  );
}

type Row = { key: LocalKey; present: boolean; bytes: number };

function readRows(): Row[] {
  return LOCAL_KEYS.map((key) => {
    try {
      const v = window.localStorage.getItem(key);
      return { key, present: v !== null, bytes: v ? new Blob([v]).size : 0 };
    } catch {
      return { key, present: false, bytes: 0 };
    }
  });
}

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/**
 * Privacy controls: exactly what this site keeps in the browser, whether each
 * item is present on this device right now, and one button to remove it all.
 */
export function PrivacyControls() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);

  const refresh = useCallback(() => setRows(readRows()), []);

  useEffect(() => {
    refresh();
    const onPrefs = () => refresh();
    const onStorage = () => refresh();
    window.addEventListener("gx:prefs", onPrefs);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("gx:prefs", onPrefs);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const stored = rows?.filter((r) => r.present).length ?? 0;

  const clear = () => {
    const before = rows?.filter((r) => r.present).length ?? 0;
    resetLocal();
    refresh();
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    setCleared(before > 0 ? `Cleared at ${time}. ${before} ${before === 1 ? "item was" : "items were"} removed and the display is back to the GIO4X default.` : `Checked at ${time}. There was nothing stored to remove.`);
  };

  return (
    <div>
      <div className="scroll-x">
        <table className="table-gx min-w-[36rem]">
          <caption className="sr-only">Items GIO4X may store in this browser</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[24%]">
                Item
              </th>
              <th scope="col">What it is for</th>
              <th scope="col" className="w-[9.5rem]">
                On this device
              </th>
            </tr>
          </thead>
          <tbody>
            {LOCAL_KEYS.map((key) => {
              const info = KEY_INFO[key];
              const row = rows?.find((r) => r.key === key);
              return (
                <tr key={key}>
                  <th scope="row" className="!border-line !py-13 !align-top !normal-case !tracking-normal">
                    <span className="block text-sm font-medium text-ink">{info.name}</span>
                    <code className="mt-2 block font-mono text-xs font-normal text-ink-3">{key}</code>
                  </th>
                  <td className="!h-auto whitespace-normal py-13 align-top text-sm text-ink-2">{info.purpose}</td>
                  <td className="!h-auto py-13 align-top">
                    {!row ? (
                      <span className="text-xs text-ink-3">…</span>
                    ) : row.present ? (
                      <span className="state state-open">
                        Stored <span className="num font-normal normal-case tracking-normal text-ink-3">{formatBytes(row.bytes)}</span>
                      </span>
                    ) : (
                      <span className="state state-off">Nothing stored</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-13 max-w-measure text-xs text-ink-3">
        All of it is kept in this browser’s local storage. None of it is sent to GIO4X, and none of it identifies you. Items marked “Nothing stored” are only created when you use the feature they belong to.
      </p>
      <p className="mt-8 max-w-measure text-xs text-ink-3">
        The offline copy of pages and tools is kept separately, in this browser’s cache storage, and has its own control further down this page. The button below empties it as well.
      </p>

      <div className="mt-34 flex flex-wrap items-center gap-x-21 gap-y-13 border-t border-line-strong pt-21">
        <button type="button" className="btn btn-primary h-auto min-h-[2.75rem] whitespace-normal py-8 text-left" onClick={clear}>
          Clear everything stored by GIO4X on this device
        </button>
        <p className="text-sm text-ink-2" role="status" aria-live="polite">
          {cleared ? (
            <span className="inline-flex items-start gap-8">
              <span aria-hidden className="text-pos">
                {"✓"}
              </span>
              {cleared}
            </span>
          ) : rows ? (
            <span className="text-ink-3">
              <span className="num">{stored}</span> of <span className="num">{LOCAL_KEYS.length}</span> items currently stored.
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
