import type { UIChatMessage } from '@lobechat/types';

export type CottiTopicOverviewMode = 'agent' | 'chat' | 'task';

export interface CottiTopicOverviewQuery {
  page?: number;
  pageSize?: 20 | 50;
  q?: string;
}

export interface CottiTopicOverviewItem {
  agentId?: null | string;
  createdAt: string;
  groupId?: null | string;
  id: string;
  imageCount: number;
  messageCount: number;
  mode: CottiTopicOverviewMode;
  sessionId?: null | string;
  targetTitle?: null | string;
  title?: null | string;
  updatedAt: string;
  userEmail?: null | string;
  userId: string;
  userName?: null | string;
  workspaceId?: null | string;
}

export interface CottiTopicOverviewList {
  items: CottiTopicOverviewItem[];
  page: number;
  pageSize: 20 | 50;
  query: Pick<CottiTopicOverviewQuery, 'q'>;
  total: number;
}

export interface CottiTopicOverviewDetail extends CottiTopicOverviewItem {
  messages: UIChatMessage[];
  messagesTruncated: boolean;
}
