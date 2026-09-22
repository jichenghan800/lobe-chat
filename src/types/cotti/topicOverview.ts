import type { MetaData, UIChatMessage } from '@lobechat/types';

export type CottiTopicOverviewMode = 'agent' | 'chat' | 'task' | 'unknown';

export interface CottiTopicOverviewQuery {
  page?: number;
  pageSize?: 20 | 50;
  q?: string;
  sort?: 'cost' | 'updated';
  status?: 'active' | 'frozen' | 'all';
}

export interface CottiTopicOverviewItem {
  agentId?: null | string;
  costComplete?: boolean;
  costUsd?: number | null;
  createdAt: string;
  frozen?: boolean;
  groupId?: null | string;
  id: string;
  imageCount: number;
  messageCount: number;
  mode: CottiTopicOverviewMode;
  modeInferred?: boolean;
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
  agentMetas?: Record<string, MetaData>;
  messages: UIChatMessage[];
  messagesTruncated: boolean;
}

export interface CottiTopicManagementInput {
  action: 'freeze' | 'unfreeze' | 'setLimit' | 'setLimitAndUnfreeze';
  limitFen?: number | null;
  topicId: string;
}

export interface CottiTopicActivity {
  model: string | null;
  provider: string | null;
  revision: string;
  sandbox: 'market' | 'onlyboxes' | 'unknown';
  status: 'error' | 'waiting' | 'tool' | 'reply' | 'unknown';
  tool: string | null;
  updatedAt: string | null;
}
