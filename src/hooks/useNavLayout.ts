import { GalleryVerticalEndIcon, HomeIcon, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isCottiPlatformManagementEnabled } from '@/_custom/registry/platformManagement';
import { useActiveWorkspaceSlug } from '@/business/client/hooks/useActiveWorkspaceSlug';
import { getRouteById } from '@/config/routes';
import { useCottiPlatformAdminAccess } from '@/features/CottiPlatformAnalytics/hooks';
import { useGlobalStore } from '@/store/global';
import { SidebarTabKey } from '@/store/global/initialState';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

export interface NavItem {
  hidden?: boolean;
  icon: any;
  isNew?: boolean;
  key: string;
  onClick?: () => void;
  title: string;
  url?: string;
}

export interface NavLayout {
  bottomMenuItems: NavItem[];
  footer: {
    hideGitHub: boolean;
    layout: 'expanded' | 'compact';
    showEvalEntry: boolean;
    showSettingsEntry: boolean;
  };
  topNavItems: NavItem[];
  userPanel: {
    showDataImporter: boolean;
    showMemory: boolean;
  };
}

export const useNavLayout = (): NavLayout => {
  const { t } = useTranslation(['common', 'topic']);
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const { showMarket, hideGitHub } = useServerConfigStore(featureFlagsSelectors);
  const activeWorkspaceSlug = useActiveWorkspaceSlug();

  const topNavItems = useMemo(
    () =>
      [
        {
          icon: SearchIcon,
          key: 'search',
          onClick: () => toggleCommandMenu(true),
          title: t('tab.search'),
        },
        {
          icon: HomeIcon,
          key: SidebarTabKey.Home,
          title: t('tab.home'),
          url: '/',
        },
        {
          icon: getRouteById('tasks')!.icon,
          key: SidebarTabKey.Tasks,
          title: t('tab.tasks'),
          url: '/tasks',
        },
        {
          icon: getRouteById('resource')!.icon,
          key: SidebarTabKey.Resource,
          title: t('tab.resource'),
          url: '/resource',
        },
      ] as NavItem[],
    [t, toggleCommandMenu],
  );

  const enabled = isCottiPlatformManagementEnabled();
  const { swr: accessSWR } = useCottiPlatformAdminAccess();

  const bottomMenuItems = useMemo(
    () =>
      [
        {
          hidden: !enabled || accessSWR.data?.isAdmin !== true,
          icon: GalleryVerticalEndIcon,
          key: 'overview',
          title: t('overview.title', { ns: 'topic' }),
          url: '/overview',
        },
        {
          icon: getRouteById('image')!.icon,
          key: SidebarTabKey.Image,
          title: t('tab.generation'),
          url: '/image',
        },
        {
          hidden: !showMarket,
          icon: getRouteById('community')!.icon,
          key: SidebarTabKey.Community,
          title: t('tab.community'),
          url: '/community',
        },
        {
          icon: getRouteById('page')!.icon,
          key: SidebarTabKey.Pages,
          title: t('tab.pages'),
          url: '/page',
        },
        {
          hidden: !!activeWorkspaceSlug,
          icon: getRouteById('memory')!.icon,
          key: SidebarTabKey.Memory,
          title: t('tab.memory'),
          url: '/memory',
        },
      ] as NavItem[],
    [t, showMarket, activeWorkspaceSlug, enabled, accessSWR.data?.isAdmin],
  );

  const footer = useMemo(
    () => ({
      hideGitHub: !!hideGitHub,
      layout: 'compact' as const,
      showEvalEntry: false,
      showSettingsEntry: true,
    }),
    [hideGitHub],
  );

  const userPanel = useMemo(
    () => ({
      showDataImporter: false,
      // Memory now appears in the sidebar by default; drop the duplicate entry
      // from the user dropdown to keep that menu focused on account / settings.
      showMemory: false,
    }),
    [],
  );

  return { bottomMenuItems, footer, topNavItems, userPanel };
};
