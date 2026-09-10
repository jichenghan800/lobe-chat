import { splitPdf } from '../../splitter';
import type { DocumentChunk } from '../../types';
import { loaderConfig } from '../config';

export const PdfLoader = async (fileBlob: Blob): Promise<DocumentChunk[]> => {
  const pdfParse = (await import('pdf-parse')).default;

  // Legacy PDF.js fails on valid PDFs when given a Node Buffer. Pass a plain
  // typed array, as supported by its document API.
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  // @ts-expect-error -- pdf-parse accepts Uint8Array, but its types only declare Buffer.
  const data = await pdfParse(bytes);

  // Split into physical pages using form feed (\f),
  // then recursively chunk each page's text while preserving page numbers.
  return splitPdf(data.text, loaderConfig);
};
