import { saveFile } from '../platform/files.js';

// HP-5: Sanitize CSV cells against formula injection attacks
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prefix formula-starting chars with a single quote to neutralise Excel/Sheets macros
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escapeCsvCell(r[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  // A download in the browser; the share sheet in the Android app.
  return saveFile(blob, filename, { title: 'Export' });
}
