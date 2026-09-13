import { describe, expect, it } from 'vitest';

import type { CottiPlatformAnalyticsDetailsState } from './detail';
import { parseCottiPlatformAnalyticsDetails, writeCottiPlatformAnalyticsDetails } from './detail';

describe('COTTI platform analytics detail URL state', () => {
  it('uses stable defaults for missing or invalid list parameters', () => {
    const params = new URLSearchParams({
      usageAgentPage: '0',
      usageAgentPageSize: '5',
      usageAgentSort: 'toolCalls',
      usageModelPage: '-2',
      usageModelPageSize: '100',
      usageModelSort: 'llmCalls',
      usageUserPage: 'abc',
      usageUserPageSize: '10',
      usageUserSort: 'activeUsers',
      usageView: 'agents',
    });

    expect(parseCottiPlatformAnalyticsDetails(params)).toEqual({
      agents: { page: 1, pageSize: 20, q: '', sortBy: 'recordedCost' },
      models: { page: 1, pageSize: 20, q: '', sortBy: 'recordedCost' },
      users: { page: 1, pageSize: 20, q: '', sortBy: 'recordedCost' },
      view: 'agents',
    });
  });

  it('parses independent Agent, user, and model search, sort, and pagination state', () => {
    const query = 'm'.repeat(120);
    const params = new URLSearchParams({
      usageAgentPage: '4',
      usageAgentPageSize: '50',
      usageAgentQ: '运营',
      usageAgentSort: 'lastExecutedAt',
      usageModelPage: '3',
      usageModelPageSize: '50',
      usageModelQ: query,
      usageModelSort: 'activeUsers',
      usageUserPage: '2',
      usageUserPageSize: '50',
      usageUserQ: 'alice@example.com',
      usageUserSort: 'lastActiveAt',
      usageView: 'models',
    });

    expect(parseCottiPlatformAnalyticsDetails(params)).toEqual({
      agents: {
        page: 4,
        pageSize: 50,
        q: '运营',
        sortBy: 'lastExecutedAt',
      },
      models: {
        page: 3,
        pageSize: 50,
        q: query.slice(0, 100),
        sortBy: 'activeUsers',
      },
      users: {
        page: 2,
        pageSize: 50,
        q: 'alice@example.com',
        sortBy: 'lastActiveAt',
      },
      view: 'models',
    });
  });

  it('writes compact detail state while preserving unrelated range parameters', () => {
    const current = new URLSearchParams(
      'range=30&usageView=models&usageAgentQ=stale&usageModelQ=stale&usageUserSort=errorMessages',
    );
    const state = {
      agents: { page: 2, pageSize: 50, q: '财务', sortBy: 'executions' },
      models: { page: 4, pageSize: 50, q: 'vertex', sortBy: 'recordedCost' },
      users: { page: 1, pageSize: 20, q: '', sortBy: 'recordedCost' },
      view: 'users',
    } as const satisfies CottiPlatformAnalyticsDetailsState;

    const result = writeCottiPlatformAnalyticsDetails(current, state);

    expect(result.get('range')).toBe('30');
    expect(result.get('usageView')).toBeNull();
    expect(result.get('usageAgentPage')).toBe('2');
    expect(result.get('usageAgentPageSize')).toBe('50');
    expect(result.get('usageAgentQ')).toBe('财务');
    expect(result.get('usageAgentSort')).toBe('executions');
    expect(result.get('usageModelPage')).toBe('4');
    expect(result.get('usageModelPageSize')).toBe('50');
    expect(result.get('usageModelQ')).toBe('vertex');
    expect(result.get('usageModelSort')).toBeNull();
    expect(result.get('usageUserPage')).toBeNull();
    expect(result.get('usageUserPageSize')).toBeNull();
    expect(result.get('usageUserQ')).toBeNull();
    expect(result.get('usageUserSort')).toBeNull();
  });
});
