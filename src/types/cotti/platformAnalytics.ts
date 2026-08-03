export type CottiPlatformAnalyticsPresetDays = 1 | 7 | 30 | 90;

export type CottiPlatformAnalyticsQuery =
  | {
      days: CottiPlatformAnalyticsPresetDays;
      type: 'preset';
    }
  | {
      endDate: string;
      startDate: string;
      type: 'custom';
    };

export type CottiPlatformAnalyticsChatUserSort =
  'assistantMessages' | 'errorMessages' | 'lastActiveAt' | 'recordedCost' | 'totalTokens';

export interface CottiPlatformAnalyticsChatUsersQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  range?: CottiPlatformAnalyticsQuery;
  sortBy?: CottiPlatformAnalyticsChatUserSort;
}

export interface CottiPlatformAnalyticsPeriod {
  endAt: string;
  endDate: string;
  presetDays?: CottiPlatformAnalyticsPresetDays;
  startAt: string;
  startDate: string;
  timezone: 'Asia/Shanghai';
  type: CottiPlatformAnalyticsQuery['type'];
}

export interface CottiPlatformAnalyticsOverview {
  activeTopics: number;
  activeUsers: number;
  assistantMessages: number;
  averageCostPerAssistantMessage: number;
  errorMessages: number;
  errorRate: number;
  newUsers: number;
  recordedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalUsers: number;
  userMessages: number;
}

export interface CottiPlatformAnalyticsTrendItem {
  activeUsers: number;
  assistantMessages: number;
  day: string;
  errorMessages: number;
  errorRate: number;
  recordedCost: number;
  totalMessages: number;
  totalTokens: number;
  userMessages: number;
}

export interface CottiPlatformAnalyticsDashboard {
  generatedAt: string;
  overview: CottiPlatformAnalyticsOverview;
  period: CottiPlatformAnalyticsPeriod;
  trends: CottiPlatformAnalyticsTrendItem[];
}

export interface CottiPlatformAnalyticsChatUserItem {
  activeDays: number;
  activeTopics: number;
  assistantMessages: number;
  avatar: string | null;
  email: string | null;
  errorMessages: number;
  errorRate: number;
  fullName: string | null;
  lastActiveAt: string | null;
  recordedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  userId: string;
  userMessages: number;
  username: string | null;
}

export interface CottiPlatformAnalyticsChatUsers {
  generatedAt: string;
  items: CottiPlatformAnalyticsChatUserItem[];
  page: number;
  pageSize: number;
  period: CottiPlatformAnalyticsPeriod;
  total: number;
}
