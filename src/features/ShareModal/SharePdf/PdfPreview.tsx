'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, createModal } from '@lobehub/ui/base-ui';
import { Input } from 'antd';
import { createStaticStyles, cx } from 'antd-style';
import { ChevronLeft, ChevronRight, Expand, FileText, FileWarning } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Document, Page } from '@/libs/pdfjs';

import { containerStyles } from '../style';
import { decodePdfBase64 } from './pdfData';

const styles = createStaticStyles(({ css, cssVar }) => ({
  containerWrapper: css`
    position: relative;
    width: 100%;
    height: 100%;
  `,
  documentLoading: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
    padding: 20px;
  `,
  emptyState: css`
    display: flex;
    align-items: center;
    justify-content: center;

    height: 100%;

    color: ${cssVar.colorTextSecondary};
  `,
  errorDescription: css`
    max-width: 320px;
    color: ${cssVar.colorTextSecondary};
    text-align: center;
  `,
  errorState: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;

    height: 100%;
    padding: 20px;

    color: ${cssVar.colorError};
  `,
  errorTitle: css`
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  expandButton: css`
    position: absolute;
    z-index: 1000;
    inset-block-start: 20px;
    inset-inline-end: 20px;
  `,
  footerNavigation: css`
    position: absolute;
    z-index: 10;
    inset-block-end: 0;
    inset-inline: 0;

    padding: 12px;
    border-block-start: 1px solid color-mix(in srgb, black 10%, transparent);

    background: color-mix(in srgb, white 90%, transparent);
    backdrop-filter: blur(8px);
  `,
  fullscreenButton: css`
    border-color: white;
    color: white;
  `,
  fullscreenContent: css`
    display: flex;
    align-items: flex-start;
    justify-content: center;

    min-height: 100%;
    padding: 20px;
  `,
  fullscreenModal: css`
    position: relative;
    overflow: auto;
    height: 90vh;
  `,
  fullscreenNavigation: css`
    position: fixed;
    z-index: 1001;
    inset-block-end: 20px;
    inset-inline-start: 50%;
    transform: translateX(-50%);

    padding-block: 12px;
    padding-inline: 20px;
    border-radius: 8px;

    background: color-mix(in srgb, black 70%, transparent);
    backdrop-filter: blur(8px);
  `,
  fullscreenPageInput: css`
    width: 60px;
    text-align: center;
  `,
  fullscreenPageText: css`
    min-width: 20px;
    font-size: 14px;
    color: white;
  `,
  loadingState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
  `,
  loadingText: css`
    margin-block-start: 8px;
    color: ${cssVar.colorTextSecondary};
  `,
  pageInput: css`
    width: 50px;
    text-align: center;
  `,
  pageNumberText: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  previewContainer: css`
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12px;
  `,
}));

interface FullscreenContentProps {
  initialPage: number;
  pdfData: string;
}

const PdfPreviewError = memo(() => {
  const { t } = useTranslation('chat');

  return (
    <div className={styles.errorState} role="alert">
      <FileWarning size={28} />
      <div className={styles.errorTitle}>{t('shareModal.pdfPreviewError')}</div>
      <div className={styles.errorDescription}>{t('shareModal.pdfPreviewErrorDescription')}</div>
    </div>
  );
});

PdfPreviewError.displayName = 'PdfPreviewError';

const FullscreenContent = memo<FullscreenContentProps>(({ pdfData, initialPage }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const pdfFile = useMemo(() => ({ data: decodePdfBase64(pdfData) }), [pdfData]);

  const goToPrev = () => {
    if (pageNumber > 1) setPageNumber(pageNumber - 1);
  };

  const goToNext = () => {
    if (pageNumber < numPages) setPageNumber(pageNumber + 1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) setPageNumber(page);
  };

  return (
    <div className={styles.fullscreenModal}>
      <div className={styles.fullscreenContent}>
        <Document
          error={<PdfPreviewError />}
          file={pdfFile}
          onLoadSuccess={({ numPages: total }: { numPages: number }) => setNumPages(total)}
        >
          <Page
            error={<PdfPreviewError />}
            pageNumber={pageNumber}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            width={Math.min(window.innerWidth * 0.8, 1000)}
          />
        </Document>
      </div>

      {numPages > 1 && (
        <div className={styles.fullscreenNavigation}>
          <Flexbox horizontal align="center" gap={12}>
            <Button
              className={styles.fullscreenButton}
              disabled={pageNumber <= 1}
              icon={<ChevronLeft size={16} />}
              size="small"
              type="text"
              onClick={goToPrev}
            />
            <Flexbox horizontal align="center" gap={8}>
              <Input
                className={styles.fullscreenPageInput}
                max={numPages}
                min={1}
                size="small"
                type="number"
                value={pageNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) goToPage(value);
                }}
              />
              <span className={styles.fullscreenPageText}>/ {numPages}</span>
            </Flexbox>
            <Button
              className={styles.fullscreenButton}
              disabled={pageNumber >= numPages}
              icon={<ChevronRight size={16} />}
              size="small"
              type="text"
              onClick={goToNext}
            />
          </Flexbox>
        </div>
      )}
    </div>
  );
});

FullscreenContent.displayName = 'PdfFullscreenContent';

const openPdfFullscreenModal = (pdfData: string, initialPage: number) =>
  createModal({
    content: <FullscreenContent initialPage={initialPage} pdfData={pdfData} />,
    footer: null,
    maskClosable: true,
    styles: {
      content: { padding: 0 },
      header: { display: 'none' },
    },
    width: '95vw',
  });

interface PdfPreviewProps {
  loading: boolean;
  onGeneratePdf?: () => void;
  pdfData: string | null;
}

const PdfPreview = memo<PdfPreviewProps>(({ loading, pdfData, onGeneratePdf }) => {
  const localStyles = styles;
  const { t } = useTranslation('chat');
  const isMobile = useIsMobile();

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [failedPdfData, setFailedPdfData] = useState<string | null>(null);
  const pdfFile = useMemo(() => {
    if (!pdfData) return null;

    try {
      return { data: decodePdfBase64(pdfData) };
    } catch (error) {
      console.error('Failed to decode PDF preview data:', error);
      return null;
    }
  }, [pdfData]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setFailedPdfData(null);
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Failed to load PDF preview:', error);
    setFailedPdfData(pdfData);
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    }
  };

  if (loading) {
    return (
      <div
        className={cx(containerStyles.preview, containerStyles.previewWide)}
        style={{ padding: 12 }}
      >
        <div className={localStyles.loadingState}>
          <NeuralNetworkLoading size={32} />
          <div className={localStyles.loadingText}>{t('shareModal.generatingPdf')}</div>
        </div>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div
        className={cx(containerStyles.preview, containerStyles.previewWide)}
        style={{ padding: 12 }}
      >
        <div className={localStyles.emptyState}>
          <Button icon={<FileText size={20} />} size="large" type="primary" onClick={onGeneratePdf}>
            {t('shareModal.generatePdf')}
          </Button>
        </div>
      </div>
    );
  }

  const previewFailed = !pdfFile || failedPdfData === pdfData;

  const handleFullscreen = () => {
    if (pdfData) openPdfFullscreenModal(pdfData, pageNumber);
  };

  return (
    <div className={localStyles.containerWrapper}>
      {!previewFailed && (
        <Button
          className={localStyles.expandButton}
          icon={<Expand size={16} />}
          size="small"
          type="text"
          onClick={handleFullscreen}
        />
      )}

      <div
        className={cx(
          containerStyles.preview,
          containerStyles.previewWide,
          localStyles.previewContainer,
        )}
      >
        {previewFailed ? (
          <PdfPreviewError />
        ) : (
          <Document
            error={<PdfPreviewError />}
            file={pdfFile}
            loading={
              <div className={localStyles.documentLoading}>
                <NeuralNetworkLoading size={32} />
                <div className={localStyles.loadingText}>{t('shareModal.loadingPdf')}</div>
              </div>
            }
            onLoadError={onDocumentLoadError}
            onLoadSuccess={onDocumentLoadSuccess}
            onSourceError={onDocumentLoadError}
          >
            <Page
              error={<PdfPreviewError />}
              pageNumber={pageNumber}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              width={isMobile ? 300 : 400}
              onLoadError={onDocumentLoadError}
              onRenderError={onDocumentLoadError}
            />
          </Document>
        )}
      </div>

      {!previewFailed && numPages > 1 && (
        <div className={localStyles.footerNavigation}>
          <Flexbox horizontal align="center" gap={8} justify="center">
            <Button
              disabled={pageNumber <= 1}
              icon={<ChevronLeft size={16} />}
              size="small"
              type="text"
              onClick={goToPrevPage}
            />
            <Flexbox horizontal align="center" gap={4}>
              <Input
                className={localStyles.pageInput}
                max={numPages}
                min={1}
                size="small"
                type="number"
                value={pageNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) goToPage(value);
                }}
              />
              <span className={localStyles.pageNumberText}>/ {numPages}</span>
            </Flexbox>
            <Button
              disabled={pageNumber >= numPages}
              icon={<ChevronRight size={16} />}
              size="small"
              type="text"
              onClick={goToNextPage}
            />
          </Flexbox>
        </div>
      )}
    </div>
  );
});

export default PdfPreview;
