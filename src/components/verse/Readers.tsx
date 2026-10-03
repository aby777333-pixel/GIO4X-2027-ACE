"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

/**
 * READERS' RIDDLES and THE SONNET.
 *
 * Readers' riddles: riddles sent by visitors and approved by staff, each to be
 * answered from three terms; and the form to send one. A riddle is two lines
 * and the glossary term that answers it, with optional initials. No e-mail
 * address is asked for. Nothing sent appears until a member of staff has read
 * and approved it (POST /api/riddle; GIO4X Control, Content, Readers'
 * riddles), and the form says so before anything is typed.
 *
 * The sonnet: one longer poem, a new one each month, chosen from the date.
 */

export type ReaderRiddle = { id: string; a: string; b: string; by: string; answer: { slug: string; term: string }; options: { slug: string; term: string }[] };

export function ReaderRiddles({ items }: { items: ReaderRiddle[] }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  if (items.length === 0) return <p className="text-ink-2">No reader’s riddle has been published yet. Yours could be the first: the form is below.</p>;
  return (
    <ul className="grid gap-21">
      {items.map((r) => {
        const p = picked[r.id];
        const done = p !== undefined;
        return (
          <li key={r.id} className="border-b border-line pb-21">
            <p className="gx-couplet !mb-0">
              <span>{r.a}</span>
              <span>{r.b}</span>
            </p>
            {r.by && <p className="mt-5 text-xs text-ink-3">Sent by {r.by}</p>}
            <div className="mt-13 flex flex-wrap gap-8" role="group" aria-label="Choose the answer">
              {r.options.map((o) => (
                <button key={o.slug} type="button" className={`btn btn-ghost !normal-case ${done && o.slug === r.answer.slug ? "border-accent" : ""} ${done && o.slug === p && p !== r.answer.slug ? "line-through opacity-60" : ""}`} disabled={done} onClick={() => setPicked((s) => ({ ...s, [r.id]: o.slug }))}>
                  {o.term}
                </button>
              ))}
            </div>
            <p className="mt-8 min-h-[1.5rem] text-sm text-ink-2" aria-live="polite">
              {done && (
                <>
                  {p === r.answer.slug ? "Yes: " : "The answer is "}
                  <Link href={`/glossary/${r.answer.slug}`} className="link">
                    {r.answer.term}
                  </Link>
                  .
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string; fields?: Record<string, string> };

export function RiddleForm({ terms }: { terms: { slug: string; term: string }[] }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [v, setV] = useState({ a: "", b: "", slug: "", by: "", website: "" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const errors = state.kind === "error" ? (state.fields ?? {}) : {};

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/riddle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: v.a, b: v.b, slug: v.slug, by: v.by, website: v.website, startedAt: startedAt.current }) });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; fields?: Record<string, string> } | null;
      if (res.ok && body?.ok) {
        setState({ kind: "sent" });
        setV({ a: "", b: "", slug: "", by: "", website: "" });
        startedAt.current = Date.now();
      } else setState({ kind: "error", message: body?.error ?? "It could not be sent. Please try again.", fields: body?.fields });
    } catch {
      setState({ kind: "error", message: "It could not be sent. Check your connection and try again." });
    }
  };

  if (state.kind === "sent") {
    return (
      <div className="rounded-[8px] border border-accent bg-surface p-21" role="status">
        <p className="font-display text-xl text-ink">Received. Thank you.</p>
        <p className="mt-8 text-ink-2">A member of staff will read it. If it is approved it will appear on this page; not every riddle is published, and you will not be contacted either way.</p>
        <button type="button" className="btn btn-ghost mt-13" onClick={() => setState({ kind: "idle" })}>
          Send another
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="panel grid gap-13 p-21" aria-busy={state.kind === "sending"}>
      <p className="text-sm text-ink-2">Two lines that describe one word from the glossary, without naming it. It is read by a member of staff before it appears, and not every riddle is published. Please do not include your name in full, contact details or anything about an account.</p>
      {(["a", "b"] as const).map((k) => (
        <div key={k} className="field">
          <label htmlFor={id(k)}>{k === "a" ? "First line" : "Second line"}</label>
          <input id={id(k)} className="input" maxLength={120} value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? id(`${k}-err`) : undefined} required />
          {errors[k] && (
            <p id={id(`${k}-err`)} className="field-error">
              {errors[k]}
            </p>
          )}
        </div>
      ))}
      <div className="grid gap-13 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={id("slug")}>The answer</label>
          <select id={id("slug")} className="select" value={v.slug} onChange={(e) => setV((s) => ({ ...s, slug: e.target.value }))} aria-invalid={!!errors.slug} required>
            <option value="">Choose a glossary term</option>
            {terms.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.term}
              </option>
            ))}
          </select>
          {errors.slug && <p className="field-error">{errors.slug}</p>}
        </div>
        <div className="field">
          <label htmlFor={id("by")}>
            Initials <span className="normal-case tracking-normal text-ink-3">(optional, shown with it)</span>
          </label>
          <input id={id("by")} className="input" maxLength={24} value={v.by} onChange={(e) => setV((s) => ({ ...s, by: e.target.value }))} autoComplete="off" aria-invalid={!!errors.by} />
          {errors.by && <p className="field-error">{errors.by}</p>}
        </div>
      </div>
      {/* a field people do not see and software fills in: anything in it is discarded */}
      <div className="sr-only" aria-hidden>
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => setV((s) => ({ ...s, website: e.target.value }))} />
      </div>
      {state.kind === "error" && (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Send the riddle"}
        </button>
      </div>
      <p className="text-xs text-ink-3">Only the two lines, the answer and the initials are kept. No e-mail address is asked for.</p>
    </form>
  );
}

/* ---- THE SONNET ----------------------------------------------------------- */

const SONNETS: { title: string; lines: readonly string[] }[] = [
  {
    title: "On the stop",
    lines: [
      "Before the trade, while judgement still is clear,",
      "decide the price at which the thought is wrong,",
      "and set it there, and let it stay, though fear",
      "will later beg you: move it, just along.",
      "For what is moved once will be moved again,",
      "and small, agreed-on loss turns into great;",
      "the plan was made by you in calmer vein",
      "than you who now would bargain with the gate.",
      "A stop is not a wall against all ill:",
      "a gap can leap it, and the fill be worse.",
      "It is a promise kept against your will,",
      "a shorter line to close a longer verse.",
      "  Set it in quiet; leave it in the storm.",
      "  The calm self chose. Let that self keep its form.",
    ],
  },
  {
    title: "On leverage",
    lines: [
      "A little coin laid down, and in its name",
      "a hundred coins are moved across the board;",
      "the market’s motion stays the very same,",
      "but what it means to you is far more broad.",
      "One part in every hundred, should it fall,",
      "takes all you laid: the stake is wholly gone.",
      "The lever lifted nothing, after all,",
      "except how near the edge you stood upon.",
      "It is not given: it is yours to choose.",
      "The ceiling that is offered is not law.",
      "The size you take decides how much you lose",
      "and whether you are there to trade once more.",
      "  So take the lever lightly, and in part:",
      "  the smaller hand is still there at the start.",
    ],
  },
  {
    title: "On the candle",
    lines: [
      "Four prices in a single shape are set:",
      "the open, where the period began;",
      "the high and low, the furthest that it met;",
      "the close: the place at which its journey ran.",
      "The body shows the distance it has kept,",
      "the wicks, the ground it travelled and gave back;",
      "a long wick says: here price went, and then stepped",
      "away again, returning on its track.",
      "And that is all. It tells what has been done.",
      "It does not know the candle yet to come.",
      "The pattern with a name is still but one",
      "account of what has passed, and then is dumb.",
      "  Read it as record. Do not ask it more.",
      "  Tomorrow’s bar has not been drawn before.",
    ],
  },
  {
    title: "On the spread",
    lines: [
      "Between the price to buy and price to sell",
      "there lies a gap that every trade must cross;",
      "no bill is sent, no ledger line to tell,",
      "yet each trade starts by standing at a loss.",
      "It narrows when the market’s rooms are full,",
      "and widens when the lamps are burning low;",
      "at news it gapes, a sudden outward pull,",
      "then closes when the crowd returns to flow.",
      "One crossing is a thing too small to mind.",
      "A thousand crossings are a sum indeed.",
      "The trader who trades least will often find",
      "the toll that others paid, they did not need.",
      "  Count every crossing. Ask if it is due.",
      "  The gap is small. It is not small times you.",
    ],
  },
];

export function Sonnet() {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    const d = new Date();
    setAt((d.getUTCFullYear() * 12 + d.getUTCMonth()) % SONNETS.length);
  }, []);
  const s = SONNETS[at ?? 0];
  return (
    <figure className="max-w-[38rem]">
      <figcaption className="eyebrow">{s.title}</figcaption>
      <blockquote className="mt-13 font-display text-[0.9375rem] leading-relaxed text-ink sm:text-lg" aria-live="polite">
        {s.lines.map((l, i) => (
          <span key={l} className={`block ${i === 4 || i === 8 || i === 12 ? "mt-13" : ""} ${i >= 12 ? "pl-21" : ""}`}>
            {l.trim()}
          </span>
        ))}
      </blockquote>
      <p className="mt-13 text-xs text-ink-3">Fourteen lines on one idea. A new sonnet each month. A way to remember, not advice.</p>
    </figure>
  );
}
