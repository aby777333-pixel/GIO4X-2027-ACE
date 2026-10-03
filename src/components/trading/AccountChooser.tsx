"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { accountRows, type AccountKey } from "@/data/accounts";
import { complete, lowestAccount, match, questions, resultHref, type Answers } from "./choose";

/**
 * The account chooser: four plain questions, then the closest match among the
 * three published accounts, with the published facts that produced it.
 *
 * Without JavaScript it is an ordinary GET form: the four answers travel as
 * four short codes in the address and the server renders the result (the page
 * passes them in as `initial`). With JavaScript the result follows the answers
 * as they are chosen, nothing is reloaded, and "Show the match" moves the
 * keyboard to the result. Nothing is stored and nothing is sent anywhere.
 *
 * The sign-up address is decided on the server from the destination registry
 * (src/config/destinations.ts) and handed in: this component never builds one.
 */
export type SignUp =
  | { kind: "portal"; hrefs: Record<AccountKey, string>; address: string }
  /** applications are not connected: the interest form on /open-account, which takes the account name */
  | { kind: "interest" };

/** The rows of the specification the result shows: the ones the questions are about. */
const SHOWN = ["minDeposit", "spreadFrom", "commission", "swap", "leverage"] as const;

export function AccountChooser({ initial, signup }: { initial: Answers; signup: SignUp }) {
  const [answers, setAnswers] = useState<Answers>(initial);
  /** the result is shown once asked for, or straight away when the address already carries the answers */
  const [asked, setAsked] = useState(complete(initial));
  const [enhanced, setEnhanced] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const focusResult = useRef(false);

  useEffect(() => setEnhanced(true), []);

  const done = questions.filter((q) => answers[q.key]).length;
  const result = asked ? match(answers) : null;

  useEffect(() => {
    if (focusResult.current && result) {
      focusResult.current = false;
      resultRef.current?.focus();
    }
  }, [result]);

  const sync = (next: Answers) => {
    try {
      // the same address the plain form would have produced, so the result can be reloaded or returned to
      window.history.replaceState(null, "", resultHref(next));
    } catch {
      /* the address stays as it was; the result is on the page either way */
    }
  };

  const choose = (key: keyof Answers, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (asked) sync(next);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!complete(answers)) return; // the browser's own "required" message names the question
    e.preventDefault();
    focusResult.current = true;
    setAsked(true);
    sync(answers);
    // already on show: the effect will not run again, so move there now
    if (asked) resultRef.current?.focus();
  };

  const reset = () => {
    setAnswers({});
    setAsked(false);
    try {
      window.history.replaceState(null, "", resultHref({}));
    } catch {
      /* ignore */
    }
  };

  const a = result?.account ?? null;

  return (
    <div className="grid gap-34 lg:grid-cols-phi lg:gap-89">
      <form method="get" action="/trading/accounts/choose" onSubmit={onSubmit} aria-label="Account chooser">
        <ol className="border-t border-line-strong">
          {questions.map((q, i) => (
            <li key={q.key} className="border-b border-line py-21">
              <fieldset>
                <legend className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-13">
                  <span aria-hidden className="num pt-3 text-xs font-semibold tracking-[0.1em] text-prestige-ink">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="h4 block">{q.legend}</span>
                    <span className="mt-3 block text-sm font-normal text-ink-3">{q.hint}</span>
                  </span>
                </legend>
                <div className="mt-13 grid gap-3 pl-[2.9375rem]">
                  {q.options.map((o, n) => (
                    <label key={o.value} className="check min-h-[2.75rem] items-center rounded-sm py-5">
                      <input type="radio" name={q.key} value={o.value} required={n === 0} checked={answers[q.key] === o.value} onChange={() => choose(q.key, o.value)} />
                      <span>
                        <span className="text-[0.9375rem] text-ink">{o.label}</span>
                        {o.note && <span className="block text-xs text-ink-3">{o.note}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <div className="mt-21 flex flex-wrap items-center gap-13">
          <button type="submit" className="btn btn-primary btn-lg">
            Show the match
          </button>
          {enhanced && done > 0 && (
            <button type="button" className="btn btn-quiet" onClick={reset}>
              Start again
            </button>
          )}
          <p className="text-sm text-ink-3" aria-live="polite">
            <span className="num">{done}</span> of <span className="num">{questions.length}</span> answered
          </p>
        </div>
        {/* the result itself is long: only its headline is announced when an answer changes it */}
        <p role="status" className="sr-only">
          {result ? (a ? `Closest match: ${a.name}.` : `No account opens below ${lowestAccount.minDeposit}.`) : ""}
        </p>
        <p className="mt-13 max-w-measure text-xs text-ink-3">Your answers stay on this page. They are four short codes in its address, describe a preference and not a person, and are not stored or sent to anyone.</p>
      </form>

      <div ref={resultRef} id="result" tabIndex={-1} className="min-w-0 scroll-mt-[calc(var(--header-h)+1.3125rem)] focus:outline-none lg:sticky lg:top-[calc(var(--header-h)+1.3125rem)] lg:self-start">
        {!result ? (
          <div className="panel-quiet p-21">
            <p className="label">The match</p>
            <p className="mt-8 text-sm text-ink-2">Answer the four questions and the account whose published conditions agree with most of them is named here, with each fact that counted and each one worth weighing against it.</p>
          </div>
        ) : !a ? (
          <div className="panel p-21 sm:p-34">
            <p className="label">The match</p>
            <h2 className="h3 mt-8">No account opens below {lowestAccount.minDeposit}.</h2>
            <p className="mt-13 text-ink-2">
              The lowest published minimum deposit is {lowestAccount.minDeposit}, on {lowestAccount.name}. With a smaller first deposit none of the three accounts can be opened, so no match is shown.
            </p>
            <p className="mt-13 text-sm text-ink-3">There is no deadline. The tools and the practice desk need no account and no money.</p>
            <div className="mt-21 flex flex-wrap gap-13">
              <Link href="/labs/simulator" className="btn btn-ghost">
                Practice desk
              </Link>
              <Link href="/trading/accounts" className="btn btn-quiet">
                Compare account types
              </Link>
            </div>
          </div>
        ) : (
          <div className="panel p-21 shadow-2 sm:p-34">
            <p className="label">Closest match to your answers</p>
            <h2 className="h2 mt-8">{a.name}</h2>
            <p className="mt-8 text-ink-2">{a.line}</p>

            <h3 className="label mt-21 border-b border-line-strong pb-8">Why it matched</h3>
            {result.reasons.length > 0 ? (
              <ul className="text-sm text-ink">
                {result.reasons.map((r) => (
                  <li key={r} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] border-b border-line py-8">
                    <span aria-hidden className="text-pos">
                      ✓
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-b border-line py-8 text-sm text-ink-2">None of its published conditions answers your questions directly. It is named because it has the lowest minimum deposit of the accounts your first deposit can open.</p>
            )}

            <h3 className="label mt-21 border-b border-line-strong pb-8">Worth weighing</h3>
            <ul className="text-sm text-ink-2">
              {result.weigh.map((w) => (
                <li key={w} className="grid grid-cols-[1.3125rem_minmax(0,1fr)] border-b border-line py-8">
                  <span aria-hidden className="text-ink-3">
                    ◆
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>

            {result.beyond && (
              <p className="mt-13 border-l-2 border-warn pl-13 text-sm text-ink-2">
                {result.beyond.account.name} agreed with more of your answers, but its minimum deposit is {result.beyond.account.minDeposit}, above the first deposit you chose.
              </p>
            )}

            <dl className="mt-21 border-t border-line-strong">
              {accountRows
                .filter((r) => (SHOWN as readonly string[]).includes(r.key))
                .map((r) => (
                  <div key={r.key} className="flex items-baseline justify-between gap-13 border-b border-line py-8">
                    <dt className="text-sm text-ink-3">{r.label}</dt>
                    <dd className="num text-[0.9375rem] font-medium text-ink">{String(a[r.key])}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-8 text-xs text-ink-3">Indicative: GIO4X published account conditions. Spreads are minimums and widen with market conditions.</p>

            <div className="mt-21 flex flex-wrap items-center gap-13">
              {signup.kind === "portal" ? (
                <a href={signup.hrefs[a.key]} rel="noopener noreferrer" className="btn btn-primary btn-lg">
                  Open a {a.name} account
                </a>
              ) : (
                <Link href={`/open-account?account=${a.key}`} className="btn btn-primary btn-lg">
                  Register interest in {a.name}
                </Link>
              )}
              <Link href="/trading/accounts" className="btn btn-ghost btn-lg">
                Compare all three
              </Link>
            </div>
            <p className="mt-8 text-xs text-ink-3">
              {signup.kind === "portal"
                ? `The application continues at ${signup.address}. Only the account name is carried over; your answers are not.`
                : "Online applications are not connected to this website yet. The next page takes four details so that we can write to you; only the account name is carried over."}
            </p>

            {result.others.length > 0 && <p className="mt-21 text-sm text-ink-3">Also open to your first deposit: {result.others.map((o) => `${o.name} (from ${o.minDeposit})`).join(", ")}.</p>}
          </div>
        )}
        <p className="mt-13 text-xs text-ink-3">A match on published facts, not advice and not a recommendation to trade.</p>
      </div>
    </div>
  );
}
