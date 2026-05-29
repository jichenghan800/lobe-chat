import { describe, expect, it } from 'vitest';

import { getModelDisplayName, normalizeProviderModelDisplayNames } from './modelDisplayName';

describe('modelDisplayName', () => {
  it('returns product display names for visible default models', () => {
    expect(getModelDisplayName('vertexai', 'gemini-3.5-flash', 'Gemini 3.5 Flash')).toBe(
      '灵感探索',
    );
    expect(getModelDisplayName('openai', 'gpt-5.5', 'GPT 5.5')).toBe('全能效率');
    expect(getModelDisplayName('anthropic', 'claude-opus-4-7', 'Claude Opus')).toBe('深度思考');
  });

  it('normalizes provider model lists without dropping provider fields', () => {
    const providers = normalizeProviderModelDisplayNames([
      {
        children: [{ displayName: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' }],
        id: 'vertexai',
        name: 'Vertex AI',
      },
    ]);

    expect(providers).toEqual([
      {
        children: [{ displayName: '灵感探索', id: 'gemini-3.5-flash' }],
        id: 'vertexai',
        name: 'Vertex AI',
      },
    ]);
  });
});
