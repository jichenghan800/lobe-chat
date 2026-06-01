'use client';

import { memo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { isSettingsTabHidden } from '@/_custom/registry/platformManagement';
import { SettingsTabs } from '@/store/global/initialState';

import { type LayoutProps } from './_layout/type';
import SettingsContent from './features/SettingsContent';

const Layout = memo<LayoutProps>(() => {
  const params = useParams<{ tab?: string }>();

  const activeTab = (params.tab as SettingsTabs) || SettingsTabs.Profile;

  if (isSettingsTabHidden(activeTab)) return <Navigate replace to="/settings/profile" />;

  return <SettingsContent activeTab={activeTab} mobile={false} />;
});

Layout.displayName = 'DesktopSettingsLayout';

export default Layout;
