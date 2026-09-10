'use client';

import { Flexbox } from '@lobehub/ui';
import { Tabs } from '@lobehub/ui/base-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import LoginAccessSettings from './LoginAccessSettings';
import PlatformAdminSettings from './PlatformAdminSettings';

export default function PeopleManagementSettings() {
  const { t } = useTranslation('setting');
  const [section, setSection] = useState('administrators');
  return (
    <Flexbox gap={16}>
      <Tabs
        activeKey={section}
        items={[
          { key: 'administrators', label: t('platformManagement.people.sections.administrators') },
          { key: 'login', label: t('platformManagement.people.sections.login') },
        ]}
        onChange={setSection}
      />
      <div hidden={section !== 'administrators'}>
        <PlatformAdminSettings />
      </div>
      <div hidden={section !== 'login'}>
        <LoginAccessSettings />
      </div>
    </Flexbox>
  );
}
