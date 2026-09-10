'use client';

import { Empty, Flexbox } from '@lobehub/ui';
import { Skeleton, Tabs, Text } from '@lobehub/ui/base-ui';
import {
  BarChart3Icon,
  BellRingIcon,
  BotIcon,
  ScanSearchIcon,
  Settings2Icon,
  UsersIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { isCottiPlatformManagementEnabled } from '@/_custom/registry/platformManagement';
import AsyncError from '@/components/AsyncError';
import CottiPlatformAnalytics from '@/features/CottiPlatformAnalytics';
import CottiPlatformAudit from '@/features/CottiPlatformAudit';
import NavHeader from '@/features/NavHeader';
import SettingContainer from '@/features/Setting/SettingContainer';
import SideBar from '@/features/Settings/Layout/SideBar';

import { useCottiPlatformAdminAccess } from '../CottiPlatformAnalytics/hooks';
import HomeNotificationSettings from './HomeNotificationSettings';
import ModelDisplaySettings from './ModelDisplaySettings';
import PeopleManagementSettings from './PeopleManagementSettings';
import {
  type CottiPlatformManagementSection,
  parseCottiPlatformManagementSection,
  writeCottiPlatformManagementSection,
} from './section';
import { styles } from './style';
import { TopicBudgetSettings } from './TopicBudgetSettings';

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
    <Skeleton height={240} />
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
              icon: <ScanSearchIcon size={16} />,
              key: 'audit',
              label: t('platformManagement.sections.audit'),
            },
            {
              icon: <BotIcon size={16} />,
              key: 'models',
              label: t('platformManagement.sections.models'),
            },
            {
              icon: <UsersIcon size={16} />,
              key: 'agent-access',
              label: t('platformManagement.sections.agentAccess'),
            },
            {
              icon: <BellRingIcon size={16} />,
              key: 'home-notification',
              label: t('platformManagement.sections.homeNotification'),
            },
          ]}
          onChange={(key) => {
            setSection(key as CottiPlatformManagementSection);
          }}
        />
      </div>
      <div className={styles.section}>
        {section === 'overview' ? (
          <CottiPlatformAnalytics embedded />
        ) : section === 'models' ? (
          <Flexbox gap={24}>
            <TopicBudgetSettings />
            <ModelDisplaySettings />
          </Flexbox>
        ) : section === 'audit' ? (
          <CottiPlatformAudit />
        ) : section === 'agent-access' ? (
          <PeopleManagementSettings />
        ) : (
          <HomeNotificationSettings />
        )}
      </div>
    </Flexbox>
  );

  return (
    <>
      <SideBar />
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
    </>
  );
});

CottiPlatformManagement.displayName = 'CottiPlatformManagement';

export default CottiPlatformManagement;
