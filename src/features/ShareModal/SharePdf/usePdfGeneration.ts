import { useCallback, useState } from 'react';

import { lambdaQuery } from '@/libs/trpc/client/lambda';

import { createPdfBlob } from './pdfData';

interface PdfGenerationParams {
  content: string;
  sessionId: string;
  title: string;
  topicId?: string;
}

interface PdfGenerationState {
  downloadPdf: () => Promise<void>;
  error: string | null;
  generatePdf: (params: PdfGenerationParams) => Promise<void>;
  loading: boolean;
  pdfData: string | null;
}

export const usePdfGeneration = (): PdfGenerationState => {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('chat-export.pdf');
  const [error, setError] = useState<string | null>(null);

  const exportPdfMutation = lambdaQuery.exporter.exportPdf.useMutation();

  const generatePdf = useCallback(
    async (params: PdfGenerationParams) => {
      const { content, sessionId, title, topicId } = params;

      // Prevent multiple simultaneous requests only; allow user to re-generate
      if (exportPdfMutation.isPending) return;

      try {
        setError(null);
        setPdfData(null);

        const result = await exportPdfMutation.mutateAsync({
          content,
          sessionId,
          title,
          topicId,
        });

        setPdfData(result.pdf);
        setFilename(result.filename);
      } catch (error) {
        console.error('Failed to generate PDF:', error);
        setError(error instanceof Error ? error.message : 'Failed to generate PDF');
      }
    },
    [exportPdfMutation.mutateAsync],
  );

  const downloadPdf = useCallback(async () => {
    if (!pdfData) return;

    try {
      const blob = createPdfBlob(pdfData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      throw error;
    }
  }, [pdfData, filename]);

  return {
    downloadPdf,
    error: error || (exportPdfMutation.error?.message ?? null),
    generatePdf,
    loading: exportPdfMutation.isPending,
    pdfData,
  };
};
