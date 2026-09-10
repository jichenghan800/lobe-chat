import { useDebounce } from 'ahooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useClientDataSWR } from '@/libs/swr';
import { cottiPlatformAuditService } from '@/services/cottiPlatformAudit';

import type { CottiPlatformAuditState } from './state';
import {
  parseCottiPlatformAuditState,
  toCottiPlatformAuditQuery,
  writeCottiPlatformAuditState,
} from './state';

export const useCottiPlatformAudit = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseCottiPlatformAuditState(searchParams), [searchParams]);
  const [queryInput, setQueryInput] = useState(state.q);
  const debouncedQuery = useDebounce(queryInput, { wait: 300 });
  const [activeMessageId, setActiveMessageId] = useState<string>();
  const [detailViewNonce, setDetailViewNonce] = useState(0);
  const [analysisLoadingId, setAnalysisLoadingId] = useState<string>();
  const query = toCottiPlatformAuditQuery({ ...state, q: debouncedQuery });

  useEffect(() => {
    setQueryInput(state.q);
  }, [state.q]);

  useEffect(() => {
    if (debouncedQuery === state.q) return;

    setSearchParams(
      writeCottiPlatformAuditState(searchParams, {
        ...state,
        page: 1,
        q: debouncedQuery,
      }),
      { replace: true },
    );
  }, [debouncedQuery, searchParams, setSearchParams, state]);
  const dashboardSWR = useClientDataSWR(
    [
      'cotti',
      'platform-audit',
      'dashboard',
      query.range,
      query.feature,
      query.riskLevel,
      query.q || '',
      query.page,
      query.pageSize,
    ],
    () => cottiPlatformAuditService.getDashboard(query),
    { revalidateOnFocus: false },
  );
  const detailSWR = useClientDataSWR(
    activeMessageId
      ? ['cotti', 'platform-audit', 'detail', activeMessageId, detailViewNonce]
      : null,
    () => cottiPlatformAuditService.getMessageDetail(activeMessageId!),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const updateState = (patch: Partial<CottiPlatformAuditState>, replace = false) => {
    const nextState = { ...state, ...patch };
    setSearchParams(writeCottiPlatformAuditState(searchParams, nextState), { replace });
  };

  return {
    activeMessageId,
    analysisLoadingId,
    analyzeMessage: async (messageId: string, force = false) => {
      setAnalysisLoadingId(messageId);
      try {
        const analysis = await cottiPlatformAuditService.analyzeMessageRisk(messageId, force);
        await Promise.all([dashboardSWR.mutate(), detailSWR.mutate()]);
        return analysis;
      } finally {
        setAnalysisLoadingId(undefined);
      }
    },
    closeDetail: () => setActiveMessageId(undefined),
    dashboardSWR,
    detailSWR,
    queryInput,
    resetFilters: () => {
      setQueryInput('');
      updateState({ feature: 'all', page: 1, q: '', riskLevel: 'flagged' }, true);
    },
    setFeature: (feature: CottiPlatformAuditState['feature']) => updateState({ feature, page: 1 }),
    setPage: (page: number, pageSize: 20 | 50) => updateState({ page, pageSize }),
    setQuery: setQueryInput,
    setRange: (range: CottiPlatformAuditState['range']) => updateState({ page: 1, range }),
    setRiskLevel: (riskLevel: CottiPlatformAuditState['riskLevel']) =>
      updateState({ page: 1, riskLevel }),
    showDetail: (messageId: string) => {
      setActiveMessageId(messageId);
      setDetailViewNonce((nonce) => nonce + 1);
    },
    state,
  };
};
