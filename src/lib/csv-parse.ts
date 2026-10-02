/**
 * CSV reading, by hand and with no dependency, for the enquiry import in GIO4X
 * Control. It runs in the browser: the file never leaves the page as a file.
 *
 * RFC 4180, read carefully:
 *   · a record ends at CRLF; a bare LF or a bare CR is accepted as well;
 *   · the last record may or may not end with a line break;
 *   · a field may be wrapped in double quotes; inside the quotes a separator
 *     and a line break are part of the value and a quote is written twice;
 *   · a quote that is not at the very start of a field is an ordinary
 *     character (spreadsheets write 5" unquoted), but a quoted field must end
 *     at its closing quote: anything but spaces between that quote and the
 *     next separator is an error, as is a quote that is never closed.
 * Beyond the RFC:
 *   · a byte-order mark at the start is dropped (spreadsheets add one);
 *   · the separator may be a semicolon or a tab, which is what spreadsheet
 *     applications write in locales where the comma is the decimal mark;
 *   · a record whose fields are all empty is skipped (blank lines between
 *     records, trailing blank lines, a line of nothing but separators);
 *   · records need not all have the same number of fields: the caller treats
 *     a missing field as empty.
 * Nothing is trimmed and nothing is interpreted: a cell is exactly the text
 * between its separators. Hard limits stop a hostile or mistaken file early.
 *
 * No imports, on purpose: the unit tests load this file on its own.
 */

export type CsvDelimiter = "," | ";" | "\t";

export type CsvErrorCode =
  /** no record with any content */
  | "empty"
  /** a quoted field that is never closed, or text after a closing quote */
  | "quote"
  /** more records than `maxRows` */
  | "too_many_rows"
  /** a record with more fields than `maxColumns` */
  | "too_many_columns"
  /** a field longer than `maxCell` characters */
  | "cell_too_long";

export type CsvOptions = {
  /** left out: detected from the first line */
  delimiter?: CsvDelimiter;
  /** the most records (blank ones not counted) the file may hold */
  maxRows?: number;
  maxColumns?: number;
  maxCell?: number;
};

export type CsvResult =
  | {
      ok: true;
      delimiter: CsvDelimiter;
      rows: string[][];
      /** for each row, the line of the file it starts on (1-based), for messages */
      lines: number[];
    }
  | { ok: false; error: CsvErrorCode; /** the line of the file the problem is on (1-based) */ line: number };

const BOM = 0xfeff;
const QUOTE = '"';

/**
 * The separator, judged from the first line that has anything on it: whichever
 * of comma, semicolon and tab appears most often outside quotes. A comma when
 * there is nothing to go on.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  let seen = false;
  for (let i = text.charCodeAt(0) === BOM ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === QUOTE) {
      quoted = !quoted;
      seen = true;
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (seen) break;
    } else {
      if (!quoted && (ch === "," || ch === ";" || ch === "\t")) counts[ch] += 1;
      seen = true;
    }
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  return ",";
}

export function parseCsv(text: string, options: CsvOptions = {}): CsvResult {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;
  const maxColumns = options.maxColumns ?? 200;
  const maxCell = options.maxCell ?? 100_000;

  const rows: string[][] = [];
  const lines: number[] = [];
  const end = text.length;

  let i = text.charCodeAt(0) === BOM ? 1 : 0;
  /** the line of the file `i` is on */
  let line = 1;
  let record: string[] = [];
  /** the line the current record started on */
  let recordLine = 1;
  let cell = "";
  /**
   * A field has begun and is not yet in the record: something was read into
   * it, it was quoted, or a separator has just promised one more field.
   */
  let open = false;
  /** the current record has a field that is not empty */
  let content = false;

  const endCell = (): CsvErrorCode | null => {
    if (cell.length > maxCell) return "cell_too_long";
    record.push(cell);
    if (record.length > maxColumns) return "too_many_columns";
    if (cell !== "") content = true;
    cell = "";
    open = false;
    return null;
  };
  const endRecord = (): CsvErrorCode | null => {
    if (content) {
      if (rows.length >= maxRows) return "too_many_rows";
      rows.push(record);
      lines.push(recordLine);
    }
    record = [];
    content = false;
    return null;
  };

  while (i < end) {
    const ch = text[i];

    // A quoted field: recognised only at the very start of a field. Everything
    // up to the closing quote is the value; a doubled quote is one quote.
    if (ch === QUOTE && cell === "") {
      const opened = line;
      let closed = false;
      i += 1;
      while (i < end) {
        const c = text[i];
        if (c === QUOTE) {
          if (text[i + 1] === QUOTE) {
            cell += QUOTE;
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        // CRLF counts once, at its LF
        if (c === "\n" || (c === "\r" && text[i + 1] !== "\n")) line += 1;
        cell += c;
        i += 1;
      }
      if (!closed) return { ok: false, error: "quote", line: opened };
      // after the closing quote: spaces at most, then a separator, a line break or the end
      while (i < end && text[i] === " ") i += 1;
      if (i < end && text[i] !== delimiter && text[i] !== "\n" && text[i] !== "\r") return { ok: false, error: "quote", line };
      // the separator or line break that follows is read on the next turn
      open = true;
      continue;
    }

    if (ch === delimiter) {
      const failed = endCell();
      if (failed) return { ok: false, error: failed, line };
      // one more field follows, even if the file ends here
      open = true;
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      const failed = endCell() ?? endRecord();
      if (failed) return { ok: false, error: failed, line: recordLine };
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }

    cell += ch;
    open = true;
    i += 1;
  }

  // the last record has no line break after it
  if (open) {
    const failed = endCell();
    if (failed) return { ok: false, error: failed, line: recordLine };
  }
  if (record.length > 0) {
    const failed = endRecord();
    if (failed) return { ok: false, error: failed, line: recordLine };
  }

  if (rows.length === 0) return { ok: false, error: "empty", line: 1 };
  return { ok: true, delimiter, rows, lines };
}
