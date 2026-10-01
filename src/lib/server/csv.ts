/**
 * CSV writing for exports from GIO4X Control.
 *
 * Formula injection: a spreadsheet treats a cell that begins with = + - or @
 * (and, in some applications, a tab or carriage return) as a formula. The
 * exported values were typed by strangers into a public form, so any such cell
 * is prefixed with a single quote, which makes the spreadsheet show it as text.
 * Every cell is also quoted, with embedded quotes doubled (RFC 4180).
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_LEAD.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  // BOM so spreadsheet applications read UTF-8; CRLF line endings per RFC 4180
  return `${String.fromCharCode(0xfeff)}${lines.join("\r\n")}\r\n`;
}
