/**
 * One CSV cell, quoted only when it has to be (comma, quote or line break),
 * with embedded quotes doubled, so a value can never spill into other columns.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of cells as CSV text (rows joined with "\n"). */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
