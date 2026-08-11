'use client';

import { Flexbox } from '@lobehub/ui';
import { Tabs } from '@lobehub/ui/base-ui';
import { BotIcon, KeyRoundIcon, ShieldCheckIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AgentAccessSettings from '../AgentAccessSettings';
import LoginAccessSettings from './LoginAccessSettings';
import PlatformAdminSettings from './PlatformAdminSettings';

type PeopleSection = 'administrators' | 'agent' | 'login';

const PeopleManagementSettings = memo(() => {
  const { t } = useTranslation('setting');
  const [section, setSection] = useState<PeopleSection>('agent');

  return (
    <Flexbox gap={16}>
      <Tabs
        activeKey={section}
        items={[
          {
            icon: <BotIcon size={16} />,
            key: 'agent',
            label: t('platformManagement.people.sections.agent'),
          },
          {
            icon: <ShieldCheckIcon size={16} />,
            key: 'administrators',
            label: t('platformManagement.people.sections.administrators'),
          },
          {
            icon: <KeyRoundIcon size={16} />,
            key: 'login',
            label: t('platformManagement.people.sections.login'),
          },
        ]}
        onChange={(key) => setSection(key as PeopleSection)}
      />
      {section === 'login' ? (
        <LoginAccessSettings />
      ) : section === 'administrators' ? (
        <PlatformAdminSettings />
      ) : (
        <AgentAccessSettings />
      )}
    </Flexbox>
  );
});

PeopleManagementSettings.displayName = 'PeopleManagementSettings';

export default PeopleManagementSettings;
