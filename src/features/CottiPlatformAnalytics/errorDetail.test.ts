import { describe, expect, it } from 'vitest';

import type { CottiPlatformAnalyticsErrorDetailsState } from './errorDetail';
import {
  parseCottiPlatformAnalyticsErrorDetails,
  writeCottiPlatformAnalyticsErrorDetails,
} from './errorDetail';

describe('COTTI platform analytics error URL state', () => {
  it('uses Chat-first stable defaults for missing or invalid parameters', () => {
    const params = new URLSearchParams({
      agentErrorPage: '0',
      agentErrorPageSize: '10',
      agentErrorSort: 'category',
      chatErrorPage: 'abc',
      chatErrorPageSize: '100',
      chatErrorSort: 'provider',
      errorView: 'tools',
    });

    expect(parseCottiPlatformAnalyticsErrorDetails(params)).toEqual({
      agent: { page: 1, pageSize: 20, q: '', sortBy: 'errorExecutions' },
      chat: { page: 1, pageSize: 20, q: '', sortBy: 'errorMessages' },
      view: 'chat',
    });
  });

  it('parses independent Chat and Agent search, sort, and pagination state', () => {
    const query = 'e'.repeat(120);
    const params = new URLSearchParams({
      agentErrorPage: '2',
      agentErrorPageSize: '50',
      agentErrorQ: '财务',
      agentErrorSort: 'affectedUsers',
      chatErrorPage: '4',
      chatErrorPageSize: '50',
      chatErrorQ: query,
      chatErrorSort: 'affectedUsers',
      errorView: 'agent',
    });

    expect(parseCottiPlatformAnalyticsErrorDetails(params)).toEqual({
      agent: { page: 2, pageSize: 50, q: '财务', sortBy: 'affectedUsers' },
      chat: {
        page: 4,
        pageSize: 50,
        q: query.slice(0, 100),
        sortBy: 'affectedUsers',
      },
      view: 'agent',
    });
  });

  it('writes compact state while preserving range and usage-detail parameters', () => {
    const current = new URLSearchParams(
      'range=30&usageView=models&chatErrorQ=stale&agentErrorSort=affectedUsers',
    );
    const state = {
      agent: { page: 3, pageSize: 50, q: '库存', sortBy: 'affectedUsers' },
      chat: { page: 1, pageSize: 20, q: '', sortBy: 'errorMessages' },
      view: 'agent',
    } as const satisfies CottiPlatformAnalyticsErrorDetailsState;

    const result = writeCottiPlatformAnalyticsErrorDetails(current, state);

    expect(result.get('range')).toBe('30');
    expect(result.get('usageView')).toBe('models');
    expect(result.get('errorView')).toBe('agent');
    expect(result.get('agentErrorPage')).toBe('3');
    expect(result.get('agentErrorPageSize')).toBe('50');
    expect(result.get('agentErrorQ')).toBe('库存');
    expect(result.get('agentErrorSort')).toBe('affectedUsers');
    expect(result.get('chatErrorPage')).toBeNull();
    expect(result.get('chatErrorPageSize')).toBeNull();
    expect(result.get('chatErrorQ')).toBeNull();
    expect(result.get('chatErrorSort')).toBeNull();
  });
});
