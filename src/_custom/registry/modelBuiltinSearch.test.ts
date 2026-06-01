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
