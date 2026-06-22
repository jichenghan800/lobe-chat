import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import debug from 'debug';
import * as xlsx from 'xlsx';
import { open } from 'yauzl';

import type { Entry } from 'yauzl';

import type { DocumentPage, FileLoaderInterface } from '../../types';
import { promptTemplate } from './prompt';

const log = debug('file-loaders:excel');

const MB = 1024 * 1024;

const parseLimitBytes = (envName: string, defaultMB: number) => {
  const value = Number(process.env[envName]);

  return Number.isFinite(value) && value > 0 ? value * MB : defaultMB * MB;
};

const MAX_EXCEL_FILE_SIZE_BYTES = parseLimitBytes('FILE_LOADER_EXCEL_MAX_FILE_SIZE_MB', 20);
const MAX_EXCEL_ZIP_ENTRY_BYTES = parseLimitBytes('FILE_LOADER_EXCEL_MAX_ZIP_ENTRY_MB', 80);
const MAX_EXCEL_ZIP_TOTAL_BYTES = parseLimitBytes('FILE_LOADER_EXCEL_MAX_ZIP_TOTAL_MB', 200);

interface ExcelZipStats {
  entries: number;
  maxEntryName: string;
  maxEntryUncompressedBytes: number;
  totalUncompressedBytes: number;
}

const formatMB = (bytes: number) => `${(bytes / MB).toFixed(1)}MB`;

const buildExcelTooLargeError = (reason: string) =>
  new Error(
    [
      'Excel file is too large to parse safely.',
      reason,
      `Limits: file <= ${formatMB(MAX_EXCEL_FILE_SIZE_BYTES)}, uncompressed zip total <= ${formatMB(
        MAX_EXCEL_ZIP_TOTAL_BYTES,
      )}, single zip entry <= ${formatMB(MAX_EXCEL_ZIP_ENTRY_BYTES)}.`,
      'Please split the workbook or export the required sheet as CSV before uploading.',
    ].join(' '),
  );

const isXlsxFile = (filePath: string) => path.extname(filePath).toLowerCase() === '.xlsx';

const inspectXlsxZip = async (filePath: string): Promise<ExcelZipStats> =>
  new Promise((resolve, reject) => {
    open(
      filePath,
      { autoClose: true, lazyEntries: true, validateEntrySizes: false },
      (openError, zipfile) => {
        if (openError) {
          reject(openError);
          return;
        }

        if (!zipfile) {
          reject(new Error('Failed to open Excel zip file.'));
          return;
        }

        const stats: ExcelZipStats = {
          entries: 0,
          maxEntryName: '',
          maxEntryUncompressedBytes: 0,
          totalUncompressedBytes: 0,
        };
        let settled = false;

        const rejectOnce = (error: Error) => {
          if (settled) return;
          settled = true;
          zipfile.close();
          reject(error);
        };

        zipfile.on('entry', (entry: Entry) => {
          if (settled) return;

          stats.entries += 1;
          stats.totalUncompressedBytes += entry.uncompressedSize;

          if (entry.uncompressedSize > stats.maxEntryUncompressedBytes) {
            stats.maxEntryName = entry.fileName;
            stats.maxEntryUncompressedBytes = entry.uncompressedSize;
          }

          if (entry.uncompressedSize > MAX_EXCEL_ZIP_ENTRY_BYTES) {
            rejectOnce(
              buildExcelTooLargeError(
                `Zip entry '${entry.fileName}' expands to ${formatMB(entry.uncompressedSize)}.`,
              ),
            );
            return;
          }

          if (stats.totalUncompressedBytes > MAX_EXCEL_ZIP_TOTAL_BYTES) {
            rejectOnce(
              buildExcelTooLargeError(
                `Zip entries expand to ${formatMB(stats.totalUncompressedBytes)} in total.`,
              ),
            );
            return;
          }

          zipfile.readEntry();
        });

        zipfile.once('end', () => {
          if (settled) return;
          settled = true;
          resolve(stats);
        });

        zipfile.once('error', (error) => {
          rejectOnce(error);
        });

        zipfile.readEntry();
      },
    );
  });

const assertExcelFileParseable = async (filePath: string) => {
  const fileStats = await stat(filePath);

  if (fileStats.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    throw buildExcelTooLargeError(`File size is ${formatMB(fileStats.size)}.`);
  }

  if (!isXlsxFile(filePath)) return;

  const zipStats = await inspectXlsxZip(filePath);
  log('Excel zip preflight passed: %O', {
    entries: zipStats.entries,
    maxEntryName: zipStats.maxEntryName,
    maxEntryUncompressedBytes: zipStats.maxEntryUncompressedBytes,
    totalUncompressedBytes: zipStats.totalUncompressedBytes,
  });
};

/**
 * Converts sheet data (array of objects) to a Markdown table string.
 * Handles empty sheets and escapes pipe characters.
 */
function sheetToMarkdownTable(jsonData: Record<string, any>[]): string {
  log('Converting sheet data to Markdown table, rows:', jsonData?.length || 0);
  if (!jsonData || jsonData.length === 0) {
    log('Sheet is empty, returning placeholder message');
    return '*Sheet is empty or contains no data.*';
  }

  // Ensure all rows have the same keys based on the first row, handle potentially sparse data
  const headers = Object.keys(jsonData[0] || {});
  log('Sheet headers:', headers);
  if (headers.length === 0) {
    log('Sheet has no headers, returning placeholder message');
    return '*Sheet has headers but no data.*';
  }

  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

  log('Building data rows for Markdown table');
  const dataRows = jsonData
    .map((row) => {
      const cells = headers.map((header) => {
        const value = row[header];
        // Handle null/undefined and escape pipe characters within cells
        const cellContent =
          value === null || value === undefined ? '' : String(value).replaceAll('|', '\\|');
        return cellContent.trim(); // Trim whitespace from cells
      });
      return `| ${cells.join(' | ')} |`;
    })
    .join('\n');

  const result = `${headerRow}\n${separatorRow}\n${dataRows}`;
  log('Markdown table created, length:', result.length);
  return result;
}

/**
 * Loads Excel files (.xlsx, .xls) using the 'xlsx' library.
 * Each sheet becomes a DocumentPage containing a Markdown table generated by sheetToMarkdownTable.
 */
export class ExcelLoader implements FileLoaderInterface {
  async loadPages(filePath: string): Promise<DocumentPage[]> {
    log('Loading Excel file:', filePath);
    const pages: DocumentPage[] = [];
    try {
      await assertExcelFileParseable(filePath);

      // Use readFile for async operation compatible with other loaders
      log('Reading Excel file as buffer');
      const dataBuffer = await readFile(filePath);
      log('Excel file read successfully, size:', dataBuffer.length, 'bytes');

      log('Parsing Excel workbook');
      const workbook = xlsx.read(dataBuffer, { type: 'buffer' });
      log('Excel workbook parsed successfully, sheets:', workbook.SheetNames.length);

      for (const sheetName of workbook.SheetNames) {
        log(`Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        // Use sheet_to_json to get array of objects for our custom markdown function
        const jsonData = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, {
          // Get formatted strings, not raw values
          defval: '',
          raw: false, // Use empty string for blank cells
        });
        log(`Sheet ${sheetName} converted to JSON, rows:`, jsonData.length);

        // Convert to markdown using YOUR helper function
        const tableMarkdown = sheetToMarkdownTable(jsonData);

        const lines = tableMarkdown.split('\n');
        const lineCount = lines.length;
        const charCount = tableMarkdown.length;
        log(`Sheet ${sheetName} converted to Markdown, lines: ${lineCount}, chars: ${charCount}`);

        pages.push({
          // Trim whitespace
          charCount,
          lineCount,
          metadata: {
            sheetName,
          },
          pageContent: tableMarkdown.trim(),
        });
        log(`Added sheet ${sheetName} as page`);
      }

      if (pages.length === 0) {
        log('Excel file contains no sheets, creating empty page with error');
        pages.push({
          charCount: 0,
          lineCount: 0,
          metadata: {
            error: 'Excel file contains no sheets.',
          },
          pageContent: '',
        });
      }

      log('Excel loading completed, total pages:', pages.length);
      return pages;
    } catch (e) {
      const error = e as Error;
      log('Error encountered while loading Excel file');
      console.error(`Error loading Excel file ${filePath}: ${error.message}`);
      const errorPage: DocumentPage = {
        charCount: 0,
        lineCount: 0,
        metadata: {
          error: `Failed to load Excel file: ${error.message}`,
        },
        pageContent: '',
      };
      log('Created error page for failed Excel loading');
      return [errorPage];
    }
  }

  /**
   * Aggregates content from Excel sheets (Markdown tables).
   * Adds the sheet name as a header before each table.
   * @param pages Array of DocumentPage objects from loadPages.
   * @returns Aggregated content as a string.
   */
  async aggregateContent(pages: DocumentPage[]): Promise<string> {
    log('Aggregating content from', pages.length, 'Excel pages');
    const result = promptTemplate(pages);

    log('Excel content aggregated successfully, length:', result.length);
    return result;
  }
}
