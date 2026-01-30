import { SidebarTabKey } from '@/store/global/initialState';

interface KeyedItem {
  key: string;
}

const isTruthy = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const buildHiddenKeys = () => {
  const hidden = new Set<string>();

  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_HOME)) hidden.add(SidebarTabKey.Home);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_CHAT)) hidden.add(SidebarTabKey.Chat);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_SEARCH)) hidden.add('search');
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_PAGE)) hidden.add(SidebarTabKey.Pages);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_IMAGE)) hidden.add(SidebarTabKey.Image);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_COMMUNITY)) hidden.add(SidebarTabKey.Community);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_SETTINGS)) hidden.add(SidebarTabKey.Setting);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_RESOURCE)) hidden.add(SidebarTabKey.Resource);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_MEMORY)) hidden.add(SidebarTabKey.Memory);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_ME)) hidden.add(SidebarTabKey.Me);
  if (isTruthy(process.env.NEXT_PUBLIC_NAV_HIDE_KNOWLEDGE)) hidden.add(SidebarTabKey.Knowledge);

  return hidden;
};

const HIDDEN_KEYS = buildHiddenKeys();

const filterByHiddenKeys = <T extends KeyedItem>(items: T[]) => {
  if (HIDDEN_KEYS.size === 0) return items;

  return items.filter((item) => !HIDDEN_KEYS.has(item.key));
};

export const filterDesktopHeaderNavItems = <T extends KeyedItem>(items: T[]) =>
  filterByHiddenKeys(items);

export const filterDesktopBottomNavItems = <T extends KeyedItem>(items: T[]) =>
  filterByHiddenKeys(items);

export const filterMobileNavItems = <T extends KeyedItem>(items: T[]) => filterByHiddenKeys(items);
