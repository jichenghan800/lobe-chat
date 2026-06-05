export type PlatformAnalyticsRange = 1 | 7 | 30 | 90;

export interface PlatformAnalyticsDateRange {
  end: string;
  start: string;
}

export interface PlatformAnalyticsQuery {
  customRange?: PlatformAnalyticsDateRange;
  range?: PlatformAnalyticsRange;
}

export type PlatformFeedbackStatus = 'ignored' | 'open' | 'resolved' | 'reviewing';

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
  averageLatencyMs: number;
  errorMessages: number;
  estimatedCost: number;
  lastActiveAt?: string;
  model?: string;
  provider?: string;
  requestCount: number;
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
  averageLatencyMs: number;
  errorMessages: number;
  errorRate: number;
  estimatedCost: number;
  llmCalls: number;
  model: string;
  p95LatencyMs: number;
  provider: string;
  requestCount: number;
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
  customRange?: PlatformAnalyticsDateRange;
  errors: PlatformAnalyticsErrorItem[];
  features: PlatformAnalyticsFeatureItem[];
  generatedAt: string;
  models: PlatformAnalyticsModelItem[];
  overview: PlatformAnalyticsOverview;
  range: PlatformAnalyticsRange;
  topUsers: PlatformAnalyticsUserItem[];
  trends: PlatformAnalyticsTrendItem[];
}

export interface PlatformFeedbackOverview {
  ignored: number;
  open: number;
  resolved: number;
  reviewing: number;
  total: number;
}

export interface PlatformFeedbackReportItem {
  createdAt: string;
  email?: string;
  id: string;
  issueUrl?: string;
  message: string;
  pageUrl?: string;
  screenshotUrl?: string;
  status: PlatformFeedbackStatus;
  title: string;
  updatedAt: string;
  userId?: string;
}

export interface PlatformFeedbackAnalytics {
  generatedAt: string;
  items: PlatformFeedbackReportItem[];
  overview: PlatformFeedbackOverview;
  range: PlatformAnalyticsRange;
}
