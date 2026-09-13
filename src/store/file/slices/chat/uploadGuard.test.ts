import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  audioMimeFromExtension,
  filterExcelChatUploadFiles,
  filterSupportedChatUploadFiles,
  isLargeExcelFile,
  isSupportedChatUploadFile,
  LARGE_EXCEL_UPLOAD_LIMIT_BYTES,
} from './uploadGuard';

const createWorkbookFile = (
  sheets: Array<{ data: unknown[][]; name: string }>,
  name = 'test.xlsx',
) => {
  const workbookFiles = Object.fromEntries(
    sheets.map((sheet, index) => {
      const cells = sheet.data
        .flatMap((row, rowIndex) =>
          row.map(
            (cell, columnIndex) =>
              `<c r="${String.fromCodePoint(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${String(cell)}</t></is></c>`,
          ),
        )
        .join('');
      const sheetXml = `<worksheet><sheetData>${cells ? `<row>${cells}</row>` : ''}</sheetData></worksheet>`;

      return [`xl/worksheets/sheet${index + 1}.xml`, strToU8(sheetXml)];
    }),
  );
  const buffer = zipSync(workbookFiles);

  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

describe('isSupportedChatUploadFile', () => {
  it('accepts supported chat image formats', () => {
    expect(isSupportedChatUploadFile(new File(['image'], 'image.png', { type: 'image/png' }))).toBe(
      true,
    );
    expect(
      isSupportedChatUploadFile(new File(['image'], 'image.webp', { type: 'image/webp' })),
    ).toBe(true);
  });

  it('rejects unsupported image formats before upload', () => {
    expect(
      isSupportedChatUploadFile(new File(['<svg />'], 'icon.svg', { type: 'image/svg+xml' })),
    ).toBe(false);
    expect(
      isSupportedChatUploadFile(new File(['image'], 'photo.heic', { type: 'image/heic' })),
    ).toBe(false);
  });

  it('accepts supported document formats', () => {
    expect(
      isSupportedChatUploadFile(
        new File(['document'], 'document.pdf', { type: 'application/pdf' }),
      ),
    ).toBe(true);
    expect(
      isSupportedChatUploadFile(new File(['{}'], 'data.json', { type: 'application/json' })),
    ).toBe(true);
  });

  it('accepts Verilog / SystemVerilog source files regardless of detected mime', () => {
    // Browsers report an empty or octet-stream mime for .v/.sv — the extension
    // whitelist must still admit them.
    expect(
      isSupportedChatUploadFile(new File(['module m(); endmodule'], 'adder.v', { type: '' })),
    ).toBe(true);
    expect(
      isSupportedChatUploadFile(
        new File(['module m(); endmodule'], 'adder.v', { type: 'application/octet-stream' }),
      ),
    ).toBe(true);
    expect(
      isSupportedChatUploadFile(new File(['package p; endpackage'], 'top.sv', { type: '' })),
    ).toBe(true);
    expect(
      isSupportedChatUploadFile(
        new File(['package p; endpackage'], 'top.sv', { type: 'text/plain' }),
      ),
    ).toBe(true);
    // Case-insensitive extension matching
    expect(isSupportedChatUploadFile(new File(['x'], 'UPPER.V', { type: '' }))).toBe(true);
    expect(isSupportedChatUploadFile(new File(['x'], 'UPPER.SV', { type: '' }))).toBe(true);
  });

  it('rejects unsupported archive formats before upload', () => {
    expect(
      isSupportedChatUploadFile(new File(['zip'], 'archive.zip', { type: 'application/zip' })),
    ).toBe(false);
  });

  it('accepts audio formats (model-level gating happens in the upload UI)', () => {
    expect(isSupportedChatUploadFile(new File(['a'], 'voice.mp3', { type: 'audio/mpeg' }))).toBe(
      true,
    );
    // .m4a often reports a non-audio or empty mime — fall back to the extension.
    expect(isSupportedChatUploadFile(new File(['a'], 'voice.m4a', { type: '' }))).toBe(true);
    expect(isSupportedChatUploadFile(new File(['a'], 'voice.wav', { type: 'audio/wav' }))).toBe(
      true,
    );
  });
});

describe('isLargeExcelFile', () => {
  it('detects Excel files above the regular chat size limit', () => {
    const largeExcel = new File(
      [new Uint8Array(LARGE_EXCEL_UPLOAD_LIMIT_BYTES + 1)],
      'large.xlsx',
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );
    const smallExcel = new File([new Uint8Array(LARGE_EXCEL_UPLOAD_LIMIT_BYTES)], 'small.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const largeCsv = new File([new Uint8Array(LARGE_EXCEL_UPLOAD_LIMIT_BYTES + 1)], 'large.csv', {
      type: 'text/csv',
    });

    expect(isLargeExcelFile(largeExcel)).toBe(true);
    expect(isLargeExcelFile(smallExcel)).toBe(false);
    expect(isLargeExcelFile(largeCsv)).toBe(false);
  });
});

describe('filterExcelChatUploadFiles', () => {
  it('requires Agent mode when uploading multiple Excel files in regular chat', async () => {
    const firstExcel = createWorkbookFile([{ data: [['a']], name: 'Sheet1' }], 'first.xlsx');
    const secondExcel = createWorkbookFile([{ data: [['b']], name: 'Sheet1' }], 'second.xlsx');
    const textFile = new File(['note'], 'note.txt', { type: 'text/plain' });

    const result = await filterExcelChatUploadFiles([firstExcel, textFile, secondExcel]);

    expect(result.allowedFiles).toEqual([textFile]);
    expect(result.excelFilesRequiringAgentMode).toEqual([firstExcel, secondExcel]);
  });

  it('requires Agent mode for a single Excel file with multiple non-empty sheets', async () => {
    const multiSheetExcel = createWorkbookFile([
      {
        data: [
          ['Engineer', 'Ticket'],
          ['Alice', 'A001'],
        ],
        name: 'Install',
      },
      {
        data: [
          ['Engineer', 'Ticket'],
          ['Bob', 'R001'],
        ],
        name: 'Repair',
      },
    ]);

    const result = await filterExcelChatUploadFiles([multiSheetExcel]);

    expect(result.allowedFiles).toEqual([]);
    expect(result.excelFilesRequiringAgentMode).toEqual([multiSheetExcel]);
  });

  it('allows a small single-sheet Excel file in regular chat', async () => {
    const singleSheetExcel = createWorkbookFile([
      {
        data: [
          ['Engineer', 'Ticket'],
          ['Alice', 'A001'],
        ],
        name: 'Install',
      },
      { data: [], name: 'Empty' },
    ]);

    const result = await filterExcelChatUploadFiles([singleSheetExcel]);

    expect(result.allowedFiles).toEqual([singleSheetExcel]);
    expect(result.excelFilesRequiringAgentMode).toEqual([]);
  });
});

describe('audioMimeFromExtension', () => {
  it('maps known audio extensions to a canonical audio mime', () => {
    expect(audioMimeFromExtension('voice.m4a')).toBe('audio/mp4');
    expect(audioMimeFromExtension('song.mp3')).toBe('audio/mpeg');
    expect(audioMimeFromExtension('clip.WAV')).toBe('audio/wav');
    expect(audioMimeFromExtension('note.opus')).toBe('audio/opus');
  });

  it('returns undefined for non-audio extensions', () => {
    expect(audioMimeFromExtension('movie.mp4')).toBeUndefined();
    expect(audioMimeFromExtension('doc.pdf')).toBeUndefined();
    expect(audioMimeFromExtension('noext')).toBeUndefined();
  });
});

describe('filterSupportedChatUploadFiles', () => {
  it('splits supported and unsupported files by default', () => {
    const png = new File(['image'], 'image.png', { type: 'image/png' });
    const zip = new File(['zip'], 'archive.zip', { type: 'application/zip' });

    const { supportedFiles, unsupportedFiles } = filterSupportedChatUploadFiles([png, zip]);

    expect(supportedFiles).toEqual([png]);
    expect(unsupportedFiles).toEqual([zip]);
  });
});
