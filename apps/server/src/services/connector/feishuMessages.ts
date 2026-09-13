import { safeParseJSON, truncateSurrogateSafe } from '@lobechat/utils';
import { isRecord } from '@lobechat/utils/object';
import dayjs from 'dayjs';
import timezonePlugin from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod';

import {
  FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES,
  FEISHU_DOCUMENTS_MESSAGE_TOOLS,
} from '@/const/connectorPresets';
import type { DecryptedConnector } from '@/database/models/connector';
import { ConnectorToolPermission, ToolCRUDType } from '@/database/schemas';
import type { MCPToolCallResult } from '@/libs/mcp';

const FEISHU_OPEN_API_ORIGIN = 'https://open.feishu.cn';
const FEISHU_OPEN_API_TIMEOUT_MS = 20_000;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SEARCH_PAGE_SIZE = 10;
const MAX_GROUP_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 20;
const MAX_SEARCH_PAGE_SIZE = 10;
const MAX_GROUP_LOOKUP_PAGES = 5;
const MAX_MEMBER_CHAT_LOOKUPS = 5;
const MAX_MEMBER_PAGES = 5;
const MAX_HISTORY_PAGES = 50;
const MAX_HISTORY_ITEMS_JSON_LENGTH = 18_000;
const MAX_MESSAGE_TEXT_LENGTH = 1000;
const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const groupPageSizeSchema = z.number().int().min(1).max(MAX_GROUP_PAGE_SIZE).optional();
const messagePageSizeSchema = z.number().int().min(1).max(MAX_MESSAGE_PAGE_SIZE).optional();
const timestampSchema = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'date must be a valid calendar date');

const listGroupChatsArgsSchema = z.object({
  page_size: groupPageSizeSchema,
  page_token: z.string().min(1).optional(),
  sort_type: z.enum(['ByCreateTimeAsc', 'ByActiveTimeDesc']).optional(),
});

const searchChatMessagesArgsSchema = z
  .object({
    at_chatter_ids: z.array(z.string().min(1)).max(50).optional(),
    chat_ids: z.array(z.string().min(1)).max(50).optional(),
    chat_type: z.enum(['group_chat', 'p2p_chat']).optional(),
    date: calendarDateSchema.optional(),
    end_time: timestampSchema.optional(),
    from_ids: z.array(z.string().min(1)).max(50).optional(),
    from_type: z.enum(['bot', 'user']).optional(),
    message_type: z.enum(['file', 'image', 'media']).optional(),
    page_size: z.number().int().min(1).max(MAX_SEARCH_PAGE_SIZE).optional(),
    page_token: z.string().min(1).optional(),
    query: z.string().max(1000).optional(),
    start_time: timestampSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.date && (value.start_time !== undefined || value.end_time !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'date cannot be combined with start_time or end_time',
      });
    }
    if (
      value.start_time !== undefined &&
      value.end_time !== undefined &&
      Number(value.start_time) > Number(value.end_time)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'start_time must not be later than end_time',
      });
    }
  });

const listChatMessagesArgsSchema = z
  .object({
    chat_id: z.string().min(1),
    container_type: z.enum(['chat', 'thread']).optional(),
    date: calendarDateSchema.optional(),
    end_time: timestampSchema.optional(),
    page_size: messagePageSizeSchema,
    page_token: z.string().min(1).optional(),
    sort_type: z.enum(['ByCreateTimeAsc', 'ByCreateTimeDesc']).optional(),
    start_time: timestampSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.date && (value.start_time !== undefined || value.end_time !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'date cannot be combined with start_time or end_time',
      });
    }
    if (
      value.container_type === 'thread' &&
      (value.date || value.start_time !== undefined || value.end_time !== undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'date, start_time and end_time are not supported when container_type is thread',
      });
    }
  });

const getChatMessageArgsSchema = z.object({ message_id: z.string().min(1) });

const queryChatHistoryArgsSchema = z
  .object({
    date: calendarDateSchema.optional(),
    page_size: messagePageSizeSchema,
    page_token: z.string().min(1).optional(),
    target_name: z.string().trim().max(100).optional(),
    target_type: z.enum(['all', 'group', 'person']).default('all'),
  })
  .transform((value) =>
    value.target_name ? value : { ...value, target_name: undefined, target_type: 'all' as const },
  );

type ListChatMessagesInput = z.infer<typeof listChatMessagesArgsSchema>;
type QueryChatHistoryInput = z.infer<typeof queryChatHistoryArgsSchema>;
type SearchChatMessagesInput = z.infer<typeof searchChatMessagesArgsSchema>;

export const FEISHU_MESSAGE_TOOL_DEFINITIONS = [
  {
    crudType: ToolCRUDType.read,
    // This high-level tool is only activated when the user selects/pins the
    // connector. Keep that explicit selection usable in classic Chat, whose
    // client runtime cannot complete a server-side approval intervention.
    defaultPermission: ConnectorToolPermission.auto,
    description:
      "Query one calendar day's Feishu chat history in one call. Always use this first for a daily report, all messages from a day, messages with a named person, or messages from a named group. Omit target_name and use target_type=all to include both private and group chats visible to the current user. If target_name is omitted or blank, the server safely normalizes the query to target_type=all even when another target_type was supplied. Named-person and named-group queries resolve exact identities internally. The server follows pagination until the day is complete or a safe result boundary is reached. Never claim the result is complete when complete=false. Dates and displayed times always use Asia/Shanghai.",
    displayName: '查询飞书聊天记录',
    inputSchema: {
      additionalProperties: false,
      properties: {
        date: {
          description: "Calendar date in Asia/Shanghai, formatted YYYY-MM-DD. Omit for 'today'.",
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          type: 'string',
        },
        page_size: {
          default: DEFAULT_SEARCH_PAGE_SIZE,
          description: `Number of messages to request per Feishu page, from 1 to ${MAX_MESSAGE_PAGE_SIZE}. The server follows subsequent pages automatically.`,
          maximum: MAX_MESSAGE_PAGE_SIZE,
          minimum: 1,
          type: 'integer',
        },
        page_token: {
          description:
            'Continuation token returned by a previous partial result. Omit for the first batch.',
          type: 'string',
        },
        target_name: {
          description:
            'Exact Feishu display name of the person or exact group name. Omit for a daily report across all visible chats. A missing or blank value is treated as target_type=all.',
          maxLength: 100,
          type: 'string',
        },
        target_type: {
          default: 'all',
          description:
            'Use all for every visible private and group message in the day, or identify target_name as a person or group.',
          enum: ['all', 'person', 'group'],
          type: 'string',
        },
      },
      type: 'object',
    },
    toolName: 'query-chat-history',
  },
  {
    crudType: ToolCRUDType.read,
    defaultPermission: ConnectorToolPermission.needs_approval,
    description:
      'List one page of Feishu group chats visible to the authorized user. This endpoint lists groups only; it does not discover all private one-to-one chats. Return page_token when more groups exist.',
    displayName: '列出飞书群聊',
    inputSchema: {
      additionalProperties: false,
      properties: {
        page_size: {
          default: DEFAULT_PAGE_SIZE,
          description: `Number of groups to return, from 1 to ${MAX_GROUP_PAGE_SIZE}.`,
          maximum: MAX_GROUP_PAGE_SIZE,
          minimum: 1,
          type: 'integer',
        },
        page_token: {
          description: 'Pagination token returned by the previous call.',
          type: 'string',
        },
        sort_type: {
          description: 'Group ordering. Active-time ordering can change while paging.',
          enum: ['ByCreateTimeAsc', 'ByActiveTimeDesc'],
          type: 'string',
        },
      },
      type: 'object',
    },
    toolName: 'list-group-chats',
  },
  {
    crudType: ToolCRUDType.read,
    defaultPermission: ConnectorToolPermission.needs_approval,
    description:
      'Search Feishu message content visible to the authorized user. query matches message text, not a contact name. For chat history with a named person or group, use query-chat-history instead. Dates and displayed times always use Asia/Shanghai.',
    displayName: '搜索飞书消息',
    inputSchema: {
      additionalProperties: false,
      properties: {
        at_chatter_ids: {
          description: 'Optional open_ids of users mentioned in the message.',
          items: { type: 'string' },
          maxItems: 50,
          type: 'array',
        },
        chat_ids: {
          description: 'Optional known Feishu chat_ids to limit the search.',
          items: { type: 'string' },
          maxItems: 50,
          type: 'array',
        },
        chat_type: {
          description: 'Set p2p_chat for private one-to-one messages, or group_chat for groups.',
          enum: ['group_chat', 'p2p_chat'],
          type: 'string',
        },
        date: {
          description:
            "Calendar date in Asia/Shanghai, formatted YYYY-MM-DD. Use this for 'today' instead of calculating timestamps.",
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          type: 'string',
        },
        end_time: {
          description: 'Optional inclusive Unix timestamp in seconds.',
          oneOf: [{ type: 'integer' }, { pattern: '^\\d+$', type: 'string' }],
        },
        from_ids: {
          description:
            'Optional Feishu-verified sender open_ids. Use this, not a display-name query, to identify messages from a named person.',
          items: { type: 'string' },
          maxItems: 50,
          type: 'array',
        },
        from_type: { enum: ['bot', 'user'], type: 'string' },
        message_type: { enum: ['file', 'image', 'media'], type: 'string' },
        page_size: {
          default: DEFAULT_SEARCH_PAGE_SIZE,
          description: `Number of matched messages to return, from 1 to ${MAX_SEARCH_PAGE_SIZE}.`,
          maximum: MAX_SEARCH_PAGE_SIZE,
          minimum: 1,
          type: 'integer',
        },
        page_token: {
          description: 'Pagination token returned by the previous search.',
          type: 'string',
        },
        query: {
          description:
            'Optional message-content keyword. It does not search or verify chat participants.',
          maxLength: 1000,
          type: 'string',
        },
        start_time: {
          description: 'Optional inclusive Unix timestamp in seconds.',
          oneOf: [{ type: 'integer' }, { pattern: '^\\d+$', type: 'string' }],
        },
      },
      type: 'object',
    },
    toolName: 'search-chat-messages',
  },
  {
    crudType: ToolCRUDType.read,
    defaultPermission: ConnectorToolPermission.needs_approval,
    description:
      "Read one bounded page of messages from a known Feishu chat_id (private p2p or group) or thread_id, using the current user authorization. If the user requests 'today' or another calendar day, pass date as YYYY-MM-DD; dates and displayed times always use Asia/Shanghai. When no range is passed, never describe the result as date-filtered. Use items[].text_for_analysis, create_time_local and only verified sender names in the answer. Use page_token to continue. For ordinary group topics, chat returns root messages only; use thread for replies.",
    displayName: '读取飞书会话消息',
    inputSchema: {
      additionalProperties: false,
      properties: {
        chat_id: {
          description: 'Known Feishu chat_id, or thread_id when container_type is thread.',
          type: 'string',
        },
        container_type: {
          default: 'chat',
          enum: ['chat', 'thread'],
          type: 'string',
        },
        date: {
          description:
            "Calendar date in Asia/Shanghai, formatted YYYY-MM-DD. Use this for 'today'. Not supported for threads.",
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          type: 'string',
        },
        end_time: {
          description: 'Optional Unix timestamp in seconds. Not supported for threads.',
          oneOf: [{ type: 'integer' }, { pattern: '^\\d+$', type: 'string' }],
        },
        page_size: {
          default: DEFAULT_PAGE_SIZE,
          description: `Number of messages to return, from 1 to ${MAX_MESSAGE_PAGE_SIZE}.`,
          maximum: MAX_MESSAGE_PAGE_SIZE,
          minimum: 1,
          type: 'integer',
        },
        page_token: {
          description: 'Pagination token returned by the previous call.',
          type: 'string',
        },
        sort_type: {
          default: 'ByCreateTimeDesc',
          enum: ['ByCreateTimeAsc', 'ByCreateTimeDesc'],
          type: 'string',
        },
        start_time: {
          description: 'Optional Unix timestamp in seconds. Not supported for threads.',
          oneOf: [{ type: 'integer' }, { pattern: '^\\d+$', type: 'string' }],
        },
      },
      required: ['chat_id'],
      type: 'object',
    },
    toolName: 'list-chat-messages',
  },
  {
    crudType: ToolCRUDType.read,
    defaultPermission: ConnectorToolPermission.needs_approval,
    description:
      "Read a single Feishu message by a known message_id using the current user authorization. Return items[].text_for_analysis as plain text suitable for reporting; do not replace it with a rich card or redirect link. Never call an image-generation tool or invent text for an image-only message. This does not search messages or bypass the user's Feishu data permissions.",
    displayName: '读取单条飞书消息',
    inputSchema: {
      additionalProperties: false,
      properties: {
        message_id: { description: 'Known Feishu message_id.', type: 'string' },
      },
      required: ['message_id'],
      type: 'object',
    },
    toolName: 'get-chat-message',
  },
] as const;

export class FeishuMessageToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeishuMessageToolError';
  }
}

interface FeishuApiResponse<T> {
  code?: number;
  data?: T;
  msg?: string;
}

interface FeishuChatMember {
  member_id?: string;
  name?: string;
}

interface FeishuChatMembersPage {
  has_more?: boolean;
  items?: FeishuChatMember[];
  page_token?: string;
}

interface FeishuChatItem {
  chat_id?: string;
  name?: string;
}

interface FeishuChatPage {
  has_more?: boolean;
  items?: FeishuChatItem[];
  page_token?: string;
}

interface FeishuMessageItem {
  body?: { content?: string };
  chat_id?: string;
  create_time?: string;
  deleted?: boolean;
  mentions?: unknown[];
  message_id?: string;
  msg_type?: string;
  parent_id?: string;
  root_id?: string;
  sender?: {
    id?: string;
    id_type?: string;
    sender_type?: string;
  };
  thread_id?: string;
  update_time?: string;
  updated?: boolean;
}

interface NormalizedFeishuMention {
  id?: string;
  key: string;
  name: string;
}

interface FeishuMessagePage {
  has_more?: boolean;
  items?: FeishuMessageItem[];
  page_token?: string;
}

const parseArgs = <T>(args: string | undefined, schema: z.ZodType<T>): T => {
  let value: unknown;
  try {
    value = JSON.parse(args || '{}');
  } catch {
    throw new FeishuMessageToolError('Tool arguments must be valid JSON');
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new FeishuMessageToolError(`Invalid tool arguments: ${result.error.issues[0]?.message}`);
  }

  return result.data;
};

const getUserAccessToken = (connector: DecryptedConnector): string => {
  if (connector.credentials?.type !== 'oauth2' || !connector.credentials.accessToken) {
    throw new FeishuMessageToolError('Feishu user authorization is missing');
  }

  return connector.credentials.accessToken;
};

const hasConnectorScopes = (connector: DecryptedConnector, scopes: readonly string[]): boolean => {
  if (connector.credentials?.type !== 'oauth2') return false;

  const grantedScopes = new Set(connector.credentials.scope?.split(/[\s,]+/).filter(Boolean) ?? []);
  return scopes.every((scope) => grantedScopes.has(scope));
};

const callFeishuApi = async <T>(
  connector: DecryptedConnector,
  path: string,
  query: Record<string, number | string | undefined> = {},
  options?: { body?: Record<string, unknown>; method?: 'GET' | 'POST' },
): Promise<T> => {
  const url = new URL(path, FEISHU_OPEN_API_ORIGIN);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      body: options?.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${getUserAccessToken(connector)}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      method: options?.method ?? 'GET',
      signal: AbortSignal.timeout(FEISHU_OPEN_API_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network request failed';
    throw new FeishuMessageToolError(`Feishu OpenAPI request failed: ${message}`);
  }

  let payload: FeishuApiResponse<T>;
  try {
    payload = (await response.json()) as FeishuApiResponse<T>;
  } catch {
    throw new FeishuMessageToolError(`Feishu OpenAPI returned HTTP ${response.status}`);
  }

  if (!response.ok || (payload.code !== undefined && payload.code !== 0)) {
    const code = payload.code ?? response.status;
    const reason = payload.msg || response.statusText || 'request rejected';
    throw new FeishuMessageToolError(`Feishu OpenAPI error ${code}: ${reason}`);
  }

  if (payload.data === undefined) {
    throw new FeishuMessageToolError('Feishu OpenAPI returned no data');
  }

  return payload.data;
};

const toToolResult = (payload: unknown): MCPToolCallResult => {
  const content = JSON.stringify(payload, null, 2);
  return {
    content,
    state: {
      content: [{ text: content, type: 'text' }],
      structuredContent: payload,
    },
    success: true,
  };
};

interface FeishuMessageContentLink {
  label?: string;
  url: string;
}

interface FeishuMessageContentResource {
  height?: number;
  key: string;
  name?: string;
  type: 'file' | 'image';
  width?: number;
}

interface FeishuMessageContentParts {
  fragments: string[];
  links: FeishuMessageContentLink[];
  resources: FeishuMessageContentResource[];
}

const pushUnique = (items: string[], value: string): void => {
  const normalized = value.replaceAll(/\s+/g, ' ').trim();
  if (normalized && !items.includes(normalized)) items.push(normalized);
};

const selectCanonicalMessageContent = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  if (Array.isArray(value.content_v2)) {
    return { content: value.content_v2, title: value.title };
  }
  if (Array.isArray(value.content)) {
    return { content: value.content, title: value.title };
  }

  return value;
};

const collectMessageContent = (value: unknown, parts: FeishuMessageContentParts): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectMessageContent(item, parts);
    return;
  }
  if (!isRecord(value)) return;

  if (value.tag === 'at' && typeof value.user_name === 'string') {
    pushUnique(parts.fragments, `@${value.user_name}`);
  }
  if (typeof value.image_key === 'string') {
    const resource: FeishuMessageContentResource = {
      height: typeof value.height === 'number' ? value.height : undefined,
      key: value.image_key,
      type: 'image',
      width: typeof value.width === 'number' ? value.width : undefined,
    };
    if (!parts.resources.some((item) => item.type === 'image' && item.key === resource.key)) {
      parts.resources.push(resource);
    }
  }
  if (typeof value.file_key === 'string') {
    const resource: FeishuMessageContentResource = {
      key: value.file_key,
      name:
        typeof value.file_name === 'string'
          ? value.file_name
          : typeof value.name === 'string'
            ? value.name
            : undefined,
      type: 'file',
    };
    if (!parts.resources.some((item) => item.type === 'file' && item.key === resource.key)) {
      parts.resources.push(resource);
    }
  }

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === 'string' &&
      ['default_url', 'href', 'pc_url', 'url'].includes(key) &&
      /^https?:\/\//.test(item)
    ) {
      if (!parts.links.some((link) => link.url === item)) {
        parts.links.push({
          label: typeof value.text === 'string' ? value.text : undefined,
          url: item,
        });
      }
    } else if (typeof item === 'string' && ['file_name', 'name', 'text', 'title'].includes(key)) {
      pushUnique(parts.fragments, item);
    } else if (Array.isArray(item) || isRecord(item)) {
      collectMessageContent(item, parts);
    }
  }
};

const normalizeMessageContent = (content?: string) => {
  if (!content) return { links: [], resources: [], text: '', truncated: false };

  const parsed = safeParseJSON<unknown>(content);
  const parts: FeishuMessageContentParts = { fragments: [], links: [], resources: [] };
  if (parsed !== undefined) collectMessageContent(selectCanonicalMessageContent(parsed), parts);
  const text = parts.fragments.length > 0 ? parts.fragments.join(' ') : content;
  const normalizedText = truncateSurrogateSafe(text, MAX_MESSAGE_TEXT_LENGTH);

  return {
    links: parts.links,
    resources: parts.resources,
    text: normalizedText,
    truncated: normalizedText.length < text.length,
  };
};

const normalizeMentions = (mentions: unknown[] | undefined): NormalizedFeishuMention[] =>
  (mentions ?? []).flatMap((mention) => {
    if (!isRecord(mention) || typeof mention.key !== 'string' || typeof mention.name !== 'string') {
      return [];
    }

    return [
      {
        id: typeof mention.id === 'string' ? mention.id : undefined,
        key: mention.key,
        name: mention.name,
      },
    ];
  });

const replaceMentionKeys = (text: string, mentions: NormalizedFeishuMention[]): string => {
  let normalized = text;
  for (const mention of [...mentions].sort((a, b) => b.key.length - a.key.length)) {
    normalized = normalized.replaceAll(mention.key, `@${mention.name}`);
  }
  return normalized;
};

const buildTextForAnalysis = (content: ReturnType<typeof normalizeMessageContent>): string => {
  const fragments = content.text ? [content.text] : [];

  for (const link of content.links) {
    fragments.push(link.label ? `${link.label}: ${link.url}` : link.url);
  }
  for (const resource of content.resources) {
    if (resource.type === 'image') {
      const dimensions =
        resource.width && resource.height ? ` ${resource.width}x${resource.height}` : '';
      fragments.push(`[图片${dimensions}]`);
    } else {
      fragments.push(resource.name ? `[文件: ${resource.name}]` : '[文件]');
    }
  }

  return fragments.join('\n');
};

const getNextCalendarDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const resolveTimeRange = (input: {
  date?: string;
  end_time?: number | string;
  start_time?: number | string;
}) => {
  if (!input.date) {
    return {
      date: undefined,
      endTime: input.end_time,
      startTime: input.start_time,
      timeZone: DEFAULT_TIME_ZONE,
    };
  }

  const startTime = dayjs.tz(`${input.date} 00:00:00`, DEFAULT_TIME_ZONE).unix();
  const endTime =
    dayjs.tz(`${getNextCalendarDate(input.date)} 00:00:00`, DEFAULT_TIME_ZONE).unix() - 1;
  return { date: input.date, endTime, startTime, timeZone: DEFAULT_TIME_ZONE };
};

const formatFeishuTimestamp = (timestamp: string | undefined, timeZone: string) => {
  if (!timestamp) return undefined;
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat('sv-SE', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(date);
};

const resolveChatMemberNames = async (
  connector: DecryptedConnector,
  chatIds: string[],
): Promise<{ names: Map<string, string>; warning?: string }> => {
  const names = new Map<string, string>();
  if (!hasConnectorScopes(connector, FEISHU_DOCUMENTS_CHAT_MEMBER_SCOPES)) {
    return {
      names,
      warning:
        'Sender names are unavailable because im:chat.members:read is not authorized. Use sender.id and do not infer names.',
    };
  }

  let failedLookup = false;
  for (const chatId of [...new Set(chatIds)].slice(0, MAX_MEMBER_CHAT_LOOKUPS)) {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_MEMBER_PAGES; page += 1) {
      try {
        const data = await callFeishuApi<FeishuChatMembersPage>(
          connector,
          `/open-apis/im/v1/chats/${encodeURIComponent(chatId)}/members`,
          {
            member_id_type: 'open_id',
            page_size: 100,
            page_token: pageToken,
          },
        );
        for (const member of data.items ?? []) {
          if (member.member_id && member.name) names.set(member.member_id, member.name);
        }
        if (!data.has_more || !data.page_token) break;
        pageToken = data.page_token;
      } catch {
        failedLookup = true;
        break;
      }
    }
  }

  return {
    names,
    warning: failedLookup
      ? 'Some sender names could not be verified. Use sender.id whenever name_verified is false.'
      : undefined,
  };
};

const normalizeMessageItem = (
  item: FeishuMessageItem,
  memberNames: Map<string, string>,
  timeZone: string,
) => {
  const senderId = item.sender?.id;
  const senderName = senderId ? memberNames.get(senderId) : undefined;
  const mentions = normalizeMentions(item.mentions);
  const rawContent = normalizeMessageContent(item.body?.content);
  const content = {
    ...rawContent,
    text: replaceMentionKeys(rawContent.text, mentions),
  };
  const createTimeLocal = formatFeishuTimestamp(item.create_time, timeZone);

  return {
    chat_id: item.chat_id,
    content,
    create_time_local: createTimeLocal,
    create_time_ms: item.create_time,
    deleted: item.deleted,
    mentions,
    message_id: item.message_id,
    msg_type: item.msg_type,
    parent_id: item.parent_id,
    root_id: item.root_id,
    sender: {
      id: senderId,
      id_type: item.sender?.id_type,
      name: senderName,
      name_verified: Boolean(senderName),
      sender_type: item.sender?.sender_type,
    },
    text_for_analysis: buildTextForAnalysis(content),
    thread_id: item.thread_id,
    update_time_local: formatFeishuTimestamp(item.update_time, timeZone),
    update_time_ms: item.update_time,
    updated: item.updated,
  };
};

type NormalizedFeishuMessageItem = ReturnType<typeof normalizeMessageItem>;

const normalizeMessagePage = async (
  connector: DecryptedConnector,
  data: FeishuMessagePage,
  timeZone: string,
) => {
  const items = data.items ?? [];
  const identity = await resolveChatMemberNames(
    connector,
    items.flatMap((item) => (item.chat_id ? [item.chat_id] : [])),
  );

  return {
    has_more: data.has_more ?? false,
    identity_resolution_warning: identity.warning,
    items: items.map((item) => normalizeMessageItem(item, identity.names, timeZone)),
    page_token: data.page_token,
    time_zone: timeZone,
  };
};

const searchAndNormalizeMessages = async (
  connector: DecryptedConnector,
  input: SearchChatMessagesInput,
) => {
  const range = resolveTimeRange(input);
  const searchData = await callFeishuApi<{
    has_more?: boolean;
    items?: Array<string | { message_id?: string }>;
    page_token?: string;
  }>(
    connector,
    '/open-apis/search/v2/message',
    {
      page_size: input.page_size ?? DEFAULT_SEARCH_PAGE_SIZE,
      page_token: input.page_token,
      user_id_type: 'open_id',
    },
    {
      body: {
        at_chatter_ids: input.at_chatter_ids,
        chat_ids: input.chat_ids,
        chat_type: input.chat_type,
        end_time: range.endTime === undefined ? undefined : String(range.endTime),
        from_ids: input.from_ids,
        from_type: input.from_type,
        message_type: input.message_type,
        query: input.query ?? '',
        start_time: range.startTime === undefined ? undefined : String(range.startTime),
      },
      method: 'POST',
    },
  );

  const messageIds = (searchData.items ?? [])
    .map((item) => (typeof item === 'string' ? item : item.message_id))
    .filter((messageId): messageId is string => Boolean(messageId));
  const detailResults = await Promise.allSettled(
    messageIds.map(async (messageId) => ({
      data: await callFeishuApi<FeishuMessagePage>(
        connector,
        `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
        { card_msg_content_type: 'user_card_content', user_id_type: 'open_id' },
      ),
      message_id: messageId,
    })),
  );
  const successfulItems = detailResults.flatMap((result) =>
    result.status === 'fulfilled' ? (result.value.data.items ?? []) : [],
  );
  const identity = await resolveChatMemberNames(
    connector,
    successfulItems.flatMap((item) => (item.chat_id ? [item.chat_id] : [])),
  );
  const normalizedItems: NormalizedFeishuMessageItem[] = [];
  const errors: Array<{ error: string; message_id: string | undefined }> = [];
  for (const [index, result] of detailResults.entries()) {
    if (result.status === 'rejected') {
      errors.push({
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Unable to read this matched message',
        message_id: messageIds[index],
      });
      continue;
    }

    const items = (result.value.data.items ?? []).map((item) =>
      normalizeMessageItem(item, identity.names, range.timeZone),
    );
    normalizedItems.push(...items);
  }

  return {
    applied_filters: {
      chat_type: input.chat_type,
      date: range.date,
      end_time: range.endTime,
      query: input.query ?? '',
      start_time: range.startTime,
      time_zone: range.timeZone,
    },
    errors,
    format: 'plain_text',
    has_more: searchData.has_more ?? false,
    identity_resolution_warning: identity.warning,
    items: normalizedItems,
    matched_count: messageIds.length,
    page_token: searchData.page_token,
    presentation_instruction:
      "Search results match message content and filters, not a named chat participant. Never claim that a p2p chat belongs to a person unless that identity is verified. If a named-person query returned no items, stop; do not retry with an empty query or choose another chat. Use each item's create_time_local, verified sender and text_for_analysis as report data.",
    privacy_boundary: 'Only messages visible to the currently authorized Feishu user are returned.',
    time_zone: range.timeZone,
  };
};

const listAndNormalizeMessages = async (
  connector: DecryptedConnector,
  input: ListChatMessagesInput,
) => {
  const range = resolveTimeRange(input);
  const data = await callFeishuApi<FeishuMessagePage>(connector, '/open-apis/im/v1/messages', {
    card_msg_content_type: 'user_card_content',
    container_id: input.chat_id,
    container_id_type: input.container_type ?? 'chat',
    end_time: range.endTime,
    page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
    page_token: input.page_token,
    sort_type: input.sort_type ?? 'ByCreateTimeDesc',
    start_time: range.startTime,
  });
  const normalized = await normalizeMessagePage(connector, data, range.timeZone);

  return {
    ...normalized,
    applied_filters: {
      date: range.date,
      end_time: range.endTime,
      range_filter_applied: range.startTime !== undefined || range.endTime !== undefined,
      start_time: range.startTime,
    },
    format: 'plain_text',
    presentation_instruction:
      "Use each item's create_time_local, verified sender and text_for_analysis as report data. Do not replace the text with cards or redirect links. An image marker is metadata only; never generate an image or invent its contents.",
    range_warning:
      range.startTime === undefined && range.endTime === undefined
        ? 'No time range was applied. Do not describe this page as today or any other date.'
        : undefined,
  };
};

const toHistoryMessage = (
  item: NormalizedFeishuMessageItem,
  target?: { id: string; name: string },
) => ({
  create_time_local: item.create_time_local,
  msg_type: item.msg_type,
  sender_name:
    target && item.sender.id === target.id
      ? target.name
      : item.sender.name || (target ? '我' : '未知成员'),
  text: item.text_for_analysis,
});

interface NormalizedHistoryPage {
  errors?: unknown[];
  has_more: boolean;
  items: NormalizedFeishuMessageItem[];
  page_token?: string;
}

interface CollectHistoryPagesOptions {
  initialPageToken?: string;
  loadPage: (pageToken?: string) => Promise<NormalizedHistoryPage>;
  target?: { id: string; name: string };
}

const collectHistoryPages = async ({
  initialPageToken,
  loadPage,
  target,
}: CollectHistoryPagesOptions) => {
  const items: ReturnType<typeof toHistoryMessage>[] = [];
  const messageIds = new Set<string>();
  let complete = false;
  let continuationPageToken = initialPageToken;
  let failedMessageCount = 0;
  let incompleteReason:
    'message_detail_errors' | 'missing_page_token' | 'page_limit' | 'result_size_limit' | undefined;
  let pagesRead = 0;

  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const pageToken = continuationPageToken;
    const history = await loadPage(pageToken);
    failedMessageCount += history.errors?.length ?? 0;
    const nextItems = history.items
      .filter((item) => !item.message_id || !messageIds.has(item.message_id))
      .map((item) => ({ item, message: toHistoryMessage(item, target) }));
    const candidateItems = [...items, ...nextItems.map(({ message }) => message)];

    if (
      items.length > 0 &&
      JSON.stringify(candidateItems, null, 2).length > MAX_HISTORY_ITEMS_JSON_LENGTH
    ) {
      incompleteReason = 'result_size_limit';
      continuationPageToken = pageToken;
      break;
    }

    for (const { item, message } of nextItems) {
      if (item.message_id) messageIds.add(item.message_id);
      items.push(message);
    }
    pagesRead += 1;

    if (!history.has_more) {
      complete = failedMessageCount === 0;
      if (!complete) incompleteReason = 'message_detail_errors';
      continuationPageToken = undefined;
      break;
    }
    if (!history.page_token) {
      incompleteReason = 'missing_page_token';
      continuationPageToken = undefined;
      break;
    }

    continuationPageToken = history.page_token;
  }

  if (!complete && !incompleteReason) incompleteReason = 'page_limit';

  return {
    complete,
    continuation_page_token: continuationPageToken,
    failed_message_count: failedMessageCount,
    has_more: Boolean(continuationPageToken),
    incomplete_reason: incompleteReason,
    items,
    message_count: items.length,
    pages_read: pagesRead,
  };
};

const getHistoryPresentationInstruction = (
  complete: boolean,
  targetLabel: string,
  continuationPageToken?: string,
) =>
  complete
    ? `The server reached the final Feishu page. Summarize all returned plain-text records for ${targetLabel} and state the exact message count.`
    : continuationPageToken
      ? `This is only a partial batch for ${targetLabel}. Explicitly state that more Feishu records exist and do not call it a complete daily report. Call query-chat-history again with continuation_page_token as page_token before producing a complete report.`
      : `The server could not verify a complete result for ${targetLabel}. Explicitly state that some Feishu records could not be read and do not call it a complete daily report.`;

const queryNamedChatHistory = async (
  connector: DecryptedConnector,
  input: QueryChatHistoryInput,
) => {
  const date = input.date ?? dayjs().tz(DEFAULT_TIME_ZONE).format('YYYY-MM-DD');

  if (input.target_type === 'all') {
    const history = await collectHistoryPages({
      initialPageToken: input.page_token,
      loadPage: (pageToken) =>
        searchAndNormalizeMessages(connector, {
          date,
          page_size: Math.min(input.page_size ?? MAX_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE),
          page_token: pageToken,
          query: '',
        }),
    });

    return {
      ...history,
      date,
      presentation_instruction: getHistoryPresentationInstruction(
        history.complete,
        `all visible private and group chats on ${date}`,
        history.continuation_page_token,
      ),
      privacy_boundary:
        'Only messages visible to the currently authorized Feishu user are returned.',
      status: history.items.length > 0 ? 'found' : 'not_found',
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }

  const targetName = input.target_name;
  if (!targetName) {
    throw new FeishuMessageToolError('target_name is required for person or group history');
  }

  if (input.target_type === 'group') {
    const exactMatches: FeishuChatItem[] = [];
    const similarNames = new Set<string>();
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_GROUP_LOOKUP_PAGES; page += 1) {
      const data = await callFeishuApi<FeishuChatPage>(connector, '/open-apis/im/v1/chats', {
        page_size: MAX_GROUP_PAGE_SIZE,
        page_token: pageToken,
        sort_type: 'ByActiveTimeDesc',
        user_id_type: 'open_id',
      });
      for (const chat of data.items ?? []) {
        const name = chat.name?.trim();
        if (!name) continue;
        if (name === targetName) exactMatches.push(chat);
        else if (name.includes(targetName) || targetName.includes(name)) {
          similarNames.add(name);
        }
      }
      if (!data.has_more || !data.page_token) break;
      pageToken = data.page_token;
    }

    const uniqueMatches = [
      ...new Map(
        exactMatches.filter((chat) => chat.chat_id).map((chat) => [chat.chat_id, chat]),
      ).values(),
    ];
    if (uniqueMatches.length === 0) {
      return {
        clarification_message: `未找到名称完全匹配“${targetName}”的飞书群，请确认群名是否完整。`,
        date,
        similar_group_names: [...similarNames].slice(0, 5),
        status: 'not_found',
        target_name: targetName,
        target_type: input.target_type,
        time_zone: DEFAULT_TIME_ZONE,
      };
    }
    if (uniqueMatches.length > 1) {
      return {
        clarification_message: `找到多个名为“${targetName}”的飞书群，请补充群链接或群内任意一条消息以确认。`,
        date,
        match_count: uniqueMatches.length,
        status: 'ambiguous',
        target_name: targetName,
        target_type: input.target_type,
        time_zone: DEFAULT_TIME_ZONE,
      };
    }

    const history = await collectHistoryPages({
      initialPageToken: input.page_token,
      loadPage: (pageToken) =>
        listAndNormalizeMessages(connector, {
          chat_id: uniqueMatches[0].chat_id!,
          date,
          page_size: input.page_size,
          page_token: pageToken,
          sort_type: 'ByCreateTimeAsc',
        }),
    });
    return {
      ...history,
      date,
      presentation_instruction: getHistoryPresentationInstruction(
        history.complete,
        `the exact group “${targetName}” on ${date}`,
        history.continuation_page_token,
      ),
      status: 'found',
      target_name: targetName,
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }

  const identitySearch = await searchAndNormalizeMessages(connector, {
    page_size: MAX_SEARCH_PAGE_SIZE,
    query: targetName,
  });
  const candidates = new Map<string, string>();
  for (const item of identitySearch.items) {
    for (const mention of item.mentions) {
      if (mention.name === targetName && mention.id) {
        candidates.set(mention.id, mention.name);
      }
    }
    if (item.sender.name_verified && item.sender.name === targetName && item.sender.id) {
      candidates.set(item.sender.id, item.sender.name);
    }
  }

  if (candidates.size === 0) {
    return {
      clarification_message: `未能在当前可见消息中确认“${targetName}”的飞书身份，请确认姓名是否完整，或补充你们所在的群名。`,
      date,
      status: 'not_found',
      target_name: targetName,
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }
  if (candidates.size > 1) {
    return {
      clarification_message: `找到多个名为“${targetName}”的飞书用户，请补充所在部门或你们共同的群名。`,
      date,
      match_count: candidates.size,
      status: 'ambiguous',
      target_name: targetName,
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }

  const [[targetId, verifiedTargetName]] = [...candidates.entries()];
  const p2pSearch = await searchAndNormalizeMessages(connector, {
    chat_type: 'p2p_chat',
    from_ids: [targetId],
    page_size: MAX_SEARCH_PAGE_SIZE,
    query: '',
  });
  const chatIds = [
    ...new Set(p2pSearch.items.flatMap((item) => (item.chat_id ? [item.chat_id] : []))),
  ];
  if (chatIds.length === 0) {
    return {
      clarification_message: `已确认“${targetName}”，但未找到可读取的单聊会话，请确认你们是否有过飞书单聊。`,
      date,
      status: 'not_found',
      target_name: targetName,
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }
  if (chatIds.length > 1) {
    return {
      clarification_message: `“${targetName}”对应多个可读取的单聊会话，请补充更具体的时间或消息内容。`,
      date,
      match_count: chatIds.length,
      status: 'ambiguous',
      target_name: targetName,
      target_type: input.target_type,
      time_zone: DEFAULT_TIME_ZONE,
    };
  }

  const history = await collectHistoryPages({
    initialPageToken: input.page_token,
    loadPage: (pageToken) =>
      listAndNormalizeMessages(connector, {
        chat_id: chatIds[0],
        date,
        page_size: input.page_size,
        page_token: pageToken,
        sort_type: 'ByCreateTimeAsc',
      }),
    target: { id: targetId, name: verifiedTargetName },
  });
  return {
    ...history,
    date,
    presentation_instruction: getHistoryPresentationInstruction(
      history.complete,
      `the verified person “${targetName}” on ${date}`,
      history.continuation_page_token,
    ),
    status: 'found',
    target_name: targetName,
    target_type: input.target_type,
    time_zone: DEFAULT_TIME_ZONE,
  };
};

export const isFeishuMessageTool = (toolName: string): boolean =>
  (FEISHU_DOCUMENTS_MESSAGE_TOOLS as readonly string[]).includes(toolName);

export const callFeishuMessageTool = async (
  connector: DecryptedConnector,
  toolName: string,
  args?: string,
): Promise<MCPToolCallResult> => {
  switch (toolName) {
    case 'query-chat-history': {
      const input = parseArgs(args, queryChatHistoryArgsSchema);
      return toToolResult(await queryNamedChatHistory(connector, input));
    }
    case 'list-group-chats': {
      const input = parseArgs(args, listGroupChatsArgsSchema);
      const data = await callFeishuApi<FeishuMessagePage>(connector, '/open-apis/im/v1/chats', {
        page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
        page_token: input.page_token,
        sort_type: input.sort_type ?? 'ByActiveTimeDesc',
        user_id_type: 'open_id',
      });
      return toToolResult({
        ...data,
        capability: {
          p2p_discovery: false,
          p2p_read_by_known_chat_id: true,
          p2p_search_tool: 'search-chat-messages',
        },
        limitation:
          'This list contains Feishu groups only. To discover private p2p messages, use search-chat-messages.',
      });
    }
    case 'search-chat-messages': {
      const input = parseArgs(args, searchChatMessagesArgsSchema);
      return toToolResult(await searchAndNormalizeMessages(connector, input));
    }
    case 'list-chat-messages': {
      const input = parseArgs(args, listChatMessagesArgsSchema);
      return toToolResult(await listAndNormalizeMessages(connector, input));
    }
    case 'get-chat-message': {
      const input = parseArgs(args, getChatMessageArgsSchema);
      const data = await callFeishuApi<FeishuMessagePage>(
        connector,
        `/open-apis/im/v1/messages/${encodeURIComponent(input.message_id)}`,
        { card_msg_content_type: 'user_card_content', user_id_type: 'open_id' },
      );
      const normalized = await normalizeMessagePage(connector, data, DEFAULT_TIME_ZONE);
      return toToolResult({
        ...normalized,
        format: 'plain_text',
        presentation_instruction:
          "Use the item's create_time_local, verified sender and text_for_analysis as report data. Do not replace the text with a card or redirect link. An image marker is metadata only; never generate an image or invent its contents.",
      });
    }
    default: {
      throw new FeishuMessageToolError(`Unsupported Feishu message tool: ${toolName}`);
    }
  }
};
