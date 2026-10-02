"use client";

import { useId, useRef, useState } from "react";
import { applyDeskFile, checkDeskFile, DESK_KEY_NAME, exportDesk, MAX_FILE_BYTES, type ImportCheck } from "./store";

type Checked = Extract<ImportCheck, { ok: true }>;

/**
 * Move a desk to another device without an account: export writes the desk's
 * keys to one JSON file the visitor keeps; import reads such a file back.
 *
 * The file is built and read entirely in the browser. It is never uploaded:
 * "import" opens it with the File API and nothing else. A file is checked in
 * full before anything is written (see checkDeskFile), and what it would
 * replace is listed and confirmed first.
 */
export function DeskTransfer() {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<Checked | null>(null);

  const say = (ok: string | null, bad: string | null = null) => {
    setMessage(ok);
    setProblem(bad);
  };

  const download = () => {
    setPending(null);
    const { text, count } = exportDesk();
    if (count === 0) {
      say("There is nothing to export yet: this browser holds none of the desk’s items.");
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `gio4x-desk-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2600);
      say(`Exported ${count} ${count === 1 ? "item" : "items"} to a file. It is saved by your browser, on this device, and was not sent anywhere.`);
    } catch {
      say(null, "The file could not be created in this browser.");
    }
  };

  const read = async (file: File | undefined) => {
    setPending(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      say(null, "The file is larger than a desk file can be, so it was not read.");
      return;
    }
    let text = "";
    try {
      text = await file.text();
    } catch {
      say(null, "The file could not be read.");
      return;
    }
    const check = checkDeskFile(text);
    if (!check.ok) {
      say(null, `${check.reason} Nothing was changed.`);
      return;
    }
    say(null);
    setPending(check);
  };

  const confirm = () => {
    if (!pending) return;
    const ok = applyDeskFile(pending.keys);
    setPending(null);
    if (!ok) {
      say(null, "This browser refused to store the file’s contents. Nothing further was changed.");
      return;
    }
    say("Imported. Reloading so that every page uses what was read…");
    // the tools and the display keep their own copies in memory: a reload is the one way to refresh them all
    window.setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div>
      <h3 className="h4">Take your desk to another device</h3>
      <p className="mt-8 max-w-measure text-sm text-ink-2">
        Export writes your watchlist, saved pages, recent list, calculator figures, learning progress and display preferences to one file that you keep. Import reads such a file in this browser. The file is never uploaded.
      </p>
      <div className="mt-13 flex flex-wrap items-center gap-13">
        <button type="button" className="btn btn-ghost" onClick={download}>
          Export to a file
        </button>
        <label htmlFor={inputId} className="btn btn-ghost cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
          Import from a file
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              // the same file can be chosen again after a refusal
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {pending && (
        <div className="panel mt-21 max-w-measure p-21" role="group" aria-label="Confirm import">
          <p className="h4">Replace what this browser holds?</p>
          <p className="mt-8 text-sm text-ink-2">The file was checked and contains the items below. Each one replaces what this browser holds for it now. Items the file does not contain are left as they are.</p>
          <ul className="mt-13 border-t border-line">
            {pending.keys.map((k) => (
              <li key={k.key} className="flex flex-wrap items-baseline justify-between gap-x-21 border-b border-line py-8 text-sm">
                <span className="font-medium text-ink">{DESK_KEY_NAME[k.key]}</span>
                <span className="num text-ink-3">{k.size}</span>
              </li>
            ))}
          </ul>
          <div className="mt-21 flex flex-wrap gap-13">
            <button type="button" className="btn btn-primary" onClick={confirm}>
              Replace and reload
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setPending(null);
                say("Import cancelled. Nothing was changed.");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-13 max-w-measure text-sm text-ink-2">
        {message}
      </p>
      {problem && (
        <p role="alert" className="mt-5 max-w-measure border-l-2 border-[var(--warn)] pl-13 text-sm text-ink">
          <span className="font-semibold">Not imported.</span> {problem}
        </p>
      )}
    </div>
  );
}
