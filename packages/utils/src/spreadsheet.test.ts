import { describe, expect, it } from 'vitest';

import {
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
