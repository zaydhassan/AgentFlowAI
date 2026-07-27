// Client-side CSV export helpers — no server round-trip. Builds a CSV string
// in the browser and triggers a download via a Blob URL. Safe for cells that
// contain commas, quotes, or newlines (RFC 4180 quoting + "" escaping).
//
// Use `rowsToCSV` to turn an array of records into a CSV table, and
// `downloadCSV` to assemble multiple labelled sections into one file and save
// it. Both run only in the browser (document/Blob/URL), so keep them in
// client components or event handlers.

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote the cell if it has any of: comma, double-quote, newline, or
  // leading/trailing whitespace. Embedded quotes are doubled.
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convert an array of records into a CSV string (header row + data rows). */
export function rowsToCSV(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** A labelled CSV section, rendered as `# Title` followed by its table. */
export type CSVSection = { title: string; csv: string };

/**
 * Assemble the given sections into one CSV document and trigger a browser
 * download named `filename`. Sections are separated by blank lines and each
 * is introduced by a `# Title` line so the file stays human-readable while
 * remaining importable by spreadsheet apps.
 */
export function downloadCSV(filename: string, sections: CSVSection[]): void {
  if (typeof document === "undefined") return;
  const csv = sections.map((s) => `# ${s.title}\n${s.csv}`).join("\n\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}