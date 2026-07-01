import { SettingsTabs } from '@/store/global/initialState';

const falseValues = new Set(['0', 'false', 'no', 'off']);

const readHideFlag = (raw: string | undefined, defaultValue = true) => {
  if (!raw) return defaultValue;

  return !falseValues.has(raw.trim().toLowerCase());
};

const readShowFlag = (raw: string | undefined, defaultValue = false) => {
  if (!raw) return defaultValue;

  return !falseValues.has(raw.trim().toLowerCase());
};

export const isAgentChannelUiHidden = () =>
  readHideFlag(process.env.NEXT_PUBLIC_COTTI_HIDE_AGENT_CHANNELS);

export const isModelProviderSettingsHidden = () =>
  readHideFlag(process.env.NEXT_PUBLIC_COTTI_HIDE_MODEL_PROVIDER_SETTINGS);

export const isServiceModelSettingsHidden = () =>
  readHideFlag(process.env.NEXT_PUBLIC_COTTI_HIDE_SERVICE_MODEL_SETTINGS);

export const isMessengerSettingsHidden = () =>
  readHideFlag(process.env.NEXT_PUBLIC_COTTI_HIDE_MESSENGER_SETTINGS);

export const isApiKeySettingsHidden = () =>
  readHideFlag(process.env.NEXT_PUBLIC_COTTI_HIDE_API_KEY_SETTINGS);

export const isPlatformAnalyticsHidden = () =>
  !readShowFlag(process.env.NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS);

export const isSettingsTabHidden = (tab: SettingsTabs) => {
  switch (tab) {
    case SettingsTabs.AgentAccess: {
      return isPlatformAnalyticsHidden();
    }
    case SettingsTabs.PlatformAudit: {
      return isPlatformAnalyticsHidden();
    }
    case SettingsTabs.Provider: {
      return isModelProviderSettingsHidden();
    }
    case SettingsTabs.ServiceModel: {
      return isServiceModelSettingsHidden();
    }
    case SettingsTabs.Messenger: {
      return isMessengerSettingsHidden();
    }
    case SettingsTabs.APIKey: {
      return isApiKeySettingsHidden();
    }
    case SettingsTabs.PlatformAnalytics: {
      return isPlatformAnalyticsHidden();
    }
    case SettingsTabs.FeedbackAnalytics: {
      return isPlatformAnalyticsHidden();
    }
    case SettingsTabs.HomeNotification: {
      return isPlatformAnalyticsHidden();
    }
    default: {
      return false;
    }
  }
};

export const arePlatformManagementBannersHidden = () =>
  isAgentChannelUiHidden() && isMessengerSettingsHidden();
