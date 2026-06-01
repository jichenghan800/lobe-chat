export type PlatformAnalyticsRange = 7 | 30 | 90;

export interface PlatformAnalyticsOverview {
  activeUsers: number;
  assistantMessages: number;
  averageCostPerAssistantMessage: number;
  errorRate: number;
  estimatedCost: number;
  newUsers: number;
  searchMessages: number;
  toolMessages: number;
  topics: number;
  totalTokens: number;
  totalUsers: number;
  userMessages: number;
}

export interface PlatformAnalyticsTrendItem {
  activeUsers: number;
  assistantMessages: number;
  day: string;
  estimatedCost: number;
  totalMessages: number;
  totalTokens: number;
  userMessages: number;
}

export interface PlatformAnalyticsUserItem {
  activeDays: number;
  assistantMessages: number;
  estimatedCost: number;
  lastActiveAt?: string;
  totalMessages: number;
  totalTokens: number;
  userEmail?: string;
  userId: string;
  userMessages: number;
  userName?: string;
}

export interface PlatformAnalyticsModelItem {
  activeUsers: number;
  assistantMessages: number;
  errorMessages: number;
  estimatedCost: number;
  model: string;
  provider: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

export interface PlatformAnalyticsFeatureItem {
  activeUsers: number;
  count: number;
  key: string;
  label: string;
}

export interface PlatformAnalyticsErrorItem {
  count: number;
  model: string;
  provider: string;
}

export interface PlatformAnalyticsDashboard {
  errors: PlatformAnalyticsErrorItem[];
  features: PlatformAnalyticsFeatureItem[];
  generatedAt: string;
  models: PlatformAnalyticsModelItem[];
  overview: PlatformAnalyticsOverview;
  range: PlatformAnalyticsRange;
  topUsers: PlatformAnalyticsUserItem[];
  trends: PlatformAnalyticsTrendItem[];
}
