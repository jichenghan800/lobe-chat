import { describe, expect, it } from 'vitest';

import { filterVisibleProviderModelLists } from './modelVisibility';

describe('modelVisibility', () => {
  it('filters and orders visible models by the allow list', () => {
    const providers = filterVisibleProviderModelLists([
      {
        children: [{ id: 'gpt-5.5' }, { id: 'hidden-openai' }],
        id: 'openai',
      },
      {
        children: [{ id: 'claude-opus-4-7' }, { id: 'hidden-claude' }],
        id: 'anthropic',
      },
      {
        children: [{ id: 'gemini-3.5-flash' }, { id: 'hidden-gemini' }],
        id: 'vertexai',
      },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual(['vertexai', 'openai', 'anthropic']);
    expect(providers[0].children.map((model) => model.id)).toEqual(['gemini-3.5-flash']);
    expect(providers[1].children.map((model) => model.id)).toEqual(['gpt-5.5']);
    expect(providers[2].children.map((model) => model.id)).toEqual(['claude-opus-4-7']);
  });
});
