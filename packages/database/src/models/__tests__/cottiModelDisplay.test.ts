// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { agents, cottiModelDisplaySettings, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import {
  CottiModelDisplayModel,
  DEFAULT_COTTI_MODEL_DISPLAY_CONFIG,
  getEnabledModelDisplayItems,
} from '../cottiModelDisplay';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiModelDisplayModel(serverDB);

const cleanup = async () => {
  await serverDB.delete(cottiModelDisplaySettings);
  await serverDB.delete(agents);
  await serverDB.delete(users);
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiModelDisplayModel', () => {
  it('returns the default config before settings are saved', async () => {
    await expect(model.getConfig()).resolves.toEqual(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG);
  });

  it('uses the upgraded Gemini models in the default Cotti display config', () => {
    expect(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG.chat.slice(0, 2)).toEqual([
      {
        displayName: 'COTTI-快速',
        enabled: true,
        model: 'gemini-3.5-flash-lite',
        provider: 'vertexai',
      },
      {
        displayName: 'COTTI-专业',
        enabled: true,
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
      },
    ]);
    expect(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG.agent[0]).toEqual({
      displayName: 'COTTI-专业',
      enabled: true,
      model: 'gemini-3.6-flash',
      provider: 'vertexai',
    });
    expect(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG.defaults).toEqual({
      agent: { model: 'gemini-3.6-flash', provider: 'vertexai' },
      chat: { model: 'gemini-3.5-flash-lite', provider: 'vertexai' },
    });
  });

  it('shows all Azure GPT-5.6 models in the default Chat and Agent lists', () => {
    const expectedModels = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'];

    for (const scope of ['chat', 'agent'] as const) {
      const models = DEFAULT_COTTI_MODEL_DISPLAY_CONFIG[scope]
        .filter((item) => item.provider === 'azure' && item.model.startsWith('gpt-5.6-'))
        .map((item) => item.model);

      expect(models).toEqual(expectedModels);
      expect(
        DEFAULT_COTTI_MODEL_DISPLAY_CONFIG[scope]
          .filter((item) => expectedModels.includes(item.model))
          .every((item) => item.enabled),
      ).toBe(true);
    }
  });

  it('shows Qwen3.8 Max in the default Chat and Agent lists', () => {
    for (const scope of ['chat', 'agent'] as const) {
      expect(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG[scope]).toContainEqual({
        displayName: '千问3.8-Max',
        enabled: true,
        model: 'qwen3.8-max-0902',
        provider: 'qwen',
      });
    }
  });

  it('stores and normalizes the singleton model display config', async () => {
    const settings = await model.updateConfig(
      {
        agent: [
          {
            displayName: '  全能效率  ',
            enabled: true,
            model: ' gpt-5.5 ',
            provider: ' openai ',
          },
          { displayName: '', enabled: true, model: '  ', provider: 'qwen' },
        ],
        chat: [
          {
            displayName: 'COTTI-快速',
            enabled: true,
            model: 'gemini-3.5-flash-lite',
            provider: 'vertexai',
          },
        ],
        defaults: {
          agent: { model: ' gpt-5.5 ', provider: ' openai ' },
          chat: { model: ' gemini-3.5-flash-lite ', provider: ' vertexai ' },
        },
      },
      'admin-1',
    );

    expect(settings.updatedBy).toBe('admin-1');
    await expect(model.getConfig()).resolves.toEqual({
      agent: [{ displayName: '全能效率', enabled: true, model: 'gpt-5.5', provider: 'openai' }],
      chat: [
        {
          displayName: 'COTTI-快速',
          enabled: true,
          model: 'gemini-3.5-flash-lite',
          provider: 'vertexai',
        },
      ],
      defaults: {
        agent: { model: 'gpt-5.5', provider: 'openai' },
        chat: { model: 'gemini-3.5-flash-lite', provider: 'vertexai' },
      },
    });
  });

  it('adds explicit COTTI defaults when reading a historical config without defaults', async () => {
    await serverDB.insert(cottiModelDisplaySettings).values({
      config: {
        agent: [{ enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' }],
        chat: [{ enabled: true, model: 'gemini-3.5-flash-lite', provider: 'vertexai' }],
      },
      id: 'default',
    });

    await expect(model.getConfig()).resolves.toEqual({
      agent: [{ enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' }],
      chat: [{ enabled: true, model: 'gemini-3.5-flash-lite', provider: 'vertexai' }],
      defaults: {
        agent: { model: 'gemini-3.6-flash', provider: 'vertexai' },
        chat: { model: 'gemini-3.5-flash-lite', provider: 'vertexai' },
      },
    });
  });

  it('returns enabled unique model refs across chat and agent lists', () => {
    expect(
      getEnabledModelDisplayItems({
        agent: [
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
        ],
        chat: [
          { enabled: false, model: 'gemini-3.5-flash-lite', provider: 'vertexai' },
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
        ],
      }),
    ).toEqual([{ enabled: true, model: 'gpt-5.5', provider: 'openai' }]);
  });

  it('switches the professional channel and existing agents in one operation', async () => {
    await serverDB.insert(users).values({ id: 'professional-model-user' });
    await serverDB.insert(agents).values([
      {
        chatConfig: { thinkingLevel: 'minimal', urlContext: true },
        id: 'professional-36',
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        userId: 'professional-model-user',
      },
      {
        chatConfig: { thinkingLevel3: 'high', urlContext: true },
        id: 'professional-37',
        model: 'gemini-3.7-flash',
        provider: 'vertexai',
        userId: 'professional-model-user',
      },
      {
        id: 'unrelated-agent',
        model: 'gemini-3.5-flash-lite',
        provider: 'vertexai',
        userId: 'professional-model-user',
      },
    ]);

    const switchedTo37 = await model.switchProfessionalModel('gemini-3.7-flash', 'admin-1');

    expect(switchedTo37.affectedAgentCount).toBe(2);
    expect(switchedTo37.previousModel).toEqual({
      model: 'gemini-3.6-flash',
      provider: 'vertexai',
    });
    expect(switchedTo37.config.agent[0]).toMatchObject({
      displayName: 'COTTI-专业',
      model: 'gemini-3.7-flash',
    });
    expect(switchedTo37.config.chat[1]).toMatchObject({
      displayName: 'COTTI-专业',
      model: 'gemini-3.7-flash',
    });
    expect(switchedTo37.config.defaults?.agent).toEqual({
      model: 'gemini-3.7-flash',
      provider: 'vertexai',
    });

    const after37 = await serverDB.select().from(agents);
    expect(after37.find(({ id }) => id === 'professional-36')).toMatchObject({
      chatConfig: { thinkingLevel3: 'low', urlContext: true },
      model: 'gemini-3.7-flash',
    });
    expect(after37.find(({ id }) => id === 'professional-37')).toMatchObject({
      chatConfig: { thinkingLevel3: 'high', urlContext: true },
      model: 'gemini-3.7-flash',
    });
    expect(after37.find(({ id }) => id === 'unrelated-agent')?.model).toBe('gemini-3.5-flash-lite');

    const switchedTo36 = await model.switchProfessionalModel('gemini-3.6-flash', 'admin-2');
    const after36 = await serverDB.select().from(agents);

    expect(switchedTo36.affectedAgentCount).toBe(2);
    expect(after36.find(({ id }) => id === 'professional-36')).toMatchObject({
      chatConfig: { thinkingLevel: 'low', urlContext: true },
      model: 'gemini-3.6-flash',
    });
    expect(after36.find(({ id }) => id === 'professional-37')).toMatchObject({
      chatConfig: { thinkingLevel: 'high', urlContext: true },
      model: 'gemini-3.6-flash',
    });
  });

  it('reports the current professional model and affected agent count', async () => {
    await serverDB.insert(users).values({ id: 'professional-status-user' });
    await serverDB.insert(agents).values([
      {
        id: 'professional-status-36',
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
        userId: 'professional-status-user',
      },
      {
        id: 'professional-status-37',
        model: 'gemini-3.7-flash',
        provider: 'vertexai',
        userId: 'professional-status-user',
      },
    ]);

    await expect(model.getProfessionalModelStatus()).resolves.toEqual({
      affectedAgentCount: 2,
      currentModel: { model: 'gemini-3.6-flash', provider: 'vertexai' },
    });
  });
});
