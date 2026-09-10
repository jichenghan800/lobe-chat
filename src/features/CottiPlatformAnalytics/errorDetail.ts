import type {
  CottiPlatformAnalyticsAgentErrorSort,
  CottiPlatformAnalyticsChatErrorSort,
} from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsDetailListState } from './detail';

export type CottiPlatformAnalyticsErrorView = 'agent' | 'chat';

export interface CottiPlatformAnalyticsErrorDetailsState {
  agent: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsAgentErrorSort>;
  chat: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatErrorSort>;
  view: CottiPlatformAnalyticsErrorView;
}

const AGENT_SORTS = new Set<CottiPlatformAnalyticsAgentErrorSort>([
  'affectedUsers',
  'errorExecutions',
]);
const CHAT_SORTS = new Set<CottiPlatformAnalyticsChatErrorSort>(['affectedUsers', 'errorMessages']);
const DEFAULT_AGENT_SORT: CottiPlatformAnalyticsAgentErrorSort = 'errorExecutions';
const DEFAULT_CHAT_SORT: CottiPlatformAnalyticsChatErrorSort = 'errorMessages';
const DEFAULT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 100;

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const parsePageSize = (value: string | null): 20 | 50 => (value === '50' ? 50 : 20);

const parseQuery = (value: string | null) => (value ?? '').slice(0, MAX_QUERY_LENGTH);

const parseSort = <TSort extends string>(
  value: string | null,
  values: Set<TSort>,
  fallback: TSort,
) => (value && values.has(value as TSort) ? (value as TSort) : fallback);

export const parseCottiPlatformAnalyticsErrorDetails = (
  searchParams: URLSearchParams,
): CottiPlatformAnalyticsErrorDetailsState => ({
  agent: {
    page: parsePage(searchParams.get('agentErrorPage')),
    pageSize: parsePageSize(searchParams.get('agentErrorPageSize')),
    q: parseQuery(searchParams.get('agentErrorQ')),
    sortBy: parseSort(searchParams.get('agentErrorSort'), AGENT_SORTS, DEFAULT_AGENT_SORT),
  },
  chat: {
    page: parsePage(searchParams.get('chatErrorPage')),
    pageSize: parsePageSize(searchParams.get('chatErrorPageSize')),
    q: parseQuery(searchParams.get('chatErrorQ')),
    sortBy: parseSort(searchParams.get('chatErrorSort'), CHAT_SORTS, DEFAULT_CHAT_SORT),
  },
  view: searchParams.get('errorView') === 'agent' ? 'agent' : 'chat',
});

const writeListState = <TSort extends string>(
  params: URLSearchParams,
  prefix: 'agentError' | 'chatError',
  state: CottiPlatformAnalyticsDetailListState<TSort>,
  defaultSort: TSort,
) => {
  const entries = {
    Page: state.page > 1 ? String(state.page) : undefined,
    PageSize: state.pageSize !== DEFAULT_PAGE_SIZE ? String(state.pageSize) : undefined,
    Q: state.q || undefined,
    Sort: state.sortBy !== defaultSort ? state.sortBy : undefined,
  };

  for (const [suffix, value] of Object.entries(entries)) {
    const key = `${prefix}${suffix}`;
    if (value) params.set(key, value);
    else params.delete(key);
  }
};

export const writeCottiPlatformAnalyticsErrorDetails = (
  current: URLSearchParams,
  state: CottiPlatformAnalyticsErrorDetailsState,
) => {
  const next = new URLSearchParams(current);

  if (state.view === 'agent') next.set('errorView', state.view);
  else next.delete('errorView');
  writeListState(next, 'agentError', state.agent, DEFAULT_AGENT_SORT);
  writeListState(next, 'chatError', state.chat, DEFAULT_CHAT_SORT);

  return next;
};
