import { describe, expect, it } from 'vitest';

import {
  assertChatSpreadsheetSize,
  getFileExtension,
  isExcelFileNameOrType,
  isSpreadsheetFileNameOrType,
} from './spreadsheet';

describe('spreadsheet helpers', () => {
  it('recognizes Excel and CSV files by extension or MIME type', () => {
    expect(isExcelFileNameOrType('REPORT.XLSX')).toBe(true);
    expect(isExcelFileNameOrType('upload', 'application/vnd.ms-excel')).toBe(true);
    expect(isSpreadsheetFileNameOrType('transactions.csv')).toBe(true);
    expect(isSpreadsheetFileNameOrType('upload', 'text/csv')).toBe(true);
    expect(isSpreadsheetFileNameOrType('guide.pdf', 'application/pdf')).toBe(false);
  });

  it('normalizes file extensions', () => {
    expect(getFileExtension('Quarterly.Report.XLSM')).toBe('xlsm');
    expect(getFileExtension('README')).toBe('readme');
  });
});

it('enforces the shared Chat limit by extension or MIME type', () => {
  expect(() => assertChatSpreadsheetSize('data.CSV', '', 128 * 1024 + 1)).toThrow(
    'Switch to Agent mode',
  );
  expect(() => assertChatSpreadsheetSize('upload', 'text/csv', 128 * 1024 + 1)).toThrow();
  expect(() => assertChatSpreadsheetSize('data.xlsx', '', 128 * 1024 + 1)).toThrow();
  expect(() => assertChatSpreadsheetSize('data.csv', '', 128 * 1024)).not.toThrow();
  expect(() => assertChatSpreadsheetSize('notes.txt', 'text/plain', 128 * 1024 + 1)).not.toThrow();
});
