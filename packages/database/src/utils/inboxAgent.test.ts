import { describe, expect, it } from 'vitest';

import { normalizeInboxAgentTitle } from './inboxAgent';

describe('normalizeInboxAgentTitle', () => {
  it('uses the COTTI assistant name for a blank inbox title', () => {
    expect(normalizeInboxAgentTitle(null, { slug: 'inbox' })).toBe('灵枢AI');
  });

  it('preserves user-defined and non-inbox titles', () => {
    expect(normalizeInboxAgentTitle('我的助手', { slug: 'inbox' })).toBe('我的助手');
    expect(normalizeInboxAgentTitle(null, { slug: 'agent-builder' })).toBeNull();
  });
});
