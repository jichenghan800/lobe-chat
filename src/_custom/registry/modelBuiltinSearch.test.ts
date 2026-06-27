import { describe, expect, it } from 'vitest';

import { isModelBuiltinSearchAllowed, normalizeModelBuiltinSearch } from './modelBuiltinSearch';

describe('modelBuiltinSearch', () => {
  it('keeps official behavior when no allow list is configured', () => {
    expect(isModelBuiltinSearchAllowed('azure', 'gpt-5.5', '')).toBe(true);
  });

  it('keeps builtin search for allow-listed Gemini models', () => {
    const model = normalizeModelBuiltinSearch('vertexai', {
      abilities: { search: true },
      id: 'gemini-3.5-flash',
      providerId: 'vertexai',
      settings: { searchImpl: 'params', searchProvider: 'google' },
    });

    expect(isModelBuiltinSearchAllowed('vertexai', 'gemini-3.5-flash', 'vertexai/gemini-*')).toBe(
      true,
    );
    expect(model.abilities.search).toBe(true);
    expect(model.settings).toEqual({ searchImpl: 'params', searchProvider: 'google' });
  });

  it('keeps builtin search for allow-listed Qwen models', () => {
    const allowList = 'vertexai/gemini-*,qwen/qwen3.7-plus';

    expect(isModelBuiltinSearchAllowed('qwen', 'qwen3.7-plus', allowList)).toBe(true);
  });

  it('strips builtin search from Doubao 2.1 Pro in the Cotti allow list', () => {
    const previousAllow = process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW;
    process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW =
      'vertexai/gemini-*,google/gemini-*,qwen/qwen3.7-plus';

    try {
      const model = normalizeModelBuiltinSearch('volcengine', {
        abilities: { functionCall: true, search: true },
        id: 'doubao-seed-2-1-pro-260628',
        providerId: 'volcengine',
        settings: { extendParams: ['gpt5ReasoningEffort'], searchImpl: 'params' },
      });

      expect(model.abilities).toEqual({ functionCall: true, search: false });
      expect(model.settings).toEqual({ extendParams: ['gpt5ReasoningEffort'] });
    } finally {
      if (previousAllow === undefined) {
        delete process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW;
      } else {
        process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW = previousAllow;
      }
    }
  });

  it('strips builtin search from non-allow-listed models and preserves other settings', () => {
    const previousAllow = process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW;
    process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW = 'vertexai/gemini-*';

    const model = normalizeModelBuiltinSearch('azure', {
      abilities: { functionCall: true, search: true },
      id: 'gpt-5.5',
      providerId: 'azure',
      settings: { extendParams: ['reasoning_effort'], searchImpl: 'params' },
    });

    process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW = previousAllow;

    expect(model.abilities).toEqual({ functionCall: true, search: false });
    expect(model.settings).toEqual({ extendParams: ['reasoning_effort'] });
  });
});
