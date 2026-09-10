'use client';

import { Block, Empty, Flexbox, Icon, SearchBar } from '@lobehub/ui';
import { Button, Segmented, Select, Skeleton, Tag, Text, toast } from '@lobehub/ui/base-ui';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BotIcon,
  DownloadIcon,
  EyeIcon,
  FileWarningIcon,
  ListTodoIcon,
  MessageCircleIcon,
  PaperclipIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { sharedStyles } from '@/features/CottiPlatformManagement/sharedStyle';
import type {
  CottiPlatformAuditFeature,
  CottiPlatformAuditItem,
  CottiPlatformAuditRange,
  CottiPlatformAuditRiskFilter,
} from '@/types/cotti/platformAudit';

import { AuditDetailDrawer } from './AuditDetailDrawer';
import { downloadCottiPlatformAuditCsv } from './csv';
import { AUDIT_TABLE_COLUMN_WIDTHS, AUDIT_TABLE_MIN_WIDTH } from './layout';
import { RiskTags } from './RiskTags';
import { styles } from './style';
import { useCottiPlatformAudit } from './useCottiPlatformAudit';

interface MetricCardProps {
  icon: typeof ShieldAlertIcon;
  title: string;
  value: number;
}

const MetricCard = memo<MetricCardProps>(({ icon, title, value }) => (
  <Block className={sharedStyles.card} gap={8} padding={16} variant={'outlined'}>
    <Flexbox horizontal align={'center'} gap={8}>
      <Icon icon={icon} size={16} />
      <Text fontSize={13} type={'secondary'}>
        {title}
      </Text>
    </Flexbox>
    <Text fontSize={24} weight={600}>
      {value.toLocaleString()}
    </Text>
  </Block>
));

MetricCard.displayName = 'MetricCard';

const CottiPlatformAudit = memo(() => {
  const { i18n, t } = useTranslation(['setting', 'topic']);
  const {
    activeMessageId,
    analysisLoadingId,
    analyzeMessage,
    closeDetail,
    dashboardSWR,
    detailSWR,
    queryInput,
    resetFilters,
    setFeature,
    setPage,
    setQuery,
    setRange,
    setRiskLevel,
    showDetail,
    state,
  } = useCottiPlatformAudit();
  const dashboard = dashboardSWR.data;

  const featureOptions = useMemo(
    () =>
      (['all', 'chat', 'agent', 'task', 'tool', 'search'] as const).map((value) => ({
        label: t(`platformManagement.audit.feature.${value}`),
        value,
      })),
    [t],
  );
  const riskOptions = useMemo(
    () =>
      (['flagged', 'high', 'medium', 'low', 'none', 'all'] as const).map((value) => ({
        label: t(`platformManagement.audit.riskFilter.${value}`),
        value,
      })),
    [t],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [i18n.language],
  );

  const handleAnalyze = async (force: boolean) => {
    if (!activeMessageId) return;

    try {
      await analyzeMessage(activeMessageId, force);
      toast.success(t('platformManagement.audit.feedback.analysisCompleted'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('platformManagement.audit.feedback.analysisFailed'),
      );
    }
  };

  const handleExport = () => {
    if (!dashboard?.items.length) return;

    const rows = [
      [
        t('platformManagement.audit.columns.time'),
        t('platformManagement.audit.columns.user'),
        t('platformManagement.audit.columns.session'),
        t('platformManagement.audit.columns.mode'),
        t('platformManagement.audit.columns.model'),
        t('platformManagement.audit.columns.risk'),
        t('platformManagement.audit.columns.flags'),
        t('platformManagement.audit.columns.analysis'),
      ],
      ...dashboard.items.map((item) => [
        dateTimeFormatter.format(new Date(item.createdAt)),
        item.userName || item.userEmail || item.userId,
        item.sessionTitle || item.sessionId || '',
        t(`platformManagement.audit.type.${item.mode}`),
        [item.provider, item.model].filter(Boolean).join('/'),
        t(`platformManagement.audit.risk.${item.riskLevel}`),
        item.riskFlags
          .map((flag) =>
            t(`platformManagement.audit.flag.${flag.key}`, { defaultValue: flag.label }),
          )
          .join(';'),
        item.analysis?.summary || '',
      ]),
    ];

    downloadCottiPlatformAuditCsv(rows);
  };

  const columns = useMemo<ColumnsType<CottiPlatformAuditItem>>(
    () => [
      {
        dataIndex: 'createdAt',
        render: (value: string) => dateTimeFormatter.format(new Date(value)),
        title: t('platformManagement.audit.columns.time'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.time,
      },
      {
        render: (_, record) => (
          <Flexbox gap={2} style={{ minWidth: 0 }}>
            <Text ellipsis weight={500}>
              {record.userName || record.userEmail || record.userId}
            </Text>
            {record.userName && record.userEmail && (
              <Text ellipsis fontSize={12} type={'secondary'}>
                {record.userEmail}
              </Text>
            )}
          </Flexbox>
        ),
        title: t('platformManagement.audit.columns.user'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.user,
      },
      {
        render: (_, record) => (
          <Flexbox gap={2} style={{ overflowWrap: 'anywhere' }}>
            <Text>{record.model || t('overview.modelNotRecorded', { ns: 'topic' })}</Text>
            {record.provider && (
              <Text fontSize={12} type={'secondary'}>
                {record.provider}
              </Text>
            )}
          </Flexbox>
        ),
        title: t('platformManagement.audit.columns.model'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.model,
      },
      {
        render: (_, record) => (
          <Flexbox gap={4}>
            <Text ellipsis>{record.sessionTitle || record.sessionId || '-'}</Text>
            <Flexbox horizontal gap={4} wrap={'wrap'}>
              <Tag color={record.mode === 'agent' ? 'processing' : undefined}>
                {t(`platformManagement.audit.type.${record.mode}`)}
              </Tag>
              {record.tool && <Tag color={'blue'}>{t('platformManagement.audit.type.tool')}</Tag>}
              {record.search && (
                <Tag color={'cyan'}>{t('platformManagement.audit.type.search')}</Tag>
              )}
              {record.fileCount > 0 && (
                <Tag>{t('platformManagement.audit.type.files', { count: record.fileCount })}</Tag>
              )}
            </Flexbox>
          </Flexbox>
        ),
        title: t('platformManagement.audit.columns.session'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.session,
      },
      {
        render: (_, record) => <RiskTags flags={record.riskFlags} level={record.riskLevel} />,
        title: t('platformManagement.audit.columns.risk'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.risk,
      },
      {
        render: (_, record) => {
          const analysis = record.analysis;
          if (!analysis) {
            return (
              <Text fontSize={13} type={'secondary'}>
                {t('platformManagement.audit.analysis.notAnalyzed')}
              </Text>
            );
          }
          if (analysis.status === 'pending' || analysis.status === 'running') {
            return <Tag color={'processing'}>{t('platformManagement.audit.analysis.running')}</Tag>;
          }
          if (analysis.status === 'failed') {
            return <Tag color={'warning'}>{t('platformManagement.audit.analysis.failed')}</Tag>;
          }

          return (
            <Text ellipsis title={analysis.summary || undefined}>
              {analysis.summary || t('platformManagement.audit.analysis.completed')}
            </Text>
          );
        },
        title: t('platformManagement.audit.columns.analysis'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.analysis,
      },
      {
        render: (_, record) => (
          <Button icon={EyeIcon} size={'small'} onClick={() => showDetail(record.id)}>
            {t('platformManagement.audit.actions.view')}
          </Button>
        ),
        title: t('platformManagement.audit.columns.actions'),
        width: AUDIT_TABLE_COLUMN_WIDTHS.actions,
      },
    ],
    [dateTimeFormatter, showDetail, t],
  );

  const hasFilters =
    !!queryInput || state.feature !== 'all' || state.riskLevel !== 'flagged' || state.page > 1;
  const initialError = !dashboard && dashboardSWR.error;

  return (
    <Flexbox gap={16}>
      <AlertContent />
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>{t('platformManagement.audit.title')}</Text>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.audit.desc')}
          </Text>
        </Flexbox>
        <div className={styles.filterGrid}>
          <SearchBar
            allowClear
            maxLength={100}
            placeholder={t('platformManagement.audit.searchPlaceholder')}
            value={queryInput}
            variant={'filled'}
            onInputChange={setQuery}
          />
          <Select
            options={featureOptions}
            value={state.feature}
            onChange={(value) => value && setFeature(value as 'all' | CottiPlatformAuditFeature)}
          />
          <Select
            options={riskOptions}
            value={state.riskLevel}
            onChange={(value) => value && setRiskLevel(value as CottiPlatformAuditRiskFilter)}
          />
        </div>
        <div className={styles.toolbar}>
          <Segmented
            value={String(state.range)}
            options={([1, 7, 30, 90] as const).map((value) => ({
              label:
                value === 1
                  ? t('platformManagement.audit.range.today')
                  : t('platformManagement.audit.range.days', { count: value }),
              value: String(value),
            }))}
            onChange={(value) => setRange(Number(value) as CottiPlatformAuditRange)}
          />
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Button
              disabled={!dashboard?.items.length}
              icon={DownloadIcon}
              size={'small'}
              type={'text'}
              onClick={handleExport}
            >
              {t('platformManagement.audit.actions.exportPage')}
            </Button>
            <Button
              icon={RefreshCwIcon}
              loading={dashboardSWR.isValidating}
              size={'small'}
              type={'text'}
              onClick={() => void dashboardSWR.mutate()}
            >
              {t('platformManagement.audit.actions.refresh')}
            </Button>
          </Flexbox>
        </div>
      </Block>

      {initialError ? (
        <AsyncError
          error={initialError}
          variant={'block'}
          onRetry={() => void dashboardSWR.mutate()}
        />
      ) : !dashboard ? (
        <Skeleton height={360} />
      ) : (
        <>
          {dashboardSWR.error && (
            <AsyncError
              error={dashboardSWR.error}
              variant={'inline'}
              onRetry={() => void dashboardSWR.mutate()}
            />
          )}
          <div className={styles.metricGrid}>
            <MetricCard
              icon={ShieldAlertIcon}
              title={t('platformManagement.audit.metric.total')}
              value={dashboard.overview.totalMessages}
            />
            <MetricCard
              icon={FileWarningIcon}
              title={t('platformManagement.audit.metric.highRisk')}
              value={dashboard.overview.highRiskMessages}
            />
            <MetricCard
              icon={MessageCircleIcon}
              title={t('platformManagement.audit.metric.chat')}
              value={dashboard.overview.chatMessages}
            />
            <MetricCard
              icon={BotIcon}
              title={t('platformManagement.audit.metric.agent')}
              value={dashboard.overview.agentMessages}
            />
            <MetricCard
              icon={ListTodoIcon}
              title={t('platformManagement.audit.metric.task')}
              value={dashboard.overview.taskMessages}
            />
            <MetricCard
              icon={PaperclipIcon}
              title={t('platformManagement.audit.metric.attachments')}
              value={dashboard.overview.attachmentMessages}
            />
          </div>
          <Block className={sharedStyles.card} gap={12} padding={20} variant={'outlined'}>
            <Flexbox horizontal align={'center'} justify={'space-between'} wrap={'wrap'}>
              <Flexbox gap={2}>
                <Text weight={600}>{t('platformManagement.audit.list.title')}</Text>
                <Text fontSize={12} type={'secondary'}>
                  {t('platformManagement.audit.list.count', { count: dashboard.total })}
                </Text>
              </Flexbox>
            </Flexbox>
            {dashboard.items.length === 0 ? (
              <Empty
                icon={ShieldAlertIcon}
                description={
                  hasFilters
                    ? t('platformManagement.audit.empty.filteredDesc')
                    : t('platformManagement.audit.empty.desc')
                }
                title={
                  hasFilters
                    ? t('platformManagement.audit.empty.filteredTitle')
                    : t('platformManagement.audit.empty.title')
                }
              >
                <Button size={'small'} onClick={resetFilters}>
                  {t('platformManagement.audit.actions.clearFilters')}
                </Button>
              </Empty>
            ) : (
              <Table
                className={styles.table}
                columns={columns}
                dataSource={dashboard.items}
                rowKey={'id'}
                scroll={{ x: AUDIT_TABLE_MIN_WIDTH }}
                size={'small'}
                tableLayout={'fixed'}
                pagination={{
                  current: dashboard.page,
                  pageSize: dashboard.pageSize,
                  pageSizeOptions: [20, 50],
                  showSizeChanger: true,
                  total: dashboard.total,
                }}
                onChange={(pagination) =>
                  setPage(pagination.current || 1, pagination.pageSize === 50 ? 50 : 20)
                }
              />
            )}
          </Block>
        </>
      )}

      <AuditDetailDrawer
        analysisLoading={analysisLoadingId === activeMessageId}
        data={detailSWR.data}
        error={detailSWR.error}
        open={!!activeMessageId}
        onAnalyze={(force) => void handleAnalyze(force)}
        onClose={closeDetail}
        onRetry={() => void detailSWR.mutate()}
      />
    </Flexbox>
  );
});

const AlertContent = memo(() => {
  const { t } = useTranslation(['setting', 'topic']);

  return (
    <Block className={styles.notice} gap={4} padding={16} variant={'outlined'}>
      <Text weight={600}>{t('platformManagement.audit.notice.title')}</Text>
      <Text fontSize={13} type={'secondary'}>
        {t('platformManagement.audit.notice.desc')}
      </Text>
    </Block>
  );
});

AlertContent.displayName = 'AlertContent';
CottiPlatformAudit.displayName = 'CottiPlatformAudit';

export default CottiPlatformAudit;
