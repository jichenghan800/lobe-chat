'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Drawer, Skeleton, Tag, Text } from '@lobehub/ui/base-ui';
import { FileTextIcon, PaperclipIcon, ScanSearchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import type { CottiPlatformAuditDetail } from '@/types/cotti/platformAudit';

import { RiskTags } from './RiskTags';
import { styles } from './style';

interface AuditDetailDrawerProps {
  analysisLoading: boolean;
  data?: CottiPlatformAuditDetail;
  error?: unknown;
  onAnalyze: (force: boolean) => void;
  onClose: () => void;
  onRetry: () => void;
  open: boolean;
}

const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const AuditDetailDrawer = memo<AuditDetailDrawerProps>(
  ({ analysisLoading, data, error, onAnalyze, onClose, onRetry, open }) => {
    const { i18n, t } = useTranslation(['setting', 'topic']);
    const analysis = data?.analysis;

    return (
      <Drawer
        open={open}
        title={t('platformManagement.audit.detail.title')}
        width={'min(90vw, 736px)'}
        onClose={onClose}
      >
        {error ? (
          <AsyncError error={error} variant={'block'} onRetry={onRetry} />
        ) : !data ? (
          <Skeleton height={300} />
        ) : (
          <Flexbox gap={18}>
            <Alert
              showIcon
              message={t('platformManagement.audit.detail.viewLogged')}
              type={'info'}
            />
            <div className={styles.detailMeta}>
              <Flexbox gap={4}>
                <Text type={'secondary'}>{t('platformManagement.audit.columns.user')}</Text>
                <Text weight={500}>{data.userName || data.userEmail || data.userId}</Text>
                {data.userName && data.userEmail && (
                  <Text fontSize={12} type={'secondary'}>
                    {data.userEmail}
                  </Text>
                )}
              </Flexbox>
              <Flexbox gap={4}>
                <Text type={'secondary'}>{t('platformManagement.audit.columns.time')}</Text>
                <Text>
                  {new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  }).format(new Date(data.createdAt))}
                </Text>
              </Flexbox>
              <Flexbox gap={4}>
                <Text type={'secondary'}>{t('platformManagement.audit.columns.session')}</Text>
                <Text>{data.sessionTitle || data.sessionId || '-'}</Text>
              </Flexbox>
              <Flexbox gap={4}>
                <Text type={'secondary'}>{t('platformManagement.audit.columns.mode')}</Text>
                <Text>{t(`platformManagement.audit.type.${data.mode}`)}</Text>
              </Flexbox>
              <Flexbox gap={4}>
                <Text type={'secondary'}>{t('platformManagement.audit.columns.model')}</Text>
                <Text>
                  {[data.provider, data.model].filter(Boolean).join('/') ||
                    t('overview.modelNotRecorded', { ns: 'topic' })}
                </Text>
              </Flexbox>
            </div>
            <Flexbox gap={8}>
              <Text type={'secondary'}>{t('platformManagement.audit.columns.risk')}</Text>
              <RiskTags flags={data.riskFlags} level={data.riskLevel} />
            </Flexbox>
            <Flexbox gap={8}>
              <Text type={'secondary'}>{t('platformManagement.audit.detail.originalPrompt')}</Text>
              <div className={styles.content}>
                {data.content || t('platformManagement.audit.detail.noContent')}
              </div>
            </Flexbox>
            <Flexbox gap={8}>
              <Text type={'secondary'}>{t('platformManagement.audit.detail.attachments')}</Text>
              {data.attachments.length === 0 ? (
                <Text type={'secondary'}>{t('platformManagement.audit.detail.noAttachments')}</Text>
              ) : (
                data.attachments.map((attachment) => (
                  <div className={styles.attachment} key={attachment.id}>
                    <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                      <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
                        <PaperclipIcon size={16} />
                        <Text ellipsis weight={500}>
                          {attachment.name}
                        </Text>
                      </Flexbox>
                      <Text fontSize={12} type={'secondary'}>
                        {formatAttachmentSize(attachment.size)}
                      </Text>
                    </Flexbox>
                    <Text fontSize={12} type={'secondary'}>
                      {attachment.fileType}
                    </Text>
                    {attachment.extractedTextPreview ? (
                      <details className={styles.attachmentDetails}>
                        <summary>
                          <FileTextIcon size={14} />
                          {t('platformManagement.audit.detail.showExtractedText')}
                        </summary>
                        <div className={styles.content}>{attachment.extractedTextPreview}</div>
                      </details>
                    ) : (
                      <Text fontSize={12} type={'secondary'}>
                        {t('platformManagement.audit.detail.noExtractedText')}
                      </Text>
                    )}
                  </div>
                ))
              )}
            </Flexbox>
            <Flexbox gap={10}>
              <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
                <Flexbox gap={2}>
                  <Text weight={600}>{t('platformManagement.audit.detail.analysisTitle')}</Text>
                  <Text fontSize={12} type={'secondary'}>
                    {t('platformManagement.audit.detail.analysisDesc')}
                  </Text>
                </Flexbox>
                <Button
                  icon={ScanSearchIcon}
                  loading={analysisLoading}
                  onClick={() => onAnalyze(!!analysis)}
                >
                  {analysis
                    ? t('platformManagement.audit.actions.reanalyze')
                    : t('platformManagement.audit.actions.analyze')}
                </Button>
              </Flexbox>
              {!analysis ? (
                <Text type={'secondary'}>
                  {t('platformManagement.audit.detail.analysisPending')}
                </Text>
              ) : analysis.status === 'failed' ? (
                <Alert
                  showIcon
                  message={t('platformManagement.audit.detail.analysisFailed')}
                  type={'warning'}
                />
              ) : analysis.status === 'pending' || analysis.status === 'running' ? (
                <Tag color={'processing'}>{t('platformManagement.audit.analysis.running')}</Tag>
              ) : (
                <Flexbox gap={10}>
                  <Text>
                    {analysis.summary || t('platformManagement.audit.analysis.completed')}
                  </Text>
                  {analysis.reason && (
                    <Text fontSize={13} type={'secondary'}>
                      {analysis.reason}
                    </Text>
                  )}
                  {analysis.evidence.map((evidence) => (
                    <div className={styles.content} key={`${evidence.label}-${evidence.quote}`}>
                      <Text weight={600}>{evidence.label}</Text>
                      <br />
                      <Text>{evidence.quote}</Text>
                    </div>
                  ))}
                </Flexbox>
              )}
            </Flexbox>
          </Flexbox>
        )}
      </Drawer>
    );
  },
);

AuditDetailDrawer.displayName = 'AuditDetailDrawer';
