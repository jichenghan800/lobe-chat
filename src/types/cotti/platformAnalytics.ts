export type CottiPlatformAnalyticsPresetDays = 1 | 7 | 30 | 90;

export type CottiPlatformAnalyticsGenerationType = 'image' | 'video';

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

export type CottiPlatformAnalyticsAgentSort =
  | 'activeUsers'
  | 'averageProcessingTimeMs'
  | 'errorExecutions'
  | 'executions'
  | 'lastExecutedAt'
  | 'recordedCost'
  | 'totalTokens';

export type CottiPlatformAnalyticsChatModelSort =
  'activeUsers' | 'assistantMessages' | 'errorMessages' | 'recordedCost' | 'totalTokens';

export type CottiPlatformAnalyticsChatErrorSort = 'affectedUsers' | 'errorMessages';

export type CottiPlatformAnalyticsAgentErrorSort = 'affectedUsers' | 'errorExecutions';

export interface CottiPlatformAnalyticsDetailQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  range?: CottiPlatformAnalyticsQuery;
}

export interface CottiPlatformAnalyticsChatModelsQuery extends CottiPlatformAnalyticsDetailQuery {
  sortBy?: CottiPlatformAnalyticsChatModelSort;
}

export interface CottiPlatformAnalyticsAgentsQuery extends CottiPlatformAnalyticsDetailQuery {
  sortBy?: CottiPlatformAnalyticsAgentSort;
}

export interface CottiPlatformAnalyticsChatUsersQuery extends CottiPlatformAnalyticsDetailQuery {
  sortBy?: CottiPlatformAnalyticsChatUserSort;
}

export interface CottiPlatformAnalyticsChatErrorsQuery extends CottiPlatformAnalyticsDetailQuery {
  sortBy?: CottiPlatformAnalyticsChatErrorSort;
}

export interface CottiPlatformAnalyticsAgentErrorsQuery extends CottiPlatformAnalyticsDetailQuery {
  sortBy?: CottiPlatformAnalyticsAgentErrorSort;
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
  realActiveUsers: number;
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
  realActiveUsers: number;
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

export interface CottiPlatformAnalyticsSearchFeature {
  activeUsers: number;
  builtinSearchMessages: number;
  totalSearchEvents: number;
  webSearchToolResults: number;
}

export interface CottiPlatformAnalyticsToolFeature {
  activeUsers: number;
  errorResults: number;
  rejectedOrAbortedResults: number;
  results: number;
}

export interface CottiPlatformAnalyticsFileFeature {
  activeUsers: number;
  distinctFiles: number;
  fileRelations: number;
  messagesWithFiles: number;
}

export interface CottiPlatformAnalyticsGenerationFeature {
  activeUsers: number;
  errorResults: number;
  requests: number;
  requestsWithoutResults: number;
  resultRows: number;
  successfulAssets: number;
  type: CottiPlatformAnalyticsGenerationType;
}

export interface CottiPlatformAnalyticsFeatures {
  files: CottiPlatformAnalyticsFileFeature;
  generatedAt: string;
  generations: CottiPlatformAnalyticsGenerationFeature[];
  period: CottiPlatformAnalyticsPeriod;
  search: CottiPlatformAnalyticsSearchFeature;
  tools: CottiPlatformAnalyticsToolFeature;
}

export interface CottiPlatformAnalyticsChatErrorItem {
  affectedUsers: number;
  category: string | null;
  errorMessages: number;
  model: string | null;
  provider: string | null;
}

export interface CottiPlatformAnalyticsChatErrors {
  generatedAt: string;
  items: CottiPlatformAnalyticsChatErrorItem[];
  page: number;
  pageSize: number;
  period: CottiPlatformAnalyticsPeriod;
  total: number;
}

export interface CottiPlatformAnalyticsAgentErrorItem {
  affectedUsers: number;
  agentId: string | null;
  avatar: string | null;
  category: string | null;
  errorExecutions: number;
  title: string | null;
}

export interface CottiPlatformAnalyticsAgentErrors {
  generatedAt: string;
  items: CottiPlatformAnalyticsAgentErrorItem[];
  page: number;
  pageSize: number;
  period: CottiPlatformAnalyticsPeriod;
  total: number;
}

export interface CottiPlatformAnalyticsAgentItem {
  activeUsers: number;
  agentId: string | null;
  avatar: string | null;
  averageProcessingTimeMs: number;
  costRecordedExecutions: number;
  errorExecutions: number;
  errorRate: number;
  executions: number;
  interruptedExecutions: number;
  interruptionRate: number;
  lastExecutedAt: string | null;
  llmCalls: number;
  recordedCost: number;
  title: string | null;
  tokenRecordedExecutions: number;
  toolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

export interface CottiPlatformAnalyticsAgents {
  generatedAt: string;
  items: CottiPlatformAnalyticsAgentItem[];
  page: number;
  pageSize: number;
  period: CottiPlatformAnalyticsPeriod;
  total: number;
}

export interface CottiPlatformAnalyticsChatModelItem {
  activeUsers: number;
  assistantMessages: number;
  errorMessages: number;
  errorRate: number;
  model: string | null;
  provider: string | null;
  recordedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

export interface CottiPlatformAnalyticsChatModels {
  generatedAt: string;
  items: CottiPlatformAnalyticsChatModelItem[];
  page: number;
  pageSize: number;
  period: CottiPlatformAnalyticsPeriod;
  total: number;
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
