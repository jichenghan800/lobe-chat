import { describe, expect, it } from 'vitest';

import { SettingsTabs } from '@/store/global/initialState';

import { canShowCottiManagedSettings, isCottiManagedSettingsTab } from './managedSettings';

describe('COTTI managed settings UI policy', () => {
  it.each([
    SettingsTabs.Provider,
    SettingsTabs.ServiceModel,
    SettingsTabs.Messenger,
    SettingsTabs.APIKey,
    SettingsTabs.Agent,
    SettingsTabs.Image,
    SettingsTabs.TTS,
  ])('gates managed tab or legacy alias %s', (tab) => {
    expect(isCottiManagedSettingsTab(tab)).toBe(true);
  });
  it.each([
    SettingsTabs.Creds,
    SettingsTabs.Connector,
    SettingsTabs.Appearance,
    SettingsTabs.Skill,
    undefined,
  ])('keeps ordinary setting %s', (tab) => {
    expect(isCottiManagedSettingsTab(tab)).toBe(false);
  });
  it('keeps unconfigured upstream deployments unchanged', () => {
    expect(canShowCottiManagedSettings(false)).toBe(true);
  });
  it('hides managed UI until administrator status is positively resolved', () => {
    expect(canShowCottiManagedSettings(true)).toBe(false);
    expect(canShowCottiManagedSettings(true, false)).toBe(false);
    expect(canShowCottiManagedSettings(true, true)).toBe(true);
  });
});
