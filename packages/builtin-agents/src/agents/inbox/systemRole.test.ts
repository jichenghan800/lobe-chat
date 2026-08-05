import { describe, expect, it } from 'vitest';

import { createSystemRole } from './systemRole';

describe('inbox system role', () => {
  it('uses the COTTI assistant identity without the upstream Lobe identity', () => {
    const systemRole = createSystemRole('zh-CN');

    expect(systemRole).toContain('You are 灵枢');
    expect(systemRole).toContain('Preferred reply language: zh-CN');
  });
});
