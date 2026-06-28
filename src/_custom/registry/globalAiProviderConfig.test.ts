import { afterEach, describe, expect, it } from 'vitest';

import { pruneGlobalAiProviderConfig } from './globalAiProviderConfig';

describe('pruneGlobalAiProviderConfig', () => {
  const originalVisibleAllow = process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW;

  afterEach(() => {
    if (originalVisibleAllow === undefined) {
      delete process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW;
      return;
    }

    process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW = originalVisibleAllow;
  });

  it('keeps only providers and models from NEXT_PUBLIC_MODEL_VISIBLE_ALLOW', () => {
    process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW =
      'vertexai/gemini-3.1-flash-lite,qwen/glm-5.2,azure/gpt-5.5';

    const result = pruneGlobalAiProviderConfig({
      azure: {
        enabled: true,
        enabledModels: ['gpt-5.5', 'gpt-4o'],
        serverModelLists: [
          { displayName: 'GPT 5.5', enabled: true, id: 'gpt-5.5' },
          { displayName: 'GPT 4o', enabled: true, id: 'gpt-4o' },
        ],
      },
      ollama: {
        enabled: true,
        enabledModels: ['llama3'],
        serverModelLists: [{ displayName: 'Llama 3', enabled: true, id: 'llama3' }],
      },
      qwen: {
        enabled: true,
        enabledModels: ['glm-5.2', 'qwen3.7-plus'],
        serverModelLists: [
          { displayName: 'GLM 5.2', enabled: true, id: 'glm-5.2' },
          { displayName: 'Qwen 3.7 Plus', enabled: true, id: 'qwen3.7-plus' },
        ],
      },
      vertexai: {
        enabled: true,
        enabledModels: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
        serverModelLists: [
          {
            displayName: 'Gemini 3.1 Flash Lite',
            enabled: true,
            id: 'gemini-3.1-flash-lite',
          },
          { displayName: 'Gemini 3.5 Flash', enabled: true, id: 'gemini-3.5-flash' },
        ],
      },
    });

    expect(Object.keys(result || {})).toEqual(['azure', 'qwen', 'vertexai']);
    expect(result?.azure?.enabledModels).toEqual(['gpt-5.5']);
    expect(result?.azure?.serverModelLists?.map((model) => model.id)).toEqual(['gpt-5.5']);
    expect(result?.qwen?.enabledModels).toEqual(['glm-5.2']);
    expect(result?.qwen?.serverModelLists?.map((model) => model.id)).toEqual(['glm-5.2']);
    expect(result?.vertexai?.enabledModels).toEqual(['gemini-3.1-flash-lite']);
    expect(result?.vertexai?.serverModelLists?.map((model) => model.id)).toEqual([
      'gemini-3.1-flash-lite',
    ]);
    expect(result?.ollama).toBeUndefined();
  });

  it('keeps the original config when visible allow-list is not configured', () => {
    delete process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW;

    const aiProvider = {
      ollama: {
        enabled: true,
        serverModelLists: [{ displayName: 'Llama 3', enabled: true, id: 'llama3' }],
      },
    };

    expect(pruneGlobalAiProviderConfig(aiProvider)).toBe(aiProvider);
  });
});
