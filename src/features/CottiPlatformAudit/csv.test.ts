import { describe, expect, it } from 'vitest';

import { buildCottiPlatformAuditCsv, escapeCottiPlatformAuditCsvCell } from './csv';

describe('COTTI platform audit CSV export', () => {
  it('escapes quotes and line breaks', () => {
    expect(escapeCottiPlatformAuditCsvCell('a"b\nc')).toBe('"a""b\nc"');
  });

  it.each(['=HYPERLINK("https://example.com")', '+SUM(1,1)', '-1+2', '@cmd'])(
    'neutralizes spreadsheet formulas in exported metadata: %s',
    (value) => {
      expect(escapeCottiPlatformAuditCsvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`);
    },
  );

  it('builds a CSV without exposing fields that callers did not include', () => {
    expect(
      buildCottiPlatformAuditCsv([
        ['User', 'Risk'],
        ['alice@example.com', 'High'],
      ]),
    ).toBe('"User","Risk"\n"alice@example.com","High"');
  });
});
