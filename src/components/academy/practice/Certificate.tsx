"use client";

import Link from "next/link";
import { useState } from "react";
import { LESSON_PREFIX, useLearned } from "@/components/glossary/learn";

/**
 * THE CERTIFICATE — a page to print when every lesson of an Academy level has
 * been completed (all three questions of each lesson answered correctly, as
 * recorded in this browser under gx:learn).
 *
 * It is a record of lessons read and questions answered on this device, and
 * it says so on its face: it is not a qualification, a licence or evidence of
 * any ability to trade. The name is typed by the visitor, is never stored and
 * is gone when the page is closed. The seal draws itself once, by CSS, when a
 * certificate appears.
 */

export type Level = { level: string; slugs: string[] };

export function Certificate({ levels }: { levels: Level[] }) {
  const learned = useLearned();
  const [name, setName] = useState("");
  const [at, setAt] = useState<number | null>(null);

  if (learned === null) return <p className="text-ink-3">Your record is read once the page has loaded.</p>;

  const rows = levels.map((l) => {
    const have = l.slugs.filter((s) => learned[`${LESSON_PREFIX}${s}`]).length;
    return { ...l, have, done: have === l.slugs.length };
  });
  const firstDone = rows.findIndex((r) => r.done);
  const shown = at ?? (firstDone >= 0 ? firstDone : null);
  const cert = shown !== null && rows[shown]?.done ? rows[shown] : null;
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <ul className="no-print border-t border-line">
        {rows.map((r, i) => (
          <li key={r.level} className="flex flex-wrap items-center gap-13 border-b border-line py-13">
            <span className="h4 min-w-[9rem]">{r.level}</span>
            <span className="num text-sm text-ink-3">
              {r.have} of {r.slugs.length} lessons
            </span>
            {r.done ? (
              <button type="button" className="btn btn-ghost ml-auto" aria-pressed={shown === i} onClick={() => setAt(i)}>
                Show the certificate
              </button>
            ) : (
              <Link href="/academy" className="go ml-auto min-h-[2.75rem]">
                {r.slugs.length - r.have} to go
              </Link>
            )}
          </li>
        ))}
      </ul>

      {cert ? (
        <>
          <div className="no-print mt-21 grid max-w-narrow gap-5">
            <label htmlFor="cert-name" className="label">
              Name to print on it <span className="normal-case tracking-normal text-ink-3">(not stored)</span>
            </label>
            <input id="cert-name" className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Your name" autoComplete="off" />
          </div>
          <article key={cert.level} className="gx-cert mt-21" aria-label={`Certificate: ${cert.level}`}>
            <p className="label">GIO4X Academy</p>
            <h3 className="mt-13 font-display text-3xl text-ink">{cert.level}</h3>
            <p className="mt-13 text-ink-2">All {cert.slugs.length} lessons of this level completed, each with its three questions answered correctly{name.trim() ? ", by" : "."}</p>
            {name.trim() && <p className="mt-8 font-display text-2xl text-ink">{name.trim()}</p>}
            <svg className="gx-cert-seal" viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="52" pathLength="1" />
              <circle cx="60" cy="60" r="42" pathLength="1" />
              <path d="M38 62 L54 78 L84 44" pathLength="1" />
            </svg>
            <p className="mt-13 text-sm text-ink-3">{date}</p>
            <p className="mt-21 border-t border-line pt-13 text-xs text-ink-3">
              A record of lessons read and questions answered in one browser. It is not a qualification, a licence or evidence of an ability to trade, and it is not verified by GIO4X.
            </p>
          </article>
          <button type="button" className="btn btn-primary no-print mt-21" onClick={() => window.print()}>
            Print it
          </button>
        </>
      ) : (
        <p className="mt-21 max-w-measure text-ink-2">
          No level is complete yet. A lesson counts once all three of its questions have been answered correctly, on this device. Finish every lesson of a level and its certificate appears here.
        </p>
      )}
    </div>
  );
}
