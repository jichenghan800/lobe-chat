export const decodePdfBase64 = (pdfData: string) =>
  Uint8Array.from(globalThis.atob(pdfData), (character) => character.charCodeAt(0));

export const createPdfBlob = (pdfData: string) =>
  new Blob([decodePdfBase64(pdfData)], { type: 'application/pdf' });
