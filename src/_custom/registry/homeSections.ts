import { SidebarTabKey } from '@/store/global/initialState';

import { isNavHidden } from './navigation';

export const shouldShowHomeRecentPages = () => !isNavHidden(SidebarTabKey.Pages);

export const shouldShowHomeRecentResources = () => !isNavHidden(SidebarTabKey.Resource);

export const shouldShowHomeCommunityAgents = (showMarket?: boolean) => {
  if (showMarket === false) return false;
  if (isNavHidden(SidebarTabKey.Community)) return false;
  return true;
};
