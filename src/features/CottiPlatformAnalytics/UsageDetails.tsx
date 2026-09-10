'use client';

import { Block, Flexbox } from '@lobehub/ui';
import { Tabs, Text } from '@lobehub/ui/base-ui';
import { BotIcon, UsersIcon, WorkflowIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AgentUsageTable } from './AgentUsageTable';
import { ChatModelsTable } from './ChatModelsTable';
import { ChatUsersTable } from './ChatUsersTable';
import { useCottiPlatformAnalyticsDetails } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface UsageDetailsProps {
  enabled: boolean;
  range: CottiPlatformAnalyticsRangeSelection;
}

export const UsageDetails = memo<UsageDetailsProps>(({ enabled, range }) => {
  const { t } = useTranslation('setting');
  const details = useCottiPlatformAnalyticsDetails();

  return (
    <Block className={styles.detailSection} padding={0} variant={'outlined'}>
      <Flexbox className={styles.detailHeader} gap={12}>
        <Flexbox gap={4}>
          <Text fontSize={18} weight={600}>
            {t('platformAnalytics.details.title')}
          </Text>
          <Text fontSize={13} type={'secondary'}>
            {t('platformAnalytics.details.desc')}
          </Text>
        </Flexbox>
        <Tabs
          activeKey={details.view}
          items={[
            {
              icon: <UsersIcon size={16} />,
              key: 'users',
              label: t('platformAnalytics.details.tabs.users'),
            },
            {
              icon: <BotIcon size={16} />,
              key: 'models',
              label: t('platformAnalytics.details.tabs.models'),
            },
            {
              icon: <WorkflowIcon size={16} />,
              key: 'agents',
              label: t('platformAnalytics.details.tabs.agents'),
            },
          ]}
          onChange={(key) => details.setView(key as 'agents' | 'models' | 'users')}
        />
      </Flexbox>
      {details.view === 'agents' ? (
        <AgentUsageTable
          enabled={enabled}
          range={range}
          state={details.agents}
          onPageChange={details.setAgentPage}
          onQueryChange={details.setAgentQuery}
          onSortChange={details.setAgentSort}
        />
      ) : details.view === 'users' ? (
        <ChatUsersTable
          enabled={enabled}
          range={range}
          state={details.users}
          onPageChange={details.setUserPage}
          onQueryChange={details.setUserQuery}
          onSortChange={details.setUserSort}
        />
      ) : (
        <ChatModelsTable
          enabled={enabled}
          range={range}
          state={details.models}
          onPageChange={details.setModelPage}
          onQueryChange={details.setModelQuery}
          onSortChange={details.setModelSort}
        />
      )}
    </Block>
  );
});

UsageDetails.displayName = 'UsageDetails';
