import { describe, expect, it } from 'vitest';

import { createPdfBlob, decodePdfBase64 } from './pdfData';

const PDF_BASE64 = 'JVBERi0xLjQKJSVFT0YK';

describe('PDF base64 data', () => {
  it('decodes server PDF data into bytes accepted by PDF.js', () => {
    const bytes = decodePdfBase64(PDF_BASE64);

    expect(new TextDecoder().decode(bytes)).toBe('%PDF-1.4\n%%EOF\n');
  });

  it('creates a downloadable PDF blob from the same bytes', () => {
    const blob = createPdfBlob(PDF_BASE64);

    expect(blob.size).toBe(15);
    expect(blob.type).toBe('application/pdf');
  });
});
