import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COTTI_PLATFORM_AUDIT_STATE,
  parseCottiPlatformAuditState,
  toCottiPlatformAuditQuery,
  writeCottiPlatformAuditState,
} from './state';

describe('COTTI platform audit URL state', () => {
  it('uses safe defaults for missing or invalid query values', () => {
    expect(
      parseCottiPlatformAuditState(
        new URLSearchParams(
          'auditFeature=unknown&auditRisk=critical&auditPage=-1&auditPageSize=100&auditRange=365',
        ),
      ),
    ).toEqual(DEFAULT_COTTI_PLATFORM_AUDIT_STATE);
  });

  it('parses a restorable server-side list state', () => {
    expect(
      parseCottiPlatformAuditState(
        new URLSearchParams(
          'auditFeature=agent&auditRisk=high&auditPage=3&auditPageSize=50&auditRange=30&auditQ=alice',
        ),
      ),
    ).toEqual({
      feature: 'agent',
      page: 3,
      pageSize: 50,
      q: 'alice',
      range: 30,
      riskLevel: 'high',
    });
  });

  it('restores the task-mode filter', () => {
    expect(parseCottiPlatformAuditState(new URLSearchParams('auditFeature=task')).feature).toBe(
      'task',
    );
  });

  it('preserves unrelated platform-management state while writing audit filters', () => {
    const next = writeCottiPlatformAuditState(new URLSearchParams('section=audit&range=90'), {
      feature: 'tool',
      page: 2,
      pageSize: 20,
      q: 'bob@example.com',
      range: 7,
      riskLevel: 'medium',
    });

    expect(next.get('section')).toBe('audit');
    expect(next.get('range')).toBe('90');
    expect(next.get('auditFeature')).toBe('tool');
    expect(next.get('auditPage')).toBe('2');
    expect(next.get('auditQ')).toBe('bob@example.com');
  });

  it('omits empty search text from the API query', () => {
    expect(toCottiPlatformAuditQuery(DEFAULT_COTTI_PLATFORM_AUDIT_STATE)).toEqual({
      feature: 'all',
      page: 1,
      pageSize: 20,
      q: undefined,
      range: 7,
      riskLevel: 'flagged',
    });
  });
});
