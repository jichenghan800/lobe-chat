import { describe, expect, it } from 'vitest';

import type { CottiAgentAccessRule } from '@/types/cotti/agentAccess';

import { getAgentAccessRuleMemberPresentation } from './agentAccessPresentation';

const createRule = (overrides: Partial<CottiAgentAccessRule> = {}): CottiAgentAccessRule => ({
  createdAt: '2026-08-04T00:00:00.000Z',
  createdBy: 'admin-user',
  enabled: true,
  id: 'rule-1',
  note: null,
  type: 'email',
  updatedAt: '2026-08-04T00:00:00.000Z',
  user: null,
  value: 'member@example.com',
  ...overrides,
});

describe('getAgentAccessRuleMemberPresentation', () => {
  it('shows the user full name with the account identity underneath', () => {
    expect(
      getAgentAccessRuleMemberPresentation(
        createRule({
          user: {
            email: 'member@example.com',
            fullName: '测试用户',
            id: 'user-1',
            normalizedEmail: 'member@example.com',
            role: null,
            username: 'member',
          },
        }),
      ),
    ).toEqual({ subtitle: 'member@example.com', title: '测试用户' });
  });

  it('falls back to username and then the stored rule value', () => {
    expect(
      getAgentAccessRuleMemberPresentation(
        createRule({
          user: {
            email: null,
            fullName: null,
            id: 'user-1',
            normalizedEmail: null,
            role: null,
            username: 'member',
          },
          value: 'user-1',
        }),
      ),
    ).toEqual({ subtitle: 'user-1', title: 'member' });
    expect(getAgentAccessRuleMemberPresentation(createRule())).toEqual({
      title: 'member@example.com',
    });
  });
});
