import type { WorkSheet } from 'xlsx';
import * as XLSX from 'xlsx';

import type { DocumentChunk } from '../../types';

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) return '';

  return String(value).trim();
};

const worksheetToChunks = (worksheet: WorkSheet, sheetName: string): DocumentChunk[] => {
  const rows = worksheet['!ref']
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      })
    : [];

  if (rows.length === 0) {
    return [
      {
        metadata: { row: 0, sheetName, source: 'excel' },
        pageContent: `Sheet: ${sheetName}\n*Sheet is empty or contains no data.*`,
      },
    ];
  }

  return rows.map((row, index) => {
    const content = Object.entries(row)
      .map(([key, value]) => `${key}: ${formatCellValue(value)}`)
      .join('\n');

    return {
      metadata: {
        row: index + 1,
        sheetName,
        source: 'excel',
      },
      pageContent: `Sheet: ${sheetName}\nRow: ${index + 1}\n${content}`,
    };
  });
};

export const ExcelLoader = async (fileBlob: Blob): Promise<DocumentChunk[]> => {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

  return workbook.SheetNames.flatMap((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    return worksheet ? worksheetToChunks(worksheet, sheetName) : [];
  });
};
