import { SettingsTabs } from '@/store/global/initialState';

const managedTabs = new Set<string>([
  SettingsTabs.Provider,
  SettingsTabs.ServiceModel,
  SettingsTabs.Messenger,
  SettingsTabs.APIKey,
  // Native legacy URLs redirect to service-model.
  SettingsTabs.Agent,
  SettingsTabs.TTS,
  SettingsTabs.Image,
]);

export const isCottiManagedSettingsTab = (tab?: string) => !!tab && managedTabs.has(tab);

export const canShowCottiManagedSettings = (enabled: boolean, isAdmin?: boolean) =>
  !enabled || isAdmin === true;
