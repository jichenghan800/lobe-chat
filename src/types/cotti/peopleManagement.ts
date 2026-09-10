import type { CottiLoginAccessMode, CottiLoginAccessRuleType } from '@/database/schemas';

export type CottiPeopleConfigurationSource = 'database' | 'environment';

export interface CottiLoginAccessUser {
  email: null | string;
  fullName: null | string;
  id: string;
  normalizedEmail: null | string;
  username: null | string;
}

export interface CottiLoginAccessRule {
  createdAt: Date | string | null;
  enabled: boolean;
  id: string;
  note: null | string;
  source: CottiPeopleConfigurationSource;
  type: CottiLoginAccessRuleType;
  updatedAt: Date | string | null;
  user: CottiLoginAccessUser | null;
  value: string;
}

export interface CottiDisabledLoginUser extends CottiLoginAccessUser {
  banReason: null | string;
  updatedAt: Date | string;
}

export interface CottiPlatformAdministrator {
  createdAt: Date | string | null;
  editable: boolean;
  id: string;
  note: null | string;
  source: 'database' | 'environment';
  user: CottiLoginAccessUser | null;
  userId: null | string;
  value: string;
}

export interface CottiPeopleManagementDetail {
  administrators: CottiPlatformAdministrator[];
  disabledLoginUsers: CottiDisabledLoginUser[];
  loginAccess: {
    mode: CottiLoginAccessMode;
    rules: CottiLoginAccessRule[];
    source: CottiPeopleConfigurationSource;
  };
}
