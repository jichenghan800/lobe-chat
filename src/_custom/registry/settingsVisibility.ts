import { SettingsTabs } from '@/store/global/initialState';

interface SettingsItemLike {
  key: SettingsTabs;
}

interface SettingsGroupLike<T extends SettingsItemLike> {
  items: T[];
}

const isTruthy = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const buildHiddenSettingsTabs = () => {
  const hidden = new Set<SettingsTabs>();

  if (isTruthy(process.env.NEXT_PUBLIC_SETTINGS_HIDE_PROVIDER)) {
    hidden.add(SettingsTabs.Provider);
  }

  if (isTruthy(process.env.NEXT_PUBLIC_SETTINGS_HIDE_SERVICE_MODEL)) {
    hidden.add(SettingsTabs.ServiceModel);
  }

  return hidden;
};

const HIDDEN_SETTINGS_TABS = buildHiddenSettingsTabs();

export const isSettingsTabHidden = (tab?: string) => {
  if (!tab) return false;
  return HIDDEN_SETTINGS_TABS.has(tab as SettingsTabs);
};

export const filterSettingsCategoryItems = <T extends SettingsItemLike>(items: T[]) => {
  if (HIDDEN_SETTINGS_TABS.size === 0) return items;
  return items.filter((item) => !HIDDEN_SETTINGS_TABS.has(item.key));
};

export const filterSettingsCategoryGroups = <
  T extends SettingsItemLike,
  G extends SettingsGroupLike<T>,
>(
  groups: G[],
) => {
  if (HIDDEN_SETTINGS_TABS.size === 0) return groups;

  return groups
    .map((group) => ({ ...group, items: filterSettingsCategoryItems(group.items) }))
    .filter((group) => group.items.length > 0);
};
