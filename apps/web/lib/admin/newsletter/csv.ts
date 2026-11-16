/**
 * CSV for a spreadsheet (RFC 4180): comma-separated, CRLF line ends, every
 * cell quoted, and a UTF-8 byte order mark first so Excel reads Arabic.
 */

/** Excel and Sheets run a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

export const CSV_BOM = "﻿";

/**
 * One cell. A value that would run as a formula gets a leading `'`, which a
 * spreadsheet shows as text (`=1+1` → `'=1+1`). Then it is quoted, with any
 * quote inside doubled, so a comma or a line break can't start a new cell.
 */
export function csvCell(value: string | null): string {
  const text = value ?? "";
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The whole file: the mark, a header line, then one line per row. */
export function toCsv(header: readonly string[], rows: readonly (string | null)[][]): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
