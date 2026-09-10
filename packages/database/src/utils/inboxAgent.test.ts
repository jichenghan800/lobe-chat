import { describe, expect, it } from 'vitest';

import { normalizeInboxAgentTitle } from './inboxAgent';

describe('default assistant branding', () => {
  it.each([null, undefined, '', '   '])('returns 灵枢AI for an unnamed inbox: %s', (title) => {
    expect(normalizeInboxAgentTitle(title, { slug: 'inbox' })).toBe('灵枢AI');
  });
  it.each(['灵枢AI', 'My Assistant', 'Lobe AI'])('preserves a saved inbox name: %s', (title) => {
    expect(normalizeInboxAgentTitle(title, { slug: 'inbox' })).toBe(title);
  });
  it('does not rename an ordinary agent or inject a name into an empty one', () => {
    expect(normalizeInboxAgentTitle('Lobe AI', {})).toBe('Lobe AI');
    expect(normalizeInboxAgentTitle(null, {})).toBeNull();
  });
});
