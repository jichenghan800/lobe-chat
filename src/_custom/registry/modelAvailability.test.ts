import { describe, expect, it } from 'vitest';

import {
  COTTI_AGENT_DEFAULT_MODEL,
  COTTI_CHAT_DEFAULT_MODEL,
  filterAgentModeModelLists,
  filterAgentOnlyChatModels,
  filterChatModeModelLists,
  getCottiModeFallbackConfig,
  isAgentModelRoute,
  isAgentOnlyChatModel,
  isChatOnlyModel,
  shouldIncludeAgentOnlyChatModels,
} from './modelAvailability';

describe('modelAvailability', () => {
  it('uses the upgraded Gemini models as Cotti defaults', () => {
    expect(COTTI_CHAT_DEFAULT_MODEL).toEqual({
      model: 'gemini-3.5-flash-lite',
      provider: 'vertexai',
    });
    expect(COTTI_AGENT_DEFAULT_MODEL).toEqual({
      model: 'gemini-3.6-flash',
      provider: 'vertexai',
    });
  });

  it('marks Cotti agent-only models', () => {
    expect(isAgentOnlyChatModel('doubao-seed-2-1-pro-260628')).toBe(true);
    expect(isAgentOnlyChatModel('gpt-5.5')).toBe(true);
    expect(isAgentOnlyChatModel('GLM-5.2')).toBe(true);
    expect(isAgentOnlyChatModel('gemini-3.6-flash')).toBe(false);
  });

  it('marks Cotti Flash as chat-only', () => {
    expect(isChatOnlyModel('gemini-3.5-flash-lite')).toBe(true);
    expect(isChatOnlyModel('gemini-3.6-flash')).toBe(false);
  });

  it('removes agent-only models from chat provider lists while keeping chat models', () => {
    const result = filterChatModeModelLists([
      {
        children: [{ id: 'gemini-3.5-flash-lite' }, { id: 'gemini-3.6-flash' }, { id: 'gpt-5.5' }],
        id: 'vertexai',
      },
      {
        children: [{ id: 'doubao-seed-2-1-pro-260628' }],
        id: 'volcengine',
      },
      {
        children: [{ id: 'glm-5.2' }],
        id: 'qwen',
      },
    ]);

    expect(result).toEqual([
      {
        children: [{ id: 'gemini-3.5-flash-lite' }, { id: 'gemini-3.6-flash' }],
        id: 'vertexai',
      },
    ]);
  });

  it('keeps the legacy chat-mode filter export as an alias', () => {
    const providers = [
      {
        children: [{ id: 'gpt-5.5' }, { id: 'gemini-3.6-flash' }],
        id: 'azure',
      },
    ];

    expect(filterAgentOnlyChatModels(providers)).toEqual(filterChatModeModelLists(providers));
  });

  it('removes chat-only models from agent provider lists while keeping agent models', () => {
    const result = filterAgentModeModelLists([
      {
        children: [{ id: 'gemini-3.5-flash-lite' }, { id: 'gemini-3.6-flash' }, { id: 'gpt-5.5' }],
        id: 'vertexai',
      },
      {
        children: [{ id: 'doubao-seed-2-1-pro-260628' }],
        id: 'volcengine',
      },
      {
        children: [{ id: 'glm-5.2' }],
        id: 'qwen',
      },
    ]);

    expect(result).toEqual([
      {
        children: [{ id: 'gemini-3.6-flash' }, { id: 'gpt-5.5' }],
        id: 'vertexai',
      },
      {
        children: [{ id: 'doubao-seed-2-1-pro-260628' }],
        id: 'volcengine',
      },
      {
        children: [{ id: 'glm-5.2' }],
        id: 'qwen',
      },
    ]);
  });

  it('falls back to the Cotti default model when switching into a mode that hides the current model', () => {
    expect(
      getCottiModeFallbackConfig({
        enableAgentMode: true,
        modelId: 'gemini-3.5-flash-lite',
      }),
    ).toEqual(COTTI_AGENT_DEFAULT_MODEL);

    expect(
      getCottiModeFallbackConfig({
        enableAgentMode: false,
        modelId: 'doubao-seed-2-1-pro-260628',
      }),
    ).toEqual(COTTI_CHAT_DEFAULT_MODEL);

    expect(
      getCottiModeFallbackConfig({
        enableAgentMode: true,
        modelId: 'qwen3.7-plus',
      }),
    ).toBeUndefined();
  });

  it('detects agent model selector routes', () => {
    expect(isAgentModelRoute('/agent/agt_1')).toBe(true);
    expect(isAgentModelRoute('/agent/agt_1/tpc_1')).toBe(true);
    expect(isAgentModelRoute('/popup/agent/agt_1/tpc_1')).toBe(true);
    expect(isAgentModelRoute('/workspace-a/agent/agt_1')).toBe(true);
    expect(isAgentModelRoute('/')).toBe(false);
    expect(isAgentModelRoute('/chat')).toBe(false);
  });

  it('only includes agent-only chat models for active agent mode', () => {
    expect(
      shouldIncludeAgentOnlyChatModels({
        enableAgentMode: true,
        enableCottiAgentAccess: true,
      }),
    ).toBe(true);

    expect(
      shouldIncludeAgentOnlyChatModels({
        enableAgentMode: false,
        enableCottiAgentAccess: true,
      }),
    ).toBe(false);

    expect(
      shouldIncludeAgentOnlyChatModels({
        enableAgentMode: true,
        enableCottiAgentAccess: false,
      }),
    ).toBe(false);
  });
});
