'use client';

import { Block, Flexbox } from '@lobehub/ui';
import { Tabs, Text } from '@lobehub/ui/base-ui';
import { BotIcon, MessageSquareWarningIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AgentErrorsTable } from './AgentErrorsTable';
import { ChatErrorsTable } from './ChatErrorsTable';
import { useCottiPlatformAnalyticsErrorDetails } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface ErrorDistributionProps {
  enabled: boolean;
  range: CottiPlatformAnalyticsRangeSelection;
}

export const ErrorDistribution = memo<ErrorDistributionProps>(({ enabled, range }) => {
  const { t } = useTranslation('setting');
  const details = useCottiPlatformAnalyticsErrorDetails();

  return (
    <Block className={styles.detailSection} padding={0} variant={'outlined'}>
      <Flexbox className={styles.detailHeader} gap={12}>
        <Flexbox gap={4}>
          <Text fontSize={18} weight={600}>
            {t('platformAnalytics.errors.title')}
          </Text>
          <Text fontSize={13} type={'secondary'}>
            {t('platformAnalytics.errors.desc')}
          </Text>
        </Flexbox>
        <Tabs
          activeKey={details.view}
          items={[
            {
              icon: <MessageSquareWarningIcon size={16} />,
              key: 'chat',
              label: t('platformAnalytics.errors.tabs.chat'),
            },
            {
              icon: <BotIcon size={16} />,
              key: 'agent',
              label: t('platformAnalytics.errors.tabs.agent'),
            },
          ]}
          onChange={(key) => details.setView(key as 'agent' | 'chat')}
        />
      </Flexbox>
      {details.view === 'agent' ? (
        <AgentErrorsTable
          enabled={enabled}
          range={range}
          state={details.agent}
          onPageChange={details.setAgentPage}
          onQueryChange={details.setAgentQuery}
          onSortChange={details.setAgentSort}
        />
      ) : (
        <ChatErrorsTable
          enabled={enabled}
          range={range}
          state={details.chat}
          onPageChange={details.setChatPage}
          onQueryChange={details.setChatQuery}
          onSortChange={details.setChatSort}
        />
      )}
    </Block>
  );
});

ErrorDistribution.displayName = 'ErrorDistribution';
