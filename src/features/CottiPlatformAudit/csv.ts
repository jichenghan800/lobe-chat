const sanitizeSpreadsheetCell = (value: unknown) => {
  const text = String(value ?? '');
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

export const escapeCottiPlatformAuditCsvCell = (value: unknown) => {
  const text = sanitizeSpreadsheetCell(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const buildCottiPlatformAuditCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(escapeCottiPlatformAuditCsvCell).join(',')).join('\n');

export const downloadCottiPlatformAuditCsv = (rows: unknown[][]) => {
  const csv = buildCottiPlatformAuditCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `cotti-platform-audit-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
