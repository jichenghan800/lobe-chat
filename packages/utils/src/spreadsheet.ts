const EXCEL_FILE_EXTENSIONS = new Set(['xls', 'xlsb', 'xlsm', 'xlsx']);
const SPREADSHEET_FILE_EXTENSIONS = new Set(['csv', ...EXCEL_FILE_EXTENSIONS]);

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const SPREADSHEET_MIME_TYPES = new Set(['text/csv', ...EXCEL_MIME_TYPES]);

export const getFileExtension = (filename: string) =>
  filename.split('.').pop()?.toLowerCase() || '';

export const isExcelFileNameOrType = (name: string, type = '') => {
  const fileType = type.toLowerCase();
  const extension = getFileExtension(name);

  return EXCEL_FILE_EXTENSIONS.has(extension) || EXCEL_MIME_TYPES.has(fileType);
};

export const isSpreadsheetFileNameOrType = (name: string, type = '') => {
  const fileType = type.toLowerCase();
  const extension = getFileExtension(name);

  return SPREADSHEET_FILE_EXTENSIONS.has(extension) || SPREADSHEET_MIME_TYPES.has(fileType);
};
