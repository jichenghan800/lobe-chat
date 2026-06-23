import { describe, expect, it } from 'vitest';

import { getModelDisplayName, normalizeProviderModelDisplayNames } from './modelDisplayName';

describe('modelDisplayName', () => {
  it('returns product display names for visible default models', () => {
    expect(getModelDisplayName('vertexai', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite')).toBe(
      'COTTI-快速',
    );
    expect(getModelDisplayName('vertexai', 'gemini-3.5-flash', 'Gemini 3.5 Flash')).toBe(
      'COTTI-专业',
    );
    expect(
      getModelDisplayName('volcengine', 'doubao-seed-1.6-flash', 'Doubao Seed 1.6 Flash'),
    ).toBe('豆包1.6-Flash');
    expect(getModelDisplayName('qwen', 'qwen3.7-plus', 'Qwen3.7 Plus')).toBe('千问3.7-Plus');
    expect(getModelDisplayName('openai', 'gpt-5.5', 'GPT-5.5')).toBe('全能效率');
    expect(getModelDisplayName('openai', 'glm-5.2', 'GLM-5.2')).toBe('智谱-GLM5.2');
  });

  it('normalizes provider model lists without dropping provider fields', () => {
    const providers = normalizeProviderModelDisplayNames([
      {
        children: [
          { displayName: 'Gemini 3.1 Flash Lite', id: 'gemini-3.1-flash-lite' },
          { displayName: 'Gemini 3.5 Flash', id: 'gemini-3.5-flash' },
        ],
        id: 'vertexai',
        name: 'Vertex AI',
      },
      {
        children: [{ displayName: 'Doubao Seed 1.6 Flash', id: 'doubao-seed-1.6-flash' }],
        id: 'volcengine',
        name: 'Volcengine',
      },
      {
        children: [{ displayName: 'Qwen3.7 Plus', id: 'qwen3.7-plus' }],
        id: 'qwen',
        name: 'Aliyun Bailian',
      },
      {
        children: [
          { displayName: 'GPT-5.5', id: 'gpt-5.5' },
          { displayName: 'GLM-5.2', id: 'glm-5.2' },
        ],
        id: 'openai',
        name: 'OpenAI',
      },
    ]);

    expect(providers).toEqual([
      {
        children: [
          { displayName: 'COTTI-快速', id: 'gemini-3.1-flash-lite' },
          { displayName: 'COTTI-专业', id: 'gemini-3.5-flash' },
        ],
        id: 'vertexai',
        name: 'Vertex AI',
      },
      {
        children: [{ displayName: '豆包1.6-Flash', id: 'doubao-seed-1.6-flash' }],
        id: 'volcengine',
        name: 'Volcengine',
      },
      {
        children: [{ displayName: '千问3.7-Plus', id: 'qwen3.7-plus' }],
        id: 'qwen',
        name: 'Aliyun Bailian',
      },
      {
        children: [
          { displayName: '全能效率', id: 'gpt-5.5' },
          { displayName: '智谱-GLM5.2', id: 'glm-5.2' },
        ],
        id: 'openai',
        name: 'OpenAI',
      },
    ]);
  });
});
