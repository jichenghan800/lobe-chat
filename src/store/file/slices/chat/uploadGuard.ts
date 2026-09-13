import { getFileExtension, isExcelFileNameOrType } from '@/utils/spreadsheet';

const SUPPORTED_CHAT_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const SUPPORTED_CHAT_IMAGE_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp']);

const SUPPORTED_CHAT_AUDIO_EXTENSIONS = new Set([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'weba',
]);

const SUPPORTED_CHAT_DOCUMENT_EXTENSIONS = new Set([
  'bat',
  'bash',
  'c',
  'cfg',
  'conf',
  'cpp',
  'cs',
  'csv',
  'cts',
  'dart',
  'db',
  'diff',
  'doc',
  'docx',
  'env',
  'go',
  'gradle',
  'groovy',
  'h',
  'hpp',
  'htm',
  'html',
  'ini',
  'ipynb',
  'java',
  'js',
  'json',
  'json5',
  'jsonc',
  'jsx',
  'kt',
  'less',
  'log',
  'lua',
  'markdown',
  'md',
  'mdx',
  'mjs',
  'mts',
  'patch',
  'pdf',
  'php',
  'properties',
  'pptx',
  'ps1',
  'py',
  'rb',
  'rs',
  'scala',
  'scss',
  'sh',
  'sql',
  'svelte',
  'svg',
  'swift',
  'toml',
  'ts',
  'tsx',
  'txt',
  'v',
  'sv',
  'vue',
  'xls',
  'xlsx',
  'xml',
  'yaml',
  'yml',
]);

const SUPPORTED_CHAT_DOCUMENT_MIME_TYPES = new Set([
  'application/json',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/markdown',
  'text/plain',
]);

export const LARGE_EXCEL_UPLOAD_LIMIT_BYTES = 128 * 1024;

export const isExcelFile = (file: File) => isExcelFileNameOrType(file.name, file.type);

export const isLargeExcelFile = (file: File) =>
  isExcelFile(file) && file.size > LARGE_EXCEL_UPLOAD_LIMIT_BYTES;

// Canonical audio mime for each supported extension. Audio containers like .m4a share the
// ISO-BMFF box layout with .mp4, so the browser often reports an empty mime and byte-sniffing
// (file-type) can report `video/mp4`. We trust the extension for these to keep them classified
// and rendered as audio.
const AUDIO_EXTENSION_MIME_TYPES: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  weba: 'audio/webm',
};

/**
 * Returns the canonical audio mime for a filename whose extension is a known audio container,
 * or `undefined` otherwise. Use this to backfill/override an empty or mis-detected mime so the
 * file is classified and rendered as audio. See lobehub/lobehub#15988.
 */
export const audioMimeFromExtension = (filename: string): string | undefined =>
  AUDIO_EXTENSION_MIME_TYPES[getFileExtension(filename)];

export const isSupportedChatUploadFile = (file: File) => {
  const fileType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);

  if (fileType.startsWith('image/')) {
    return SUPPORTED_CHAT_IMAGE_TYPES.has(fileType);
  }

  if (!fileType && SUPPORTED_CHAT_IMAGE_EXTENSIONS.has(extension)) return true;

  if (fileType.startsWith('video/')) return true;

  if (fileType.startsWith('audio/')) return true;

  // Some audio containers (e.g. .m4a) report an empty or non-audio mime in the
  // browser, so fall back to the extension before the document checks below.
  if (SUPPORTED_CHAT_AUDIO_EXTENSIONS.has(extension)) return true;

  if (extension) return SUPPORTED_CHAT_DOCUMENT_EXTENSIONS.has(extension);

  if (fileType.startsWith('text/')) return true;

  return SUPPORTED_CHAT_DOCUMENT_MIME_TYPES.has(fileType);
};

export const filterSupportedChatUploadFiles = (files: File[]) => {
  const supportedFiles: File[] = [];
  const unsupportedFiles: File[] = [];

  for (const file of files) {
    if (isSupportedChatUploadFile(file)) {
      supportedFiles.push(file);
    } else {
      unsupportedFiles.push(file);
    }
  }

  return { supportedFiles, unsupportedFiles };
};

const getExcelContentSheetCount = async (file: File): Promise<number> => {
  const { strFromU8, unzip } = await import('fflate');
  const fileData = new Uint8Array(await file.arrayBuffer());
  const archive = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(fileData, (error, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(files);
    });
  });

  return Object.entries(archive).filter(([path, data]) => {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/i.test(path)) return false;

    return /<c(?:\s|>)/i.test(strFromU8(data));
  }).length;
};

export const filterExcelChatUploadFiles = async (files: File[]) => {
  const excelFiles = files.filter(isExcelFile);

  if (excelFiles.length > 1) {
    return {
      allowedFiles: files.filter((file) => !isExcelFile(file)),
      excelFilesRequiringAgentMode: excelFiles,
    };
  }

  const allowedFiles: File[] = [];
  const excelFilesRequiringAgentMode: File[] = [];

  for (const file of files) {
    if (!isExcelFile(file)) {
      allowedFiles.push(file);
      continue;
    }

    if (isLargeExcelFile(file)) {
      excelFilesRequiringAgentMode.push(file);
      continue;
    }

    try {
      const contentSheetCount = await getExcelContentSheetCount(file);

      if (contentSheetCount > 1) {
        excelFilesRequiringAgentMode.push(file);
      } else {
        allowedFiles.push(file);
      }
    } catch {
      excelFilesRequiringAgentMode.push(file);
    }
  }

  return { allowedFiles, excelFilesRequiringAgentMode };
};
