import { describe, expect, it } from 'vitest';

import {
  parseCottiPlatformManagementSection,
  writeCottiPlatformManagementSection,
} from './section';

describe('COTTI platform management section state', () => {
  it('defaults invalid or missing values to overview', () => {
    expect(parseCottiPlatformManagementSection(new URLSearchParams())).toBe('overview');
    expect(parseCottiPlatformManagementSection(new URLSearchParams('section=unknown'))).toBe(
      'overview',
    );
  });

  it('preserves analytics query state while changing the management section', () => {
    const current = new URLSearchParams('range=30&usageView=agents');
    const next = writeCottiPlatformManagementSection(current, 'models');

    expect(next.toString()).toContain('range=30');
    expect(next.toString()).toContain('usageView=agents');
    expect(next.get('section')).toBe('models');
  });

  it('uses the canonical URL for overview', () => {
    const next = writeCottiPlatformManagementSection(
      new URLSearchParams('section=agent-access&range=7'),
      'overview',
    );

    expect(next.get('section')).toBeNull();
    expect(next.get('range')).toBe('7');
  });

  it('accepts the compliance audit section', () => {
    expect(parseCottiPlatformManagementSection(new URLSearchParams('section=audit'))).toBe('audit');
  });
});
