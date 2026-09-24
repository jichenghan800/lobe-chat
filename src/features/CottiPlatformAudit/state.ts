import type {
  CottiPlatformAuditFeature,
  CottiPlatformAuditQuery,
  CottiPlatformAuditRange,
  CottiPlatformAuditRiskFilter,
} from '@/types/cotti/platformAudit';

export interface CottiPlatformAuditState {
  feature: 'all' | CottiPlatformAuditFeature;
  page: number;
  pageSize: 20 | 50;
  q: string;
  range: CottiPlatformAuditRange;
  riskLevel: CottiPlatformAuditRiskFilter;
}

export const DEFAULT_COTTI_PLATFORM_AUDIT_STATE: CottiPlatformAuditState = {
  feature: 'all',
  page: 1,
  pageSize: 20,
  q: '',
  range: 7,
  riskLevel: 'flagged',
};

const FEATURES = new Set<CottiPlatformAuditState['feature']>([
  'all',
  'agent',
  'chat',
  'task',
  'search',
  'tool',
]);
const RANGES = new Set<CottiPlatformAuditRange>([1, 7, 30, 90]);
const RISK_LEVELS = new Set<CottiPlatformAuditRiskFilter>([
  'all',
  'flagged',
  'high',
  'low',
  'medium',
  'none',
]);

const parsePositiveInteger = (value: null | string, fallback: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

export const parseCottiPlatformAuditState = (
  searchParams: URLSearchParams,
): CottiPlatformAuditState => {
  const feature = searchParams.get('auditFeature') as CottiPlatformAuditState['feature'];
  const range = Number(searchParams.get('auditRange')) as CottiPlatformAuditRange;
  const riskLevel = searchParams.get('auditRisk') as CottiPlatformAuditRiskFilter;
  const pageSize = Number(searchParams.get('auditPageSize'));

  return {
    feature: FEATURES.has(feature) ? feature : DEFAULT_COTTI_PLATFORM_AUDIT_STATE.feature,
    page: parsePositiveInteger(
      searchParams.get('auditPage'),
      DEFAULT_COTTI_PLATFORM_AUDIT_STATE.page,
    ),
    pageSize: pageSize === 50 ? 50 : DEFAULT_COTTI_PLATFORM_AUDIT_STATE.pageSize,
    q: searchParams.get('auditQ')?.slice(0, 100) || '',
    range: RANGES.has(range) ? range : DEFAULT_COTTI_PLATFORM_AUDIT_STATE.range,
    riskLevel: RISK_LEVELS.has(riskLevel)
      ? riskLevel
      : DEFAULT_COTTI_PLATFORM_AUDIT_STATE.riskLevel,
  };
};

export const writeCottiPlatformAuditState = (
  current: URLSearchParams,
  state: CottiPlatformAuditState,
) => {
  const next = new URLSearchParams(current);
  const write = (key: string, value: number | string, defaultValue: number | string) => {
    if (value === defaultValue || value === '') next.delete(key);
    else next.set(key, String(value));
  };

  write('auditFeature', state.feature, DEFAULT_COTTI_PLATFORM_AUDIT_STATE.feature);
  write('auditPage', state.page, DEFAULT_COTTI_PLATFORM_AUDIT_STATE.page);
  write('auditPageSize', state.pageSize, DEFAULT_COTTI_PLATFORM_AUDIT_STATE.pageSize);
  write('auditQ', state.q.trim(), DEFAULT_COTTI_PLATFORM_AUDIT_STATE.q);
  write('auditRange', state.range, DEFAULT_COTTI_PLATFORM_AUDIT_STATE.range);
  write('auditRisk', state.riskLevel, DEFAULT_COTTI_PLATFORM_AUDIT_STATE.riskLevel);

  return next;
};

export const toCottiPlatformAuditQuery = (
  state: CottiPlatformAuditState,
): CottiPlatformAuditQuery => ({
  feature: state.feature,
  page: state.page,
  pageSize: state.pageSize,
  q: state.q.trim() || undefined,
  range: state.range,
  riskLevel: state.riskLevel,
});
