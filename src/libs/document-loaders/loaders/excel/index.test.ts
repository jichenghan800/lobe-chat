import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { ExcelLoader } from './index';

describe('ExcelLoader', () => {
  it('splits workbook rows into searchable chunks', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      { city: 'Beijing', count: 12 },
      { city: 'Shanghai', count: 8 },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const chunks = await ExcelLoader(new Blob([buffer]));

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      metadata: { row: 1, sheetName: 'Orders', source: 'excel' },
      pageContent: expect.stringContaining('city: Beijing'),
    });
    expect(chunks[1].pageContent).toContain('count: 8');
  });
});
