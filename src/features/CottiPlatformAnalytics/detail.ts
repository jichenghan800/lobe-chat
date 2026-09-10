import type {
  CottiPlatformAnalyticsAgentSort,
  CottiPlatformAnalyticsChatModelSort,
  CottiPlatformAnalyticsChatUserSort,
} from '@/types/cotti/platformAnalytics';

export type CottiPlatformAnalyticsDetailView = 'agents' | 'models' | 'users';

export interface CottiPlatformAnalyticsDetailListState<TSort extends string> {
  page: number;
  pageSize: 20 | 50;
  q: string;
  sortBy: TSort;
}

export interface CottiPlatformAnalyticsDetailsState {
  agents: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsAgentSort>;
  models: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatModelSort>;
  users: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatUserSort>;
  view: CottiPlatformAnalyticsDetailView;
}

const AGENT_SORTS = new Set<CottiPlatformAnalyticsAgentSort>([
  'activeUsers',
  'averageProcessingTimeMs',
  'errorExecutions',
  'executions',
  'lastExecutedAt',
  'recordedCost',
  'totalTokens',
]);
const MODEL_SORTS = new Set<CottiPlatformAnalyticsChatModelSort>([
  'activeUsers',
  'assistantMessages',
  'errorMessages',
  'recordedCost',
  'totalTokens',
]);
const USER_SORTS = new Set<CottiPlatformAnalyticsChatUserSort>([
  'assistantMessages',
  'errorMessages',
  'lastActiveAt',
  'recordedCost',
  'totalTokens',
]);
const DEFAULT_AGENT_SORT: CottiPlatformAnalyticsAgentSort = 'totalTokens';
const DEFAULT_MODEL_SORT: CottiPlatformAnalyticsChatModelSort = 'totalTokens';
const DEFAULT_USER_SORT: CottiPlatformAnalyticsChatUserSort = 'totalTokens';
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

export const parseCottiPlatformAnalyticsDetails = (
  searchParams: URLSearchParams,
): CottiPlatformAnalyticsDetailsState => ({
  agents: {
    page: parsePage(searchParams.get('usageAgentPage')),
    pageSize: parsePageSize(searchParams.get('usageAgentPageSize')),
    q: parseQuery(searchParams.get('usageAgentQ')),
    sortBy: parseSort(searchParams.get('usageAgentSort'), AGENT_SORTS, DEFAULT_AGENT_SORT),
  },
  models: {
    page: parsePage(searchParams.get('usageModelPage')),
    pageSize: parsePageSize(searchParams.get('usageModelPageSize')),
    q: parseQuery(searchParams.get('usageModelQ')),
    sortBy: parseSort(searchParams.get('usageModelSort'), MODEL_SORTS, DEFAULT_MODEL_SORT),
  },
  users: {
    page: parsePage(searchParams.get('usageUserPage')),
    pageSize: parsePageSize(searchParams.get('usageUserPageSize')),
    q: parseQuery(searchParams.get('usageUserQ')),
    sortBy: parseSort(searchParams.get('usageUserSort'), USER_SORTS, DEFAULT_USER_SORT),
  },
  view:
    searchParams.get('usageView') === 'agents'
      ? 'agents'
      : searchParams.get('usageView') === 'models'
        ? 'models'
        : 'users',
});

const writeListState = <TSort extends string>(
  params: URLSearchParams,
  prefix: 'usageAgent' | 'usageModel' | 'usageUser',
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

export const writeCottiPlatformAnalyticsDetails = (
  current: URLSearchParams,
  state: CottiPlatformAnalyticsDetailsState,
) => {
  const next = new URLSearchParams(current);

  if (state.view !== 'users') next.set('usageView', state.view);
  else next.delete('usageView');
  writeListState(next, 'usageAgent', state.agents, DEFAULT_AGENT_SORT);
  writeListState(next, 'usageModel', state.models, DEFAULT_MODEL_SORT);
  writeListState(next, 'usageUser', state.users, DEFAULT_USER_SORT);

  return next;
};
