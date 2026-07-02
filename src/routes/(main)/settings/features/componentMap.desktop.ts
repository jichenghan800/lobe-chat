import Billing from '@/business/client/BusinessSettingPages/Billing';
import Credits from '@/business/client/BusinessSettingPages/Credits';
import Notification from '@/business/client/BusinessSettingPages/Notification';
import Plans from '@/business/client/BusinessSettingPages/Plans';
import Referral from '@/business/client/BusinessSettingPages/Referral';
import Usage from '@/business/client/BusinessSettingPages/Usage';
import { SettingsTabs } from '@/store/global/initialState';

import About from '../about';
import Advanced from '../advanced';
import AgentAccess from '../agent-access';
import APIKey from '../apikey';
import Appearance from '../appearance';
import Creds from '../creds';
import Devices from '../devices';
import FeedbackAnalytics from '../feedback-analytics';
import HomeNotification from '../home-notification';
import Hotkey from '../hotkey';
import Memory from '../memory';
import Messenger from '../messenger';
import ModelDisplay from '../model-display';
import PlatformAnalytics from '../platform-analytics';
import PlatformAudit from '../platform-audit';
import Profile from '../profile';
import Provider from '../provider';
import Proxy from '../proxy';
import Security from '../security';
import ServiceModel from '../service-model';
import Skill from '../skill';
import Stats from '../stats';
import Storage from '../storage';
import SystemTools from '../system-tools';

export const componentMap = {
  [SettingsTabs.Advanced]: Advanced,
  [SettingsTabs.AgentAccess]: AgentAccess,
  [SettingsTabs.Appearance]: Appearance,
  [SettingsTabs.Provider]: Provider,
  [SettingsTabs.ServiceModel]: ServiceModel,
  [SettingsTabs.Memory]: Memory,
  [SettingsTabs.Messenger]: Messenger,
  [SettingsTabs.Notification]: Notification,
  [SettingsTabs.About]: About,
  [SettingsTabs.Hotkey]: Hotkey,
  [SettingsTabs.HomeNotification]: HomeNotification,
  [SettingsTabs.ModelDisplay]: ModelDisplay,
  [SettingsTabs.Proxy]: Proxy,
  [SettingsTabs.SystemTools]: SystemTools,
  [SettingsTabs.Storage]: Storage,
  [SettingsTabs.Devices]: Devices,
  // Profile related tabs
  [SettingsTabs.Profile]: Profile,
  [SettingsTabs.Stats]: Stats,
  [SettingsTabs.Usage]: Usage,
  [SettingsTabs.APIKey]: APIKey,
  [SettingsTabs.Creds]: Creds,
  [SettingsTabs.FeedbackAnalytics]: FeedbackAnalytics,
  [SettingsTabs.Security]: Security,
  [SettingsTabs.Skill]: Skill,

  [SettingsTabs.Plans]: Plans,
  [SettingsTabs.PlatformAnalytics]: PlatformAnalytics,
  [SettingsTabs.PlatformAudit]: PlatformAudit,
  [SettingsTabs.Credits]: Credits,
  [SettingsTabs.Billing]: Billing,
  [SettingsTabs.Referral]: Referral,
};
