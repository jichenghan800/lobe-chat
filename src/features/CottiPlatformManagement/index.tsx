'use client';

import { Empty, Flexbox, Skeleton, Text } from '@lobehub/ui';
import { Tabs } from '@lobehub/ui/base-ui';
import { BarChart3Icon, BellRingIcon, BotIcon, Settings2Icon, ShieldCheckIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { isCottiPlatformManagementEnabled } from '@/_custom/registry/platformManagement';
import AsyncError from '@/components/AsyncError';
import CottiPlatformAnalytics from '@/features/CottiPlatformAnalytics';
import NavHeader from '@/features/NavHeader';
import SettingContainer from '@/features/Setting/SettingContainer';

import { useCottiPlatformAdminAccess } from '../CottiPlatformAnalytics/hooks';
import AgentAccessSettings from './AgentAccessSettings';
import HomeNotificationSettings from './HomeNotificationSettings';
import ModelDisplaySettings from './ModelDisplaySettings';
import {
  type CottiPlatformManagementSection,
  parseCottiPlatformManagementSection,
  writeCottiPlatformManagementSection,
} from './section';
import { styles } from './style';

const CottiPlatformManagement = memo(() => {
  const { t } = useTranslation('setting');
  const [searchParams, setSearchParams] = useSearchParams();
  const section = useMemo(() => parseCottiPlatformManagementSection(searchParams), [searchParams]);
  const enabled = isCottiPlatformManagementEnabled();
  const { swr: accessSWR } = useCottiPlatformAdminAccess();

  const setSection = (next: CottiPlatformManagementSection) => {
    setSearchParams(writeCottiPlatformManagementSection(searchParams, next));
  };

  const content = !enabled ? (
    <Empty
      description={t('platformManagement.disabled.desc')}
      icon={Settings2Icon}
      title={t('platformManagement.disabled.title')}
    />
  ) : accessSWR.error ? (
    <AsyncError error={accessSWR.error} variant={'page'} onRetry={() => void accessSWR.mutate()} />
  ) : !accessSWR.data ? (
    <Skeleton active paragraph={{ rows: 8 }} title={false} />
  ) : (
    <Flexbox gap={20}>
      <div className={styles.header}>
        <Flexbox className={styles.headerCopy} gap={4}>
          <Text fontSize={24} weight={600}>
            {t('platformManagement.heading')}
          </Text>
          <Text type={'secondary'}>{t('platformManagement.desc')}</Text>
        </Flexbox>
      </div>
      <div className={styles.nav}>
        <Tabs
          activeKey={section}
          items={[
            {
              icon: <BarChart3Icon size={16} />,
              key: 'overview',
              label: t('platformManagement.sections.overview'),
            },
            {
              icon: <BotIcon size={16} />,
              key: 'models',
              label: t('platformManagement.sections.models'),
            },
            {
              icon: <ShieldCheckIcon size={16} />,
              key: 'agent-access',
              label: t('platformManagement.sections.agentAccess'),
            },
            {
              icon: <BellRingIcon size={16} />,
              key: 'home-notification',
              label: t('platformManagement.sections.homeNotification'),
            },
          ]}
          onChange={(key) => setSection(key as CottiPlatformManagementSection)}
        />
      </div>
      <div className={styles.section}>
        {section === 'overview' ? (
          <CottiPlatformAnalytics embedded />
        ) : section === 'models' ? (
          <ModelDisplaySettings />
        ) : section === 'agent-access' ? (
          <AgentAccessSettings />
        ) : (
          <HomeNotificationSettings />
        )}
      </div>
    </Flexbox>
  );

  return (
    <Flexbox height={'100%'} width={'100%'}>
      <NavHeader>
        <Text weight={500}>{t('platformManagement.title')}</Text>
      </NavHeader>
      <SettingContainer
        className={styles.content}
        maxWidth={1280}
        paddingBlock={'24px 128px'}
        paddingInline={24}
        variant={'secondary'}
      >
        {content}
      </SettingContainer>
    </Flexbox>
  );
});

CottiPlatformManagement.displayName = 'CottiPlatformManagement';

export default CottiPlatformManagement;
