"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { importLeadBatch } from "@/app/control/actions-import";
import { Notice } from "@/components/control/bits";
import { detectDelimiter, parseCsv, type CsvDelimiter, type CsvErrorCode } from "@/lib/csv-parse";
import {
  IMPORT_BATCH,
  IMPORT_FIELD_LABEL,
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_PREVIEW,
  IMPORT_REASON_TEXT,
  IMPORT_SOURCE,
  IMPORT_SOURCE_LABEL,
  IMPORT_SOURCES,
  importKey,
  validateImportRow,
  type ImportBatchResult,
  type ImportField,
  type ImportReason,
  type ImportRow,
} from "@/lib/lead-import";
import { CONTACT_TOPICS } from "@/lib/server/constants";
import { toCsv } from "@/lib/server/csv";
import { cleanText } from "@/lib/server/validate";

/**
 * The enquiry import, in four steps: choose a file, say which column is
 * which, check every row, read the result.
 *
 * The file is read HERE, in the browser (csv-parse.ts), and held only in this
 * component's memory: nothing is stored, and nothing is sent until "Import" is
 * pressed on the third step. Then the rows that passed the checks go to the
 * server in batches of 25 (actions-import.ts), each batch answering with the
 * outcome of every row. The list of rejected rows is made here as well, and
 * downloaded straight from the page.
 */

type Step = "file" | "columns" | "check" | "result";
const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "File" },
  { key: "columns", label: "Columns" },
  { key: "check", label: "Check" },
  { key: "result", label: "Result" },
];

/** Which column of the file a field comes from; null when it is not in the file. */
type Mapping = Record<ImportField, number | null>;
/** What every row gets for a field that is not in the file. */
type Fixed = { topic: string; message: string; how: string };

type Checked = {
  /** the line of the file the row starts on */
  line: number;
  /** the row's fields as the file has them */
  input: Record<ImportField, string>;
  state: { kind: "ready"; row: ImportRow } | { kind: "repeat"; row: ImportRow; ofLine: number } | { kind: "invalid"; reasons: ImportReason[] };
};

/** What became of a row once the import has run. */
type Final = { kind: "imported" } | { kind: "duplicate" } | { kind: "repeat" } | { kind: "invalid"; reasons: ImportReason[] } | { kind: "unsent" };

type FileError = "type" | "size" | "encoding" | "rows" | "read" | CsvErrorCode;

const DELIMITER_LABEL: Record<CsvDelimiter, string> = { ",": "Comma", ";": "Semicolon", "\t": "Tab" };

// what a column is usually called, compared without case, spaces or punctuation
const GUESS: Record<ImportField, readonly string[]> = {
  name: ["name", "fullname", "contact", "contactname", "person", "client"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "telephone", "tel", "mobile", "phonenumber", "cell"],
  country: ["country", "countryofresidence"],
  topic: ["topic", "subject", "category"],
  message: ["note", "notes", "message", "comment", "comments", "details", "remarks"],
  how: ["how", "howitcameabout", "source", "channel", "origin"],
};

const EMPTY_MAPPING: Mapping = { name: null, email: null, phone: null, country: null, topic: null, message: null, how: null };

function guessMapping(header: string[]): Mapping {
  const mapping: Mapping = { ...EMPTY_MAPPING };
  const taken = new Set<number>();
  const keys = header.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  for (const field of IMPORT_FIELDS) {
    const at = keys.findIndex((k, i) => !taken.has(i) && GUESS[field].includes(k));
    if (at >= 0) {
      mapping[field] = at;
      taken.add(at);
    }
  }
  return mapping;
}

function fileErrorText(error: FileError, line: number): string {
  switch (error) {
    case "type":
      return "That does not look like a CSV file. Export the sheet as “CSV (comma delimited)” or “CSV UTF-8” and choose that file.";
    case "size":
      return "The file is larger than 1 MB. Split it into smaller files and import them one after another.";
    case "encoding":
      return "The file is not UTF-8 text. In your spreadsheet, save it as “CSV UTF-8” and choose that file.";
    case "rows":
    case "too_many_rows":
      return `The file has more than ${IMPORT_MAX_ROWS} rows. Split it into files of ${IMPORT_MAX_ROWS} rows or fewer and import them one after another.`;
    case "empty":
      return "The file has no rows in it.";
    case "quote":
      return `The file could not be read at line ${line}: a quotation mark opens or closes a value in the wrong place. Export the sheet again as CSV and choose that file.`;
    case "too_many_columns":
      return `Line ${line} has more than 50 columns. Keep only the columns to import.`;
    case "cell_too_long":
      return `A value on line ${line} is far too long to be part of an enquiry.`;
    default:
      return "The file could not be read. Choose it again.";
  }
}

const BATCH_ERROR: Record<Exclude<ImportBatchResult["code"], "ok">, string> = {
  "signed-out": "Your session ended while the import was running. Sign in again, then import the rows that were not attempted.",
  forbidden: "Your role does not allow importing enquiries. It needs an administrator.",
  invalid: "The server did not accept the batch as it was sent.",
  unavailable: "The console could not reach the database.",
  save: "The server did not answer for this batch. It may or may not have been stored: importing the same rows again today is safe, because rows already stored are skipped as duplicates.",
};

const short = (value: string, max = 60) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export function LeadImport() {
  const uid = useId();
  const [step, setStep] = useState<Step>("file");
  const heading = useRef<HTMLHeadingElement | null>(null);
  const first = useRef(true);

  // step 1
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<{ error: FileError; line: number } | null>(null);
  const [reading, setReading] = useState(false);

  // step 2
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [fixed, setFixed] = useState<Fixed>({ topic: "", message: "", how: IMPORT_SOURCE });

  // step 3 and 4
  const [lawful, setLawful] = useState(false);
  const [running, setRunning] = useState(false);
  const [sent, setSent] = useState(0);
  const [finals, setFinals] = useState<Final[] | null>(null);
  const [stopped, setStopped] = useState<Exclude<ImportBatchResult["code"], "ok"> | null>(null);

  // each step opens at its heading, for a keyboard and for a screen reader
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const parsed = useMemo(() => {
    if (!text) return null;
    // one more than the limit, so that "too many" can be told from "exactly the limit plus a header"
    return parseCsv(text, { delimiter, maxRows: IMPORT_MAX_ROWS + 1, maxColumns: 50, maxCell: 20_000 });
  }, [text, delimiter]);

  const table = parsed?.ok ? parsed : null;
  const header = table && hasHeader ? (table.rows[0] ?? []) : [];
  const dataRows = useMemo(() => (table ? (hasHeader ? table.rows.slice(1) : table.rows) : []), [table, hasHeader]);
  const dataLines = useMemo(() => (table ? (hasHeader ? table.lines.slice(1) : table.lines) : []), [table, hasHeader]);
  const columnCount = useMemo(() => (table ? table.rows.reduce((max, r) => Math.max(max, r.length), 0) : 0), [table]);
  const tooMany = dataRows.length > IMPORT_MAX_ROWS;

  const columnLabel = (i: number) => {
    const named = hasHeader ? (header[i] ?? "").trim() : "";
    const sample = (dataRows[0]?.[i] ?? "").trim();
    if (named) return `Column ${i + 1}: ${short(named, 40)}`;
    return sample ? `Column ${i + 1} (first value: ${short(sample, 30)})` : `Column ${i + 1}`;
  };

  // what the mapping still lacks before the rows can be checked
  const missing: string[] = [];
  if (mapping.name === null) missing.push("Choose the column that holds the name.");
  if (mapping.email === null) missing.push("Choose the column that holds the e-mail address.");
  if (mapping.topic === null && !fixed.topic) missing.push("Choose the topic’s column, or one topic for every row.");
  if (mapping.message === null && !cleanText(fixed.message)) missing.push("Choose the note’s column, or write one note for every row.");
  if (table && dataRows.length === 0) missing.push("The file has a first row of column names and nothing under it.");
  if (tooMany) missing.push(`The file has more than ${IMPORT_MAX_ROWS} rows.`);

  const checked = useMemo<Checked[]>(() => {
    const firstSeen = new Map<string, number>();
    return dataRows.map((cells, i): Checked => {
      const at = (field: ImportField) => {
        const column = mapping[field];
        return column === null ? "" : (cells[column] ?? "");
      };
      const input: Record<ImportField, string> = {
        name: at("name"),
        email: at("email"),
        phone: at("phone"),
        country: at("country"),
        topic: mapping.topic === null ? fixed.topic : at("topic"),
        message: mapping.message === null ? fixed.message : at("message"),
        how: mapping.how === null ? fixed.how : at("how"),
      };
      const line = dataLines[i] ?? i + 1;
      const result = validateImportRow(input);
      if (!result.ok) return { line, input, state: { kind: "invalid", reasons: result.reasons } };
      // the same address with the same note twice in one file is one enquiry
      const key = importKey(result.row);
      const earlier = firstSeen.get(key);
      if (earlier !== undefined) return { line, input, state: { kind: "repeat", row: result.row, ofLine: earlier } };
      firstSeen.set(key, line);
      return { line, input, state: { kind: "ready", row: result.row } };
    });
  }, [dataRows, dataLines, mapping, fixed]);

  const counts = useMemo(() => {
    let ready = 0;
    let repeat = 0;
    let invalid = 0;
    for (const c of checked) {
      if (c.state.kind === "ready") ready += 1;
      else if (c.state.kind === "repeat") repeat += 1;
      else invalid += 1;
    }
    return { ready, repeat, invalid };
  }, [checked]);

  /* ---- step 1: the file ---------------------------------------------------- */

  const startOver = () => {
    setStep("file");
    setFileName("");
    setText("");
    setFileError(null);
    setMapping(EMPTY_MAPPING);
    setFixed({ topic: "", message: "", how: IMPORT_SOURCE });
    setHasHeader(true);
    setLawful(false);
    setSent(0);
    setFinals(null);
    setStopped(null);
  };

  const chooseFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    // a CSV file has no reliable type; the name and the content decide
    if (!/\.(csv|txt)$/i.test(file.name) && !/^text\/|csv/.test(file.type)) {
      setFileError({ error: "type", line: 0 });
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      setFileError({ error: "size", line: 0 });
      return;
    }
    setReading(true);
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch (e) {
      setReading(false);
      setFileError({ error: e instanceof TypeError ? "encoding" : "read", line: 0 });
      return;
    }
    setReading(false);
    // a NUL means this is not text at all (a spreadsheet file renamed to .csv)
    if (content.includes("\u0000")) {
      setFileError({ error: "type", line: 0 });
      return;
    }

    const found = detectDelimiter(content);
    const result = parseCsv(content, { delimiter: found, maxRows: IMPORT_MAX_ROWS + 1, maxColumns: 50, maxCell: 20_000 });
    if (!result.ok) {
      setFileError({ error: result.error, line: result.line });
      return;
    }
    setFileName(file.name);
    setText(content);
    setDelimiter(found);
    setHasHeader(true);
    setMapping(guessMapping(result.rows[0] ?? []));
    setStep("columns");
  };

  /* ---- step 3: the import ---------------------------------------------------- */

  const runImport = async () => {
    if (running || !lawful) return;
    const outcome = checked.map((c): Final => (c.state.kind === "invalid" ? { kind: "invalid", reasons: c.state.reasons } : c.state.kind === "repeat" ? { kind: "repeat" } : { kind: "unsent" }));
    const queue = checked.flatMap((c, index) => (c.state.kind === "ready" ? [{ index, row: c.state.row }] : []));
    setRunning(true);
    setSent(0);
    let halted: Exclude<ImportBatchResult["code"], "ok"> | null = null;

    for (let from = 0; from < queue.length; from += IMPORT_BATCH) {
      const batch = queue.slice(from, from + IMPORT_BATCH);
      let answer: ImportBatchResult;
      try {
        answer = await importLeadBatch(batch.map((b) => b.row));
      } catch {
        answer = { code: "save" };
      }
      if (answer.code !== "ok" || answer.results.length !== batch.length) {
        halted = answer.code === "ok" ? "save" : answer.code;
        break;
      }
      answer.results.forEach((r, i) => {
        const target = batch[i];
        if (!target) return;
        outcome[target.index] = r.result === "ok" ? { kind: "imported" } : r.result === "duplicate" ? { kind: "duplicate" } : { kind: "invalid", reasons: [r.reason] };
      });
      setSent(Math.min(from + IMPORT_BATCH, queue.length));
    }

    setFinals(outcome);
    setStopped(halted);
    setRunning(false);
    setStep("result");
  };

  /* ---- step 4: the result ---------------------------------------------------- */

  const tally = useMemo(() => {
    const t = { imported: 0, duplicate: 0, invalid: 0, unsent: 0 };
    for (const f of finals ?? []) {
      if (f.kind === "imported") t.imported += 1;
      else if (f.kind === "duplicate" || f.kind === "repeat") t.duplicate += 1;
      else if (f.kind === "invalid") t.invalid += 1;
      else t.unsent += 1;
    }
    return t;
  }, [finals]);

  /** The rows that were not imported and are not duplicates, with why, as a file made in this browser. */
  const downloadRejected = () => {
    if (!finals) return;
    const rows: string[][] = [];
    finals.forEach((f, i) => {
      const c = checked[i];
      if (!c || (f.kind !== "invalid" && f.kind !== "unsent")) return;
      const why = f.kind === "unsent" ? "Not attempted: the import stopped before this row." : f.reasons.map((r) => IMPORT_REASON_TEXT[r]).join(" ");
      rows.push([String(c.line), why, ...IMPORT_FIELDS.map((field) => c.input[field])]);
    });
    const csv = toCsv(["Line in the file", "Why it was not imported", ...IMPORT_FIELDS.map((f) => IMPORT_FIELD_LABEL[f])], rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "enquiries-not-imported.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /* ---- drawing ------------------------------------------------------------- */

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const stepHeading = (title: string) => (
    <h2 ref={heading} tabIndex={-1} className="gxc-card-title outline-none">
      <span className="text-ink-3">
        Step {stepIndex + 1} of {STEPS.length}:
      </span>{" "}
      {title}
    </h2>
  );

  const stateText = (c: Checked): { ok: boolean; text: string } => {
    if (c.state.kind === "ready") return { ok: true, text: "Ready" };
    if (c.state.kind === "repeat") return { ok: false, text: `Repeats line ${c.state.ofLine}: same address and note. It will be skipped.` };
    return { ok: false, text: c.state.reasons.map((r) => IMPORT_REASON_TEXT[r]).join(" ") };
  };
  const shownValue = (c: Checked, field: ImportField) => (c.state.kind === "invalid" ? c.input[field].trim() : c.state.row[field]);

  return (
    <div data-import-step={step}>
      <ol className="flex flex-wrap gap-x-21 gap-y-5 text-xs" aria-label="Steps of the import">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={s.key === step ? "step" : undefined} className={s.key === step ? "font-semibold text-ink" : i < stepIndex ? "text-ink-2" : "text-ink-3"}>
            <span className="num">{i + 1}</span> {s.label}
            {i < stepIndex && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>

      {step === "file" && (
        <section className="gxc-card mt-13" aria-labelledby={`${uid}-file-h`}>
          <div className="gxc-card-head" id={`${uid}-file-h`}>
            {stepHeading("choose the file")}
          </div>
          <div className="gxc-card-body grid gap-13">
            {fileError && (
              <Notice title="The file was not accepted" tone="error">
                {fileErrorText(fileError.error, fileError.line)}
              </Notice>
            )}
            <div className="field max-w-measure">
              <label htmlFor={`${uid}-file`}>CSV file</label>
              <input
                id={`${uid}-file`}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="input h-auto py-8"
                aria-describedby={`${uid}-file-hint`}
                disabled={reading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // the same file can be chosen again after a correction
                  e.target.value = "";
                  void chooseFile(file);
                }}
              />
              <p id={`${uid}-file-hint`} className="field-hint">
                Up to {IMPORT_MAX_ROWS} rows and 1 MB, saved as CSV in UTF-8, one person per row. It needs a name and an e-mail address for each person; phone, country, topic, a note and how the enquiry came about are optional columns.
                The file is read in this browser: nothing is sent or stored until you press Import on the third step.
              </p>
            </div>
            {reading && (
              <p role="status" className="text-sm text-ink-2">
                Reading the file…
              </p>
            )}
          </div>
        </section>
      )}

      {step === "columns" && (
        <section className="gxc-card mt-13" aria-labelledby={`${uid}-columns-h`}>
          <div className="gxc-card-head" id={`${uid}-columns-h`}>
            {stepHeading("say which column is which")}
          </div>
          <div className="gxc-card-body grid gap-21">
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink break-all">{fileName}</span>
              {table ? (
                <>
                  : <span className="num">{dataRows.length}</span> {dataRows.length === 1 ? "row" : "rows"}, <span className="num">{columnCount}</span> {columnCount === 1 ? "column" : "columns"}.
                </>
              ) : (
                "."
              )}
            </p>

            {parsed && !parsed.ok && (
              <Notice title="The file cannot be read with this separator" tone="error">
                {fileErrorText(parsed.error, parsed.line)}
              </Notice>
            )}

            <div className="grid gap-13 sm:grid-cols-2">
              <div className="field">
                <label htmlFor={`${uid}-sep`}>Values are separated by</label>
                <select id={`${uid}-sep`} className="select" value={delimiter} onChange={(e) => setDelimiter(e.target.value === ";" ? ";" : e.target.value === "\t" ? "\t" : ",")}>
                  {(Object.keys(DELIMITER_LABEL) as CsvDelimiter[]).map((d) => (
                    <option key={d} value={d}>
                      {DELIMITER_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="check self-end pb-8">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                <span>The first row holds the column names, not a person</span>
              </label>
            </div>

            {table && (
              <fieldset className="grid gap-13 sm:grid-cols-2 [&>.field]:content-start">
                <legend className="label mb-8">Where each detail comes from</legend>
                {IMPORT_FIELDS.map((field) => {
                  const required = field === "name" || field === "email";
                  return (
                    <div className="field" key={field}>
                      <label htmlFor={`${uid}-map-${field}`}>
                        {IMPORT_FIELD_LABEL[field]}
                        {field === "phone" || field === "country" ? " (optional)" : ""}
                      </label>
                      <select
                        id={`${uid}-map-${field}`}
                        className="select"
                        value={mapping[field] === null ? "" : String(mapping[field])}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMapping((m) => ({ ...m, [field]: v === "" ? null : Number(v) }));
                        }}
                      >
                        <option value="">{required ? "Choose a column" : "Not in the file"}</option>
                        {Array.from({ length: columnCount }, (_, i) => (
                          <option key={i} value={i}>
                            {columnLabel(i)}
                          </option>
                        ))}
                      </select>

                      {field === "topic" && mapping.topic === null && (
                        <div className="field mt-8">
                          <label htmlFor={`${uid}-fixed-topic`}>Topic for every row</label>
                          <select id={`${uid}-fixed-topic`} className="select" value={fixed.topic} onChange={(e) => setFixed((f) => ({ ...f, topic: e.target.value }))}>
                            <option value="">Choose a topic</option>
                            {CONTACT_TOPICS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {field === "topic" && mapping.topic !== null && <p className="field-hint">Each value must be one of the console’s topics, spelt as in “Add an enquiry” (capital letters do not matter).</p>}

                      {field === "message" && mapping.message === null && (
                        <div className="field mt-8">
                          <label htmlFor={`${uid}-fixed-message`}>Note for every row</label>
                          <textarea
                            id={`${uid}-fixed-message`}
                            className="textarea"
                            rows={3}
                            maxLength={5000}
                            value={fixed.message}
                            onChange={(e) => setFixed((f) => ({ ...f, message: e.target.value }))}
                            aria-describedby={`${uid}-fixed-message-hint`}
                          />
                          <p id={`${uid}-fixed-message-hint`} className="field-hint">
                            What these people asked for and where the list came from. Do not record passwords, card numbers or one-time codes.
                          </p>
                        </div>
                      )}

                      {field === "how" && mapping.how === null && (
                        <div className="field mt-8">
                          <label htmlFor={`${uid}-fixed-how`}>For every row</label>
                          <select id={`${uid}-fixed-how`} className="select" value={fixed.how} onChange={(e) => setFixed((f) => ({ ...f, how: e.target.value }))}>
                            {IMPORT_SOURCES.map((s) => (
                              <option key={s} value={s}>
                                {IMPORT_SOURCE_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {field === "how" && mapping.how !== null && (
                        <p className="field-hint">Each value must be one of: {IMPORT_SOURCES.map((s) => IMPORT_SOURCE_LABEL[s]).join(", ")}. An empty value is recorded as “{IMPORT_SOURCE_LABEL[IMPORT_SOURCE]}”.</p>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}

            {table && missing.length > 0 && (
              <ul id={`${uid}-missing`} className="grid gap-3 text-sm text-ink-2">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-8">
              <button type="button" className="btn btn-primary" disabled={!table || missing.length > 0} aria-describedby={missing.length > 0 ? `${uid}-missing` : undefined} onClick={() => setStep("check")}>
                Check the rows
              </button>
              <button type="button" className="btn btn-quiet" onClick={startOver}>
                Choose another file
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "check" && (
        <>
          <section className="gxc-card mt-13" aria-labelledby={`${uid}-check-h`}>
            <div className="gxc-card-head" id={`${uid}-check-h`}>
              {stepHeading("check the rows")}
            </div>
            <div className="gxc-card-body grid gap-13">
              <p className="text-sm text-ink-2" data-import-summary>
                <span className="font-semibold text-ink">
                  <span className="num">{counts.ready}</span> of <span className="num">{checked.length}</span> {checked.length === 1 ? "row is" : "rows are"} ready to import.
                </span>{" "}
                {counts.invalid > 0 && (
                  <>
                    <span className="num">{counts.invalid}</span> {counts.invalid === 1 ? "has a problem and" : "have problems and"} will not be imported.{" "}
                  </>
                )}
                {counts.repeat > 0 && (
                  <>
                    <span className="num">{counts.repeat}</span> {counts.repeat === 1 ? "repeats" : "repeat"} an earlier row of the file and will be skipped.{" "}
                  </>
                )}
                Every row has been checked against the rules of “Add an enquiry”; {checked.length > IMPORT_PREVIEW ? `the first ${IMPORT_PREVIEW} are shown.` : "all of them are shown."}
              </p>

              <div className="scroll-x hidden md:block">
                <table className="table-gx min-w-[52rem] text-sm">
                  <caption className="sr-only">The first rows of the file as they would be imported, each with the result of its check</caption>
                  <thead>
                    <tr>
                      <th scope="col">Line</th>
                      <th scope="col">Name</th>
                      <th scope="col">E-mail</th>
                      <th scope="col">Topic</th>
                      <th scope="col">Note</th>
                      <th scope="col">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checked.slice(0, IMPORT_PREVIEW).map((c) => {
                      const s = stateText(c);
                      return (
                        <tr key={c.line} data-import-row={c.state.kind}>
                          <td className="num align-top text-ink-3">{c.line}</td>
                          <td className="max-w-[11rem] break-words align-top text-ink">{short(shownValue(c, "name"), 80) || "–"}</td>
                          <td className="max-w-[13rem] break-all align-top text-ink-2">{short(shownValue(c, "email"), 80) || "–"}</td>
                          <td className="align-top text-ink-2">{short(shownValue(c, "topic"), 40) || "–"}</td>
                          <td className="max-w-[14rem] break-words align-top text-ink-2">{short(shownValue(c, "message"), 90) || "–"}</td>
                          <td className="max-w-[16rem] align-top text-xs">
                            <span className={`font-semibold ${s.ok ? "text-pos" : c.state.kind === "repeat" ? "text-ink" : "text-neg"}`}>{s.ok ? "Ready" : c.state.kind === "repeat" ? "Skipped" : "Not imported"}</span>
                            {!s.ok && <span className="mt-3 block text-ink-2">{s.text}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden" aria-label="The first rows of the file, each with the result of its check">
                {checked.slice(0, IMPORT_PREVIEW).map((c) => {
                  const s = stateText(c);
                  return (
                    <li key={c.line} className="border-b border-line py-13 text-sm" data-import-row={c.state.kind}>
                      <span className="flex items-baseline justify-between gap-13">
                        <span className="min-w-0 break-words font-medium text-ink">{short(shownValue(c, "name"), 80) || "No name"}</span>
                        <span className="num shrink-0 text-xs text-ink-3">Line {c.line}</span>
                      </span>
                      <span className="block break-all text-xs text-ink-3">{short(shownValue(c, "email"), 80) || "No address"}</span>
                      <span className="mt-3 block text-xs text-ink-3">{short(shownValue(c, "topic"), 40) || "No topic"}</span>
                      <span className="mt-3 block break-words text-ink-2">{short(shownValue(c, "message"), 90)}</span>
                      <span className={`mt-5 block text-xs font-semibold ${s.ok ? "text-pos" : c.state.kind === "repeat" ? "text-ink" : "text-neg"}`}>{s.ok ? "Ready" : c.state.kind === "repeat" ? "Skipped" : "Not imported"}</span>
                      {!s.ok && <span className="mt-3 block text-xs text-ink-2">{s.text}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="gxc-card mt-21" aria-labelledby={`${uid}-consent-h`}>
            <div className="gxc-card-head">
              <h2 id={`${uid}-consent-h`} className="gxc-card-title">
                Before you import
              </h2>
            </div>
            <div className="gxc-card-body grid gap-13">
              <ul className="grid max-w-measure gap-8 text-sm text-ink-2">
                <li>
                  <span className="font-semibold text-ink">No consent is stored.</span> These people did not accept the Privacy Policy on the website, so every imported enquiry is saved WITHOUT consent evidence and is marked as entered by staff,
                  with your name.
                </li>
                <li>
                  <span className="font-semibold text-ink">No mailings.</span> Do not add any of them to the newsletter or to any other mailing.
                </li>
                <li>
                  <span className="font-semibold text-ink">Tell them.</span> Each person should be told that GIO4X holds their details, and pointed to the{" "}
                  <Link href="/legal/privacy" className="link" target="_blank" rel="noopener">
                    Privacy Policy
                  </Link>
                  .
                </li>
                <li>The audit log records that you imported a file and how many rows, not who was in it.</li>
              </ul>

              <label className="check max-w-measure">
                <input type="checkbox" checked={lawful} disabled={running} onChange={(e) => setLawful(e.target.checked)} />
                <span className="font-medium text-ink">I have a lawful basis to hold these people’s details</span>
              </label>

              {counts.ready === 0 && (
                <p className="text-sm text-ink-2" id={`${uid}-none`}>
                  No row is ready to import. Go back and correct the columns, or correct the file and choose it again.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-8">
                <button type="button" className="btn btn-primary" disabled={!lawful || running || counts.ready === 0} onClick={() => void runImport()}>
                  {running ? "Importing…" : `Import ${counts.ready} ${counts.ready === 1 ? "enquiry" : "enquiries"}`}
                </button>
                <button type="button" className="btn btn-quiet" disabled={running} onClick={() => setStep("columns")}>
                  Back to the columns
                </button>
              </div>
              <p role="status" className="text-sm text-ink-2">
                {running ? `Importing: ${sent} of ${counts.ready} rows sent. Keep this page open.` : ""}
              </p>
            </div>
          </section>
        </>
      )}

      {step === "result" && finals && (
        <section className="gxc-card mt-13" aria-labelledby={`${uid}-result-h`}>
          <div className="gxc-card-head" id={`${uid}-result-h`}>
            {stepHeading("the result")}
          </div>
          <div className="gxc-card-body grid gap-21">
            {stopped && (
              <Notice title="The import stopped before the end" tone="error">
                {BATCH_ERROR[stopped]}
              </Notice>
            )}

            <dl className="grid gap-13 sm:grid-cols-2 lg:grid-cols-4" data-import-tally>
              <div className="gxc-stat">
                <dt className="gxc-stat-label">Imported</dt>
                <dd className="gxc-stat-value" data-tally="imported">
                  {tally.imported}
                </dd>
              </div>
              <div className="gxc-stat">
                <dt className="gxc-stat-label">Duplicates skipped</dt>
                <dd className="gxc-stat-value" data-tally="duplicate">
                  {tally.duplicate}
                </dd>
              </div>
              <div className="gxc-stat">
                <dt className="gxc-stat-label">Not valid</dt>
                <dd className="gxc-stat-value" data-tally="invalid">
                  {tally.invalid}
                </dd>
              </div>
              {tally.unsent > 0 && (
                <div className="gxc-stat">
                  <dt className="gxc-stat-label">Not attempted</dt>
                  <dd className="gxc-stat-value" data-tally="unsent">
                    {tally.unsent}
                  </dd>
                </div>
              )}
            </dl>

            <p className="max-w-measure text-sm text-ink-2">
              A duplicate is a row with the same address and the same note as an earlier row of the file, or as an enquiry staff entered or imported earlier today (UTC). {tally.imported > 0 ? "The imported enquiries are New, unassigned, and marked as entered by staff with no consent." : ""}
            </p>

            <div className="flex flex-wrap items-center gap-8">
              {tally.imported > 0 && (
                <Link href="/control/leads?origin=staff" className="btn btn-primary">
                  See the enquiries entered by staff
                </Link>
              )}
              {tally.invalid + tally.unsent > 0 && (
                <button type="button" className="btn btn-ghost" onClick={downloadRejected}>
                  Download the {tally.invalid + tally.unsent} {tally.invalid + tally.unsent === 1 ? "row" : "rows"} not imported (CSV)
                </button>
              )}
              <button type="button" className="btn btn-quiet" onClick={startOver}>
                Import another file
              </button>
            </div>
            {tally.invalid + tally.unsent > 0 && (
              <p className="max-w-measure text-xs text-ink-3">
                The download is made in this browser from the file you chose, with the reason beside each row. It contains those people’s details: keep it as carefully as the original and delete it when the rows are corrected.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
