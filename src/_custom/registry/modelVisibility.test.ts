import { describe, expect, it } from 'vitest';

import { filterVisibleProviderModelLists } from './modelVisibility';

describe('modelVisibility', () => {
  it('filters and orders visible models by the allow list', () => {
    const providers = filterVisibleProviderModelLists([
      {
        children: [{ id: 'glm-5.2' }, { id: 'hidden-openai' }],
        id: 'openai',
      },
      {
        children: [{ id: 'gpt-5.5' }, { id: 'hidden-azure' }],
        id: 'azure',
      },
      {
        children: [{ id: 'claude-opus-4-7' }, { id: 'hidden-claude' }],
        id: 'anthropic',
      },
      {
        children: [
          { id: 'gemini-3.5-flash' },
          { id: 'gemini-3.1-flash-lite' },
          { id: 'hidden-gemini' },
        ],
        id: 'vertexai',
      },
      {
        children: [{ id: 'doubao-seed-2-1-pro-260628' }, { id: 'hidden-doubao' }],
        id: 'volcengine',
      },
      {
        children: [{ id: 'qwen3.7-plus' }, { id: 'hidden-qwen' }],
        id: 'qwen',
      },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual([
      'vertexai',
      'volcengine',
      'qwen',
      'azure',
    ]);
    expect(providers[0].children.map((model) => model.id)).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
    ]);
    expect(providers[1].children.map((model) => model.id)).toEqual(['doubao-seed-2-1-pro-260628']);
    expect(providers[2].children.map((model) => model.id)).toEqual(['qwen3.7-plus']);
    expect(providers[3].children.map((model) => model.id)).toEqual(['gpt-5.5']);
  });
});
