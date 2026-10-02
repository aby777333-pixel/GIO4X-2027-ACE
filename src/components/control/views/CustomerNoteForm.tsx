"use client";

import { useActionState, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addPersonNote, type PersonNoteError, type PersonNoteState } from "@/app/control/actions-customers";
import { Notice } from "@/components/control/bits";
import { SubmitButton } from "@/components/control/SubmitButton";
import { NOTE_MAX } from "@/components/control/timeline";

const ERRORS: Record<PersonNoteError, { title: string; text: string }> = {
  invalid: { title: "That note could not be accepted", text: "Nothing was saved. What you typed is still here." },
  empty: { title: "Write the note first", text: "Nothing was saved: the box was empty." },
  long: { title: "The note is too long", text: "Nothing was saved. A note is up to 2,000 characters; what you typed is still here." },
  mentions: { title: "Too many colleagues mentioned", text: "Nothing was saved. A note can mention up to 20 colleagues; what you typed is still here." },
  forbidden: { title: "Your role does not allow this", text: "Nothing was saved. Writing a note about a person needs a role that works with customers." },
  missing: { title: "This person is no longer on record", text: "Nothing was saved: there is no longer an enquiry, a ticket or a subscription under this address." },
  save: { title: "The note could not be saved", text: "Nothing was saved. What you typed is still here; please try again." },
};

/** How far back from the caret an "@" is looked for: longer than any display name (80) cannot be a mention being typed. */
const LOOK_BACK = 81;
const SHOWN = 8;
const WORD = /[\p{L}\p{N}_]/u;

type Picker = { start: number; matches: string[] };

/**
 * The "@" being typed at the caret, if there is one: the nearest "@" before the
 * caret on the same line that does not follow a letter or digit, where what
 * has been typed since begins somebody's name. Names contain spaces, so the
 * fragment may too.
 */
function pickerAt(text: string, caret: number, names: readonly string[]): Picker | null {
  for (let i = caret - 1; i >= 0 && i >= caret - LOOK_BACK; i--) {
    const ch = text[i];
    if (ch === "\n") return null;
    if (ch !== "@") continue;
    const before = i > 0 ? (text[i - 1] ?? "") : "";
    if (before && WORD.test(before)) return null;
    const typed = text.slice(i + 1, caret).toLowerCase();
    const matches = names.filter((n) => n.toLowerCase().startsWith(typed));
    return matches.length ? { start: i, matches: matches.slice(0, SHOWN) } : null;
  }
  return null;
}

/**
 * The box for a new note about a person, with "@" to mention a colleague.
 *
 * Typing "@" opens a short list of the colleagues who can be mentioned, under
 * the box. Arrow keys move through it, Enter or Tab puts the name in, Escape
 * closes it; a name can also be chosen with the pointer. Choosing only writes
 * "@Display Name" into the text. Who is told is decided on the server when
 * the note is saved, from the text alone: this component sends no id, and
 * holds only names.
 *
 * What is typed stays here if the server refuses the note (the action answers
 * the form; nothing typed ever travels in a URL). After a note is saved the
 * page gives this component a new key, which empties the box.
 */
export function CustomerNoteForm({ personKey, names }: { personKey: string; names: string[] }) {
  const [state, action] = useActionState<PersonNoteState, FormData>(addPersonNote, {});
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  // the "@" whose list was closed with Escape: it stays closed until the caret leaves that mention
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [said, setSaid] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const moveCaretTo = useRef<number | null>(null);
  const uid = useId();
  const listId = `${uid}-people`;

  const found = useMemo(() => pickerAt(text, caret, names), [text, caret, names]);
  const picker = found && found.start !== dismissed ? found : null;
  const index = picker ? Math.min(active, picker.matches.length - 1) : 0;
  const problem = state.error ? ERRORS[state.error] : null;

  // after a name is put in, the caret goes to the end of it (React would leave it at the end of the box)
  useLayoutEffect(() => {
    if (moveCaretTo.current === null || !box.current) return;
    box.current.setSelectionRange(moveCaretTo.current, moveCaretTo.current);
    moveCaretTo.current = null;
  });

  function track(el: HTMLTextAreaElement) {
    const at = el.selectionStart ?? el.value.length;
    setCaret(at);
    const next = pickerAt(el.value, at, names);
    if (!next || next.start !== dismissed) setDismissed(null);
    if (!next || !found || next.start !== found.start) setActive(0);
  }

  function choose(name: string) {
    if (!picker) return;
    const head = `${text.slice(0, picker.start)}@${name} `;
    const next = head + text.slice(caret).replace(/^ /, "");
    if (next.length > NOTE_MAX) {
      setSaid(`${name} was not added: the note would be longer than 2,000 characters.`);
      return;
    }
    setText(next);
    setCaret(head.length);
    setActive(0);
    // this mention is finished: "@Ann " must not reopen the list because an Ann Lee exists
    setDismissed(picker.start);
    moveCaretTo.current = head.length;
    setSaid(`${name} will be mentioned.`);
    box.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!picker) return;
    const count = picker.matches.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index - 1 + count) % count);
    } else if (event.key === "Enter" || event.key === "Tab") {
      const name = picker.matches[index];
      if (!name) return;
      event.preventDefault();
      choose(name);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(picker.start);
      setSaid("The list of colleagues was closed.");
    }
  }

  return (
    <form action={action} className="grid gap-13">
      <input type="hidden" name="key" value={personKey} />

      {problem && (
        <Notice title={problem.title} tone="error">
          {problem.text}
        </Notice>
      )}

      <div className="field">
        <label htmlFor={`${uid}-body`}>Add a note</label>
        <div className="relative">
          <textarea
            ref={box}
            id={`${uid}-body`}
            name="body"
            className="textarea"
            rows={4}
            maxLength={NOTE_MAX}
            required
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              track(e.target);
            }}
            onKeyDown={onKeyDown}
            onKeyUp={(e) => {
              // keys that move the caret without changing the text; the keys the list uses are handled above
              if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key) || !picker) track(e.currentTarget);
            }}
            onClick={(e) => track(e.currentTarget)}
            onFocus={() => setDismissed(null)}
            onBlur={() => setDismissed(found ? found.start : null)}
            aria-describedby={`${uid}-hint`}
            aria-autocomplete="list"
            aria-controls={picker ? listId : undefined}
            aria-activedescendant={picker ? `${listId}-${index}` : undefined}
          />
          {picker && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Colleagues you can mention"
              className="absolute left-0 top-full z-2 mt-3 max-h-[14rem] w-full max-w-[20rem] overflow-y-auto rounded-[8px] border border-line-strong bg-surface p-3 shadow-2"
            >
              {picker.matches.map((name, i) => (
                <li
                  key={name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === index}
                  // keep the caret in the box: the pointer chooses, it does not take focus
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(name)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-8 rounded-[5px] px-8 py-5 text-sm ${i === index ? "bg-surface-2 font-medium text-ink outline outline-1 outline-line-strong" : "text-ink-2"}`}
                >
                  <span aria-hidden className="text-ink-3">
                    @
                  </span>
                  <span className="min-w-0 truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p id={`${uid}-hint`} className="field-hint">
          Staff only, up to 2,000 characters. A note cannot be changed or removed afterwards: a correction is a new note.{" "}
          {names.length > 0 ? "Type @ to mention a colleague and choose the name from the list: the mention is then listed for them at the top of their Customers page." : "There is nobody else to mention yet."} Do not record passwords, card numbers or
          one-time codes.
        </p>
      </div>

      {/* what the list is doing, for someone who cannot see it */}
      <p role="status" aria-live="polite" className="sr-only">
        {picker ? `${picker.matches.length} ${picker.matches.length === 1 ? "colleague matches" : "colleagues match"}. Up and down arrows to choose, Enter to put the name in, Escape to close.` : said}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-13">
        <SubmitButton pending="Saving…" className="btn btn-ghost">
          Add note
        </SubmitButton>
        <span className="num text-xs text-ink-3" aria-hidden>
          {text.length.toLocaleString("en-GB")} / 2,000
        </span>
      </div>
    </form>
  );
}
