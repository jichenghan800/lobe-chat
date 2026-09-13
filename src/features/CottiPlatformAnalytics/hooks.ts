import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { isCottiPlatformAnalyticsEnabled } from '@/_custom/registry/platformManagement';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPlatformAnalyticsService } from '@/services/cottiPlatformAnalytics';
import type { CottiPlatformAnalyticsPresetDays } from '@/types/cotti/platformAnalytics';

import type {
  CottiPlatformAnalyticsDetailListState,
  CottiPlatformAnalyticsDetailsState,
  CottiPlatformAnalyticsDetailView,
} from './detail';
import { parseCottiPlatformAnalyticsDetails, writeCottiPlatformAnalyticsDetails } from './detail';
import type {
  CottiPlatformAnalyticsErrorDetailsState,
  CottiPlatformAnalyticsErrorView,
} from './errorDetail';
import {
  parseCottiPlatformAnalyticsErrorDetails,
  writeCottiPlatformAnalyticsErrorDetails,
} from './errorDetail';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import {
  getCottiPlatformAnalyticsRangeMode,
  getDefaultCottiPlatformAnalyticsCustomRange,
  normalizeCottiPlatformAnalyticsCustomRange,
  parseCottiPlatformAnalyticsRange,
  toCottiPlatformAnalyticsQuery,
  writeCottiPlatformAnalyticsRange,
} from './range';

const accessKey = ['cotti', 'platform-admin-access'] as const;

const dashboardKey = (query: ReturnType<typeof toCottiPlatformAnalyticsQuery>) =>
  query.type === 'custom'
    ? (['cotti', 'platform-analytics', 'custom', query.startDate, query.endDate] as const)
    : (['cotti', 'platform-analytics', 'preset', query.days] as const);

const featuresKey = (query: ReturnType<typeof toCottiPlatformAnalyticsQuery>) =>
  query.type === 'custom'
    ? ([
        'cotti',
        'platform-analytics',
        'features',
        'custom',
        query.startDate,
        query.endDate,
      ] as const)
    : (['cotti', 'platform-analytics', 'features', 'preset', query.days] as const);

const rangeKey = (query: ReturnType<typeof toCottiPlatformAnalyticsQuery>) =>
  query.type === 'custom'
    ? (['custom', query.startDate, query.endDate] as const)
    : (['preset', query.days] as const);

export const useCottiPlatformAdminAccess = (options?: { suspense?: boolean }) => {
  const enabled = isCottiPlatformAnalyticsEnabled();

  return {
    enabled,
    swr: useClientDataSWR(
      enabled ? accessKey : null,
      () => cottiPlatformAnalyticsService.getAccess(),
      { revalidateOnFocus: false, ...options },
    ),
  };
};

export const useCottiPlatformAnalyticsRange = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useMemo(() => parseCottiPlatformAnalyticsRange(searchParams), [searchParams]);

  const setRange = (nextRange: CottiPlatformAnalyticsRangeSelection) => {
    setSearchParams(writeCottiPlatformAnalyticsRange(searchParams, nextRange));
  };

  return {
    mode: getCottiPlatformAnalyticsRangeMode(range),
    range,
    setCustomDate: (field: 'endDate' | 'startDate', value: string) => {
      const customRange =
        range.type === 'custom' ? range : getDefaultCottiPlatformAnalyticsCustomRange();
      setRange(normalizeCottiPlatformAnalyticsCustomRange(customRange, field, value));
    },
    setMode: (mode: CottiPlatformAnalyticsPresetDays | 'custom') => {
      setRange(
        mode === 'custom'
          ? getDefaultCottiPlatformAnalyticsCustomRange()
          : { days: mode, type: 'preset' },
      );
    },
  };
};

export const useCottiPlatformAnalyticsDetails = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseCottiPlatformAnalyticsDetails(searchParams), [searchParams]);

  const setState = (nextState: CottiPlatformAnalyticsDetailsState, replace = false) => {
    setSearchParams(writeCottiPlatformAnalyticsDetails(searchParams, nextState), { replace });
  };

  const updateAgents = (
    nextAgents: CottiPlatformAnalyticsDetailListState<
      CottiPlatformAnalyticsDetailsState['agents']['sortBy']
    >,
    replace = false,
  ) => setState({ ...state, agents: nextAgents }, replace);
  const updateModels = (
    nextModels: CottiPlatformAnalyticsDetailListState<
      CottiPlatformAnalyticsDetailsState['models']['sortBy']
    >,
    replace = false,
  ) => setState({ ...state, models: nextModels }, replace);
  const updateUsers = (
    nextUsers: CottiPlatformAnalyticsDetailListState<
      CottiPlatformAnalyticsDetailsState['users']['sortBy']
    >,
    replace = false,
  ) => setState({ ...state, users: nextUsers }, replace);

  return {
    ...state,
    setAgentPage: (page: number, pageSize: 20 | 50) =>
      updateAgents({ ...state.agents, page, pageSize }),
    setAgentQuery: (q: string) => updateAgents({ ...state.agents, page: 1, q }, true),
    setAgentSort: (sortBy: CottiPlatformAnalyticsDetailsState['agents']['sortBy']) =>
      updateAgents({ ...state.agents, page: 1, sortBy }),
    setModelPage: (page: number, pageSize: 20 | 50) =>
      updateModels({ ...state.models, page, pageSize }),
    setModelQuery: (q: string) => updateModels({ ...state.models, page: 1, q }, true),
    setModelSort: (sortBy: CottiPlatformAnalyticsDetailsState['models']['sortBy']) =>
      updateModels({ ...state.models, page: 1, sortBy }),
    setUserPage: (page: number, pageSize: 20 | 50) =>
      updateUsers({ ...state.users, page, pageSize }),
    setUserQuery: (q: string) => updateUsers({ ...state.users, page: 1, q }, true),
    setUserSort: (sortBy: CottiPlatformAnalyticsDetailsState['users']['sortBy']) =>
      updateUsers({ ...state.users, page: 1, sortBy }),
    setView: (view: CottiPlatformAnalyticsDetailView) => setState({ ...state, view }),
  };
};

export const useCottiPlatformAnalyticsErrorDetails = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(
    () => parseCottiPlatformAnalyticsErrorDetails(searchParams),
    [searchParams],
  );

  const setState = (nextState: CottiPlatformAnalyticsErrorDetailsState, replace = false) => {
    setSearchParams(writeCottiPlatformAnalyticsErrorDetails(searchParams, nextState), { replace });
  };

  return {
    ...state,
    setAgentPage: (page: number, pageSize: 20 | 50) =>
      setState({ ...state, agent: { ...state.agent, page, pageSize } }),
    setAgentQuery: (q: string) =>
      setState({ ...state, agent: { ...state.agent, page: 1, q } }, true),
    setAgentSort: (sortBy: CottiPlatformAnalyticsErrorDetailsState['agent']['sortBy']) =>
      setState({ ...state, agent: { ...state.agent, page: 1, sortBy } }),
    setChatPage: (page: number, pageSize: 20 | 50) =>
      setState({ ...state, chat: { ...state.chat, page, pageSize } }),
    setChatQuery: (q: string) => setState({ ...state, chat: { ...state.chat, page: 1, q } }, true),
    setChatSort: (sortBy: CottiPlatformAnalyticsErrorDetailsState['chat']['sortBy']) =>
      setState({ ...state, chat: { ...state.chat, page: 1, sortBy } }),
    setView: (view: CottiPlatformAnalyticsErrorView) => setState({ ...state, view }),
  };
};

export const useCottiPlatformAnalyticsDashboard = (
  range: CottiPlatformAnalyticsRangeSelection,
  enabled: boolean,
) => {
  const query = toCottiPlatformAnalyticsQuery(range);

  return useClientDataSWR(
    enabled ? dashboardKey(query) : null,
    () => cottiPlatformAnalyticsService.getDashboard(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsFeatures = (
  range: CottiPlatformAnalyticsRangeSelection,
  enabled: boolean,
) => {
  const query = toCottiPlatformAnalyticsQuery(range);

  return useClientDataSWR(
    enabled ? featuresKey(query) : null,
    () => cottiPlatformAnalyticsService.getFeatures(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsAgents = (
  range: CottiPlatformAnalyticsRangeSelection,
  details: CottiPlatformAnalyticsDetailsState['agents'],
  enabled: boolean,
) => {
  const rangeQuery = toCottiPlatformAnalyticsQuery(range);
  const query = { ...details, range: rangeQuery };

  return useClientDataSWR(
    enabled
      ? [
          'cotti',
          'platform-analytics',
          'agents',
          ...rangeKey(rangeQuery),
          details.q,
          details.sortBy,
          details.page,
          details.pageSize,
        ]
      : null,
    () => cottiPlatformAnalyticsService.getAgents(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsAgentErrors = (
  range: CottiPlatformAnalyticsRangeSelection,
  details: CottiPlatformAnalyticsErrorDetailsState['agent'],
  enabled: boolean,
) => {
  const rangeQuery = toCottiPlatformAnalyticsQuery(range);
  const query = { ...details, range: rangeQuery };

  return useClientDataSWR(
    enabled
      ? [
          'cotti',
          'platform-analytics',
          'agent-errors',
          ...rangeKey(rangeQuery),
          details.q,
          details.sortBy,
          details.page,
          details.pageSize,
        ]
      : null,
    () => cottiPlatformAnalyticsService.getAgentErrors(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsChatErrors = (
  range: CottiPlatformAnalyticsRangeSelection,
  details: CottiPlatformAnalyticsErrorDetailsState['chat'],
  enabled: boolean,
) => {
  const rangeQuery = toCottiPlatformAnalyticsQuery(range);
  const query = { ...details, range: rangeQuery };

  return useClientDataSWR(
    enabled
      ? [
          'cotti',
          'platform-analytics',
          'chat-errors',
          ...rangeKey(rangeQuery),
          details.q,
          details.sortBy,
          details.page,
          details.pageSize,
        ]
      : null,
    () => cottiPlatformAnalyticsService.getChatErrors(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsChatModels = (
  range: CottiPlatformAnalyticsRangeSelection,
  details: CottiPlatformAnalyticsDetailsState['models'],
  enabled: boolean,
) => {
  const rangeQuery = toCottiPlatformAnalyticsQuery(range);
  const query = { ...details, range: rangeQuery };

  return useClientDataSWR(
    enabled
      ? [
          'cotti',
          'platform-analytics',
          'chat-models',
          ...rangeKey(rangeQuery),
          details.q,
          details.sortBy,
          details.page,
          details.pageSize,
        ]
      : null,
    () => cottiPlatformAnalyticsService.getChatModels(query),
    { revalidateOnFocus: false },
  );
};

export const useCottiPlatformAnalyticsChatUsers = (
  range: CottiPlatformAnalyticsRangeSelection,
  details: CottiPlatformAnalyticsDetailsState['users'],
  enabled: boolean,
) => {
  const rangeQuery = toCottiPlatformAnalyticsQuery(range);
  const query = { ...details, range: rangeQuery };

  return useClientDataSWR(
    enabled
      ? [
          'cotti',
          'platform-analytics',
          'chat-users',
          ...rangeKey(rangeQuery),
          details.q,
          details.sortBy,
          details.page,
          details.pageSize,
        ]
      : null,
    () => cottiPlatformAnalyticsService.getChatUsers(query),
    { revalidateOnFocus: false },
  );
};
