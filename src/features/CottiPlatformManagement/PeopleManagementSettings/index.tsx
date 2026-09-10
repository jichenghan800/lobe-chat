'use client';

import { Flexbox } from '@lobehub/ui';
import { Tabs } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import LoginAccessSettings from './LoginAccessSettings';
import PlatformAdminSettings from './PlatformAdminSettings';
import { UserManagementSettings } from './UserManagementSettings';

const styles = createStaticStyles(({ css }) => ({
  tab: css`
    &&[aria-selected='true'] {
      font-weight: 600;
      color: ${cssVar.colorBgContainer};
      background: ${cssVar.colorText};
    }
  `,
}));

export default function PeopleManagementSettings() {
  const { t } = useTranslation('setting');
  const [section, setSection] = useState('users');
  return (
    <Flexbox gap={16}>
      <Tabs
        activeKey={section}
        classNames={{ tab: styles.tab }}
        items={[
          { key: 'users', label: t('platformManagement.users.title') },
          { key: 'administrators', label: t('platformManagement.people.sections.administrators') },
          { key: 'login', label: t('platformManagement.people.sections.login') },
        ]}
        onChange={setSection}
      />
      <div hidden={section !== 'users'}>
        <UserManagementSettings />
      </div>
      <div hidden={section !== 'administrators'}>
        <PlatformAdminSettings />
      </div>
      <div hidden={section !== 'login'}>
        <LoginAccessSettings />
      </div>
    </Flexbox>
  );
}
