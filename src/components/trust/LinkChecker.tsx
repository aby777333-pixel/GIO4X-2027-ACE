"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { verifyDestination, type Verdict } from "@/config/destinations";

/** verifyDestination() reads at most this many characters. */
const MAX_CHECKED = 2048;
/** Never keep or display more than this, whatever is pasted or deep-linked. */
const MAX_INPUT = 4096;
const MAX_SHOWN = 96;

type Result = { verdict: Verdict; truncated: boolean; empty: boolean };

function check(raw: string): Result {
  const value = raw.slice(0, MAX_INPUT);
  return { verdict: verifyDestination(value), truncated: value.trim().length > MAX_CHECKED, empty: value.trim().length === 0 };
}

/** The hash is attacker-controllable text: decode defensively and treat it only as a string. */
function readHash(): string {
  const raw = window.location.hash.slice(1, MAX_INPUT + 1);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).slice(0, MAX_INPUT);
  } catch {
    return raw;
  }
}

const shorten = (s: string) => (s.length > MAX_SHOWN ? `${s.slice(0, MAX_SHOWN)}…` : s);

function Outcome({ result }: { result: Result }) {
  const { verdict: v } = result;
  const host = v.host ? shorten(v.host) : null;

  let tone = "border-line-strong";
  let mark = "?";
  let markTone = "text-ink-2";
  let heading = "Not recognised";
  let body: string[] = [];

  if (result.empty) {
    heading = "Nothing to check";
    body = ["Paste or type an address first."];
  } else if (v.verdict === "OFFICIAL") {
    tone = "border-pos";
    mark = "✓";
    markTone = "text-pos";
    heading = "Official GIO4X";
    body = ["This address is on a domain that GIO4X owns and publishes. The check compares the address with the registry; it does not open the page or confirm that the page exists."];
  } else if (v.verdict === "APPROVED_THIRD_PARTY") {
    tone = "border-accent";
    mark = "✓";
    markTone = "text-accent";
    heading = "Approved third-party destination";
    body = [`${v.label}. ${v.why}`, "This is not a GIO4X website. GIO4X links to it on purpose, and the organisation that runs it is responsible for what is on it."];
  } else if (v.reason === "not-https") {
    body = [
      "This address does not use https. GIO4X publishes only https addresses, so a link without it is not recognised even when the domain looks right.",
      "If you meant to visit GIO4X, type the address yourself, starting with https://, rather than following the link.",
    ];
  } else if (v.reason === "has-credentials") {
    body = [
      "This address has a user name or password written into it, in the part before the @ sign. Everything before the @ is ignored by your browser when it decides which site to open, so this form can make a link read like one site while it leads to another.",
      "GIO4X never publishes links in this form. Treat it as not GIO4X.",
    ];
  } else if (v.reason === "unparseable") {
    body = ["This could not be read as a web address. Check that you copied the whole link, including the part that begins with https://."];
  } else {
    const lookalike = v.host !== null && v.host.includes("gio4x");
    body = [
      "This address is not in the GIO4X registry of official and approved destinations.",
      ...(lookalike
        ? ["It contains “gio4x”, but it is not on the gio4x.com domain. What decides where a link leads is the end of the host name, immediately before the first single slash, not a name that appears earlier in it."]
        : []),
      "Not recognised does not mean malicious. It means GIO4X has not published this address, so it should not be treated as GIO4X. Do not enter a GIO4X password or one-time code there.",
    ];
  }

  return (
    <div className={`border-l-2 ${tone} pl-21`}>
      <p className="flex items-baseline gap-13">
        <span aria-hidden className={`font-display text-2xl leading-none ${markTone}`}>
          {mark}
        </span>
        <span className="h3" data-verdict={result.empty ? "EMPTY" : v.verdict}>
          {heading}
        </span>
      </p>
      {host && (
        <p className="mt-13 text-sm text-ink-3">
          Host that was compared: <span className="break-all font-mono text-[0.8125rem] text-ink">{host}</span>
        </p>
      )}
      <div className="mt-13 grid max-w-measure gap-8 text-ink-2">
        {body.map((b) => (
          <p key={b}>{b}</p>
        ))}
      </div>
      {result.truncated && <p className="mt-13 text-sm text-ink-3">Only the first 2,048 characters were compared. An address this long is unusual in itself.</p>}
    </div>
  );
}

/**
 * OFFICIAL DESTINATION CHECKER.
 * A pure string comparison against the registry in src/config/destinations.ts,
 * run in the visitor's browser. Nothing is fetched, sent or stored, and the
 * input is only ever rendered as text.
 */
export function LinkChecker() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const id = useId();

  const run = useCallback((v: string) => {
    setResult(check(v));
  }, []);

  // deep link: /trust/verify#<encoded address> (used by the command bar's "verify:")
  useEffect(() => {
    const fromHash = () => {
      const h = readHash();
      if (!h) return;
      setValue(h);
      setResult(check(h));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(value);
  };

  return (
    <div className="panel p-21 lg:p-34">
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={id}>Address to check</label>
          <div className="grid gap-13 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              id={id}
              className="input font-mono !text-[0.9375rem]"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://"
              aria-describedby={`${id}-hint`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value.slice(0, MAX_INPUT));
                setResult(null);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!pasted) return;
                e.preventDefault();
                const next = pasted.trim().slice(0, MAX_INPUT);
                setValue(next);
                run(next);
              }}
            />
            <button type="submit" className="btn btn-primary">
              Check
            </button>
          </div>
          <p id={`${id}-hint`} className="field-hint">
            Checked on your device by comparing text. No request is made to the address, and nothing you type is sent to GIO4X or stored.
          </p>
        </div>
      </form>

      <div className="mt-34 min-h-[8.9375rem] border-t border-line pt-34" aria-live="polite" aria-atomic="true">
        {result ? (
          <Outcome result={result} />
        ) : (
          <div className="grid gap-8 text-sm text-ink-3">
            <p className="label">Three possible answers</p>
            <ul className="grid gap-5">
              <li>
                <span aria-hidden className="mr-8 text-pos">
                  ✓
                </span>
                Official GIO4X
              </li>
              <li>
                <span aria-hidden className="mr-8 text-accent">
                  ✓
                </span>
                Approved third-party destination
              </li>
              <li>
                <span aria-hidden className="mr-8">
                  ?
                </span>
                Not recognised
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
